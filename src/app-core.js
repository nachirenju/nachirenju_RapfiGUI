/**
 * バックエンド（WASMエンジン連携・全体状態管理）のメインエントリーポイント。
 * 
 * ユーザーからの操作やフロントエンドからのイベントを受け入れ、エンジンの起動・探索・停止などの全体的なライフサイクルを管理する。
 * 対局中のAI思考処理、一括解析モード、研究モードといった各ユースケースに応じた処理へのルーティングと排他制御を担う。
 * 
 * 主な役割:
 * - IPCを介したUIとの通信およびイベントハンドリング
 * - 現在のゲーム状態（検討・研究・対局など）に応じたエンジン探索（YXNBEST等）の開始・制御
 * - エラーハンドリングおよび例外発生時のリカバリ処理
 */

import { BOARD_SIZE, DEBUG_MODE } from './config/constants.js';
import {
    clearAnalysisTimeout as clearAnalysisSessionTimeout,
    createAnalysisState,
    hasPendingAnalysisResult,
    resolveAnalysisFromBestMove,
    resolveAnalysisFromMove,
    startAnalysisSession,
    stopAnalysisSession as stopAnalysisSessionState
} from './analysis/session.js';
import { createDefaultEngineMove } from './ai/moves.js';
import { isInsideBoard, toNotation, checksFourOnBoard } from './game/board.js';
import { createMoveHistoryKey } from './game/moves.js';
import { createGameRecord } from './game/record.js';
import {
    finishGameSession,
    handlePlayerMove as handleGamePlayerMove,
    pauseRunningTimer,
    startGameSession,
    stopGameTimers as stopGameSessionTimers,
    takebackPlayerMove as takebackGamePlayerMove
} from './game/session.js';
import { sendToRenderer, broadcastLog } from './renderer/events.js';
import { createTrace } from './renderer/debug.js';
import { formatMoveWithNotation as formatMoveWithNotationText } from './renderer/notation.js';
import {
    appendGameRecord,
    deleteGameRecordById,
    findGameRecordById,
    hasStoredGameRecords,
    loadGameRecordsNewestFirst,
    loadQuizList,
    saveQuizList,
    updateGameRecordEvalsById
} from './storage/records.js';
import { createGameConfigCommands, createResearchConfigCommands } from './engine/config.js';
import { getEngineThreadCount as normalizeEngineThreadCount } from './engine/settings.js';
import { parseEngineDownloadStatus, shouldResetDownloadProgress } from './engine/status.js';
import { classifyEngineLine, parseInlineEvalScore, parsePvSearchLine } from './engine/output.js';
import { createTurnTimeCommands } from './engine/time.js';
import { createYXBoardCommand } from './engine/yxboard.js';
import { resetResearchBuffers } from './research/buffers.js';
import { prepareResearchEngine } from './research/engine-session.js';
import { logResearchBoardForEngine, sendResearchSearchCommand } from './research/search-command.js';
import {
    applyResearchEngineSettings,
    getResearchHashSize,
    getResearchThreadCount,
    getResearchTimeout
} from './research/settings.js';
import { delay } from './utils/async.js';

import * as GameState from './state/game-state.js';
import * as SearchState from './state/search-state.js';
import * as ResearchSessionState from './state/research-session-state.js';
import { createEngineRuntime } from './engine/engine-runtime.js';

// --- デバッグ用可視化ツール ---
const trace = createTrace(DEBUG_MODE);


// ★ 新設: 盤面更新トランザクション

//h10などの棋譜表記→(x,y)
function formatMoveWithNotation(line, includeTime = false) {
    return formatMoveWithNotationText(line, {
        includeTime,
        getTimeInfo: () => {
            if (!rapfiTimer || !rapfiTimer.isRunning) return "";
            const ms = rapfiTimer.getCurrentRemaining();
            return ` [${(ms / 1000).toFixed(1)}s]`;
        }
    });
}


// ---------------------------------------------------------
// 状態変数
// ---------------------------------------------------------


// 探索セッションのライフサイクル管理


let rapfiTimer = null;

let playerTimer = null;
let isRapfiThinking = false;
const IOS_RESEARCH_TIMEOUT_MS = 5000;
let thinkDebugTimer = null;
let thinkDebugState = null;
let thinkSequence = 0;
let lastEngineDownloadPct = -1;
let gameThinkTimeConfig = {
    timeRule: 'normal',
    turnTimePercent: 20,
    turnTimeMarginMs: 500
};


// --- 状態変数に追加 ---

const engineRuntime = createEngineRuntime({
    onLine: (line, gen) => {
        if (engineRuntime.getGeneration() !== gen) return;
        processEngineLine(line);
    },
    onStatus: (status) => logEngineStatus(status),
    onReady: () => sendToRenderer('engine_ready'),
    onExit: (c) => {
        console.log(`[Engine exit] ${c}`);
        if (c === 0) {
            if (!isGameRunning || isResearchMode || isAnalysisRunning() || isIntentionalKill) {
                if (DEBUG_MODE) console.log("[AppCore DEBUG] Engine exited with 0. No automatic reload for current mode.");
                return;
            }
            if (DEBUG_MODE) console.log("[AppCore DEBUG] Engine exited with 0. Reloading engine for the next move...");
            engineRuntime.start();
            return;
        }
        if (isGameRunning && !gameEnded && !isIntentionalKill && !isAnalysisRunning()) {
            crashRetryCount++;
            if (crashRetryCount > 3) {
                broadcastLog('CRITICAL: Engine crashed repeatedly.');
                terminateGame('Error (Engine Crash)');
                return;
            }
            broadcastLog('WARNING: Engine crashed. Recovering... (' + crashRetryCount + '/3)');
            setTimeout(() => recoverGameSession(), 1000);
        }
    },
    onError: (err) => {
        broadcastLog('[ERROR] Engine: ' + err);
    }
});

function sendToEngine(cmd) {
    engineRuntime.send(cmd, {
        debugMode: DEBUG_MODE,
        isAnalyzing: isAnalysisRunning(),
        onCommand: (trimmedCmd) => {
            if (!thinkDebugState) return;
            thinkDebugState.commands.push(trimmedCmd);
            if (/^YXNBEST\b/i.test(trimmedCmd)) {
                thinkDebugState.searchCommandSentAt = performance.now();
            }
        }
    });
}

let gameActionTimer = null;
let gameActionSeq = 0;
let lastGameActionTime = 0;

// 詳細設定及び対局状態管理
let isGameRunning = false;
let gameEnded = false;
let aiColorGlobal = 2;
let globalPlayerColor = 1;
let isAiVsAi = false;

let currentMaxMoves = 0;
let currentStrength = 100;
let currentNBest = 3;
let isHumanStyle = false;
let currentBlunderThreshold = -200;
let currentBlunderRate = 0;
let currentMissMateRate = 0;

let lastEngineSettings = null;
let isIntentionalKill = false;
let crashRetryCount = 0;

function getEngineThreadCount(requestedThreads) {
    return normalizeEngineThreadCount(requestedThreads, engineRuntime.getSupportsThreads());
}

// Analysis mode state
const analysisState = createAnalysisState();

function isAnalysisRunning() {
    return analysisState.isAnalyzing;
}

function setAnalysisRunning(value) {
    analysisState.isAnalyzing = value;
}

function clearAnalysisTimeout() {
    clearAnalysisSessionTimeout(analysisState);
}

let isResearchMode = false;
let isInitializingEngine = false;

let gameLoopInterval = null;


// Rapfiにコマンドを送る処理


// Rapfi WASM起動完了を待つ (タイムアウト延長)
function logEngineStatus(status) {
    const progress = parseEngineDownloadStatus(status);
    if (progress) {
        if (progress.pct > lastEngineDownloadPct || progress.loaded >= progress.total) {
            lastEngineDownloadPct = progress.pct;
            if (DEBUG_MODE) console.log('[Engine status]', status);
        }
        return;
    }

    if (shouldResetDownloadProgress(status)) lastEngineDownloadPct = -1;
    if (DEBUG_MODE) console.log('[Engine status]', status);
}


// 確実にエンジンを起動し、その「世代」が維持されたまま準備完了したかを保証する


function markThinkEngineOutput(kind, line) {
    if (!thinkDebugState) return;
    if (kind === "pv") thinkDebugState.hasPv = true;
    if (kind === "move") thinkDebugState.hasMove = true;
    thinkDebugState.lastOutputAt = performance.now();
    thinkDebugState.lastLine = line;
}

function clearThinkDebugTimer() {
    if (thinkDebugTimer) {
        clearTimeout(thinkDebugTimer);
        thinkDebugTimer = null;
    }
}

function startThinkDebug(label, boardMoves, nbest, timeLeft) {
    clearThinkDebugTimer();
    thinkSequence += 1;
    thinkDebugState = {
        id: thinkSequence,
        label,
        boardMoves,
        nbest,
        timeLeft,
        commands: [],
        hasPv: false,
        hasMove: false,
        startedAt: performance.now(),
        searchCommandSentAt: null,
        lastOutputAt: null,
        lastLine: null
    };
    if (DEBUG_MODE) console.log(`[Think DEBUG #${thinkDebugState.id}] start label=${label} stones=${boardMoves} nbest=${nbest} timeLeft=${timeLeft}`);
    thinkDebugTimer = setTimeout(() => {
        if (!thinkDebugState || thinkDebugState.id !== thinkSequence) return;
        if (!thinkDebugState.hasPv && !thinkDebugState.hasMove) {
            const elapsed = (performance.now() - thinkDebugState.startedAt).toFixed(0);
            const afterSearch = thinkDebugState.searchCommandSentAt
                ? (performance.now() - thinkDebugState.searchCommandSentAt).toFixed(0)
                : "not-sent";
            if (DEBUG_MODE) console.warn(`[Think DEBUG #${thinkDebugState.id}] no search output after ${elapsed}ms (after YXNBEST=${afterSearch}ms). commands=${thinkDebugState.commands.join(" | ")}`);
            broadcastLog(`[DEBUG] No engine PV/bestmove yet. stones=${thinkDebugState.boardMoves}, nbest=${thinkDebugState.nbest}, afterYXNBEST=${afterSearch}ms`);
            if (DEBUG_MODE) console.warn(`[Research DEBUG] state after no-output: research=${isResearchMode}, busy=${engineRuntime.getIsBusy()}, threads=${engineRuntime.getSupportsThreads()}, ios=${engineRuntime.getIsIOS()}, boardKey=${GameState.getBoardKey()}`);
        }
    }, 2000);
}

function finishThinkDebug(reason) {
    if (thinkDebugState) {
        if (DEBUG_MODE) console.log(`[Think DEBUG #${thinkDebugState.id}] finish reason=${reason} hasPv=${thinkDebugState.hasPv} hasMove=${thinkDebugState.hasMove} last="${thinkDebugState.lastLine || ""}"`);
    }
    clearThinkDebugTimer();
    thinkDebugState = null;
}

function broadcastEngineLine(line, lineInfo) {
    if (isAnalysisRunning()) {
        if (lineInfo.isMultiPVLine || lineInfo.isStandardMessage || lineInfo.isError || lineInfo.isBestMove) {
            broadcastLog('[AI Raw] ' + formatMoveWithNotation(line));
        }
        return;
    }

    if (lineInfo.hasPv) {
        broadcastLog('[AI PV] ' + line);
    } else if (!line.startsWith('INFO')) {
        const displayLine = formatMoveWithNotation(line, true);
        broadcastLog('[AI Raw] ' + displayLine);
    }
}



function handleEngineMoveCommand(moveMatch, wasEngineBusy) {
    if (!moveMatch) return;

    markThinkEngineOutput("move", moveMatch[0]);
    const mx = parseInt(moveMatch[1], 10);
    const my = parseInt(moveMatch[2], 10);
    if (hasPendingAnalysisResult(analysisState)) {
        clearAnalysisTimeout();
        resolveAnalysisFromMove(analysisState, mx, my);
    } else if (
        !isAnalysisRunning() &&
        isRapfiThinking &&
        engineRuntime.getIsReady() &&
        wasEngineBusy && !isResearchMode && !isAnalysisRunning()
    ) {
        if (isHumanStyle) {
            const sel = selectHumanLikeMove(SearchState.getCurrentCandidates(), mx, my);
            const tx = sel ? sel.x : mx;
            const ty = sel ? sel.y : my;
            if (sel) SearchState.setCurrentLastEval((aiColorGlobal === 2) ? -sel.score : sel.score);
            handleRapfiMove(tx, ty);
        } else {
            const sel = selectLowStrengthMove(mx, my);
            if (sel && sel.score !== undefined) {
                SearchState.setCurrentLastEval((aiColorGlobal === 2) ? -sel.score : sel.score);
            }
            handleRapfiMove(sel.x, sel.y);
        }
    }
}

function resolveAnalysisOnBestMove(lineInfo) {
    if (!lineInfo.isBestMove || !hasPendingAnalysisResult(analysisState)) return false;
    clearAnalysisTimeout();
    resolveAnalysisFromBestMove(analysisState);
    return true;
}

function schedulePendingIOSResearch() {
    if (!engineRuntime.getIsIOS() || engineRuntime.getSupportsThreads() || !isResearchMode || engineRuntime.getIsBusy() || !ResearchSessionState.getPendingIOSResearchReason()) return;
    const reason = ResearchSessionState.getPendingIOSResearchReason();
    ResearchSessionState.setPendingIOSResearchReason("");
    setTimeout(() => {
        if (isResearchMode && !engineRuntime.getIsBusy()) {
            startResearchSession(`ios-pending:${reason}`);
        } else if (isResearchMode && engineRuntime.getIsIOS() && !engineRuntime.getSupportsThreads()) {
            ResearchSessionState.setPendingIOSResearchReason(reason);
        }
    }, 0);
}

function processEngineLine(line) {
    line = line.trim();
    if (!line) return;

    const wasEngineBusy = engineRuntime.getIsBusy();

    // まず行の種類を判定する
    const lineInfo = classifyEngineLine(line);
    const {
        isBestMove,
        isMoveCommand,
        hasPv,
        isSearchOutput,
        isInformational,
        isWarning,
        isFatalLikeError
    } = lineInfo;


    // デバッグ用：WASMから受け取った生データ
    if (DEBUG_MODE) console.log(`[AppCore DEBUG] processEngineLine received: "${line}"`);

    if (isInformational) {
        if (DEBUG_MODE) console.log(`[AppCore DEBUG] Engine informational: ${line}`);
    }
    if (isWarning) {
        broadcastLog('[Warning] ' + line);
    }
    if (isFatalLikeError) {
        broadcastLog('[ERROR] ' + line);
    }

    if (isResearchMode && !engineRuntime.getIsBusy() && isSearchOutput) {
        if (DEBUG_MODE) console.log(`[Research DEBUG] ignored stale engine output: "${line}"`);
        return;
    }

    if (isBestMove || isMoveCommand) {
        
        const becameIdle = engineRuntime.markIdleAfterSearchOutput();
        if (becameIdle) schedulePendingIOSResearch();

    }

    if (isInitializingEngine) return;

    broadcastEngineLine(line, lineInfo);

    if (isAnalysisRunning() || isGameRunning || isResearchMode) {
        const pvData = parsePvSearchLine(line, GameState.getMoveHistory(), GameState.getNextColor());
        if (pvData) {
            if (pvData.moveCoords) {
                markThinkEngineOutput("pv", line);
                SearchState.applySearchStateFromPv(pvData);
            } else if (hasPv && !line.startsWith('INFO')) {
                if (DEBUG_MODE) console.log(`[Think DEBUG] non-PV engine status ignored for PV tracking: "${line}"`);
            }
            if (isResearchMode) {
                const accepted = pvData.moveCoords && ResearchSessionState.isValidResearchSession(undefined, GameState.getBoardKey());
                if (accepted) {
                    const turnColor = GameState.getNextColor();
                    const blackScore = (turnColor === 2) ? -pvData.score : pvData.score;
                    ResearchSessionState.updateResearchPV(pvData.rank, {
                        rank: pvData.rank, depth: pvData.depth,
                        x: pvData.moveCoords.x, y: pvData.moveCoords.y,
                        score: pvData.score, blackScore: blackScore, rawScore: pvData.score,
                        turnColor: turnColor, scoreView: "side-to-move", pv: pvData.movesStr
                    }, (updates) => {
                        for (const data of updates) sendToRenderer('research_update', data);
                    });
                }
            }
            if (isAnalysisRunning()) return;
        }

        if (resolveAnalysisOnBestMove(lineInfo)) return;
    }

    const scoreVal = parseInlineEvalScore(line);
    if (scoreVal !== null && !isNaN(scoreVal)) {
        SearchState.setCurrentLastEval((aiColorGlobal === 2) ? -scoreVal : scoreVal);
    }

    handleEngineMoveCommand(lineInfo.moveMatch, wasEngineBusy);
}



// Rapfiの手番管理
function handleRapfiMove(x, y) {
    if (!isGameRunning) return;

    finishThinkDebug("move-applied");
    isRapfiThinking = false;
    const rapfiColor = GameState.getNextColor();
    const activeTimer = (isAiVsAi && rapfiColor === 1) ? playerTimer : rapfiTimer;

    if (activeTimer) {
        const hasTimeLeft = activeTimer.stop();
        if (!hasTimeLeft) {
            terminateByTimeout('あなた');
            return;
        }
    }

    if (!GameState.applyMoveTransaction(x, y, rapfiColor)) {
        console.error(`\x1b[31m[FATAL] Transaction aborted: Cell ${x},${y} [${toNotation(x, y)}] is invalid or already occupied.\x1b[0m`);
        return;
    }
    GameState.pushEvalHistory({ move: GameState.getMoveHistory().length, score: SearchState.getCurrentLastEval() || 0 });

    const currentAiTime = rapfiTimer ? rapfiTimer.getCurrentRemaining() : 0;
    const currentPlayerTime = playerTimer ? playerTimer.getCurrentRemaining() : 0;
    const timeStr = ((activeTimer ? activeTimer.getCurrentRemaining() : currentAiTime) / 1000).toFixed(1);

    if (DEBUG_MODE) console.log(`\x1b[32m[MOVE]\x1b[0m ${toNotation(x, y)} (${rapfiColor === 1 ? '黒' : '白'}) \x1b[33m[Time: ${timeStr}s]\x1b[0m`);

    sendToRenderer('move', {
        x, y, color: rapfiColor, isAI: true, aiTime: currentAiTime, playerTime: currentPlayerTime
    });

    SearchState.resetSearchState({ resetPv: false });
    if (GameState.checkWin(x, y, rapfiColor)) {
        terminateGame(isAiVsAi ? (rapfiColor === 1 ? '黒番AI' : '白番AI') : 'Rapfi');
    } else if (currentMaxMoves > 0 && GameState.getMoveHistory().length >= currentMaxMoves) {
        terminateGame('Draw');
    } else {
        if (isAiVsAi) {
            const nextColor = GameState.getNextColor();
            aiColorGlobal = nextColor;
            if (nextColor === 1) {
                if (rapfiTimer) rapfiTimer.stop();
                if (playerTimer) playerTimer.start();
            } else {
                if (playerTimer) playerTimer.stop();
                if (rapfiTimer) rapfiTimer.start();
            }
            isRapfiThinking = true;
            syncAndThink(nextColor);
        } else if (playerTimer) {
            playerTimer.start();
        }
    }
}

// バグで落ちた時に復帰させる関数
async function recoverGameSession() {
    if (!isGameRunning || gameEnded) return;
    engineRuntime.start();
    await delay(1000);
    console.log("[RECOVERY] 設定と盤面を復元中...");
    sendEngineConfig();
    sendToEngine(`START ${BOARD_SIZE}`);
    sendToEngine(createYXBoardCommand(GameState.getMoveHistory()));
    if (isRapfiThinking) {
        console.log("[RECOVERY] 思考を再開させます");
        broadcastLog("INFO: Resuming AI thinking...");
        syncAndThink(aiColorGlobal);
    } else {
        console.log("[RECOVERY] 待機状態へ復帰しました");
        broadcastLog("INFO: Engine restored. Waiting for your move.");
    }
}

function sendEngineConfig() {
    const es = lastEngineSettings || {};
    createGameConfigCommands(es, getEngineThreadCount(es.threads)).forEach(cmd => sendToEngine(cmd));
}

async function initializeGameSession() {
    sendEngineConfig();
    sendToEngine(`START ${BOARD_SIZE}`);
    
    isInitializingEngine = true;
    if (DEBUG_MODE) console.log("[AppCore DEBUG] Triggering dummy search for engine initialization...");
    engineRuntime.setBusy(true);
    sendToEngine(`INFO TIME_LEFT 1`);
    sendToEngine(`INFO TIMEOUT_TURN 1`);
    sendToEngine('YXBOARD\nDONE');
    sendToEngine('YXNBEST 1');
    
    let waitTime = 0;
    while (engineRuntime.getIsBusy() && waitTime < 15000) {
        await delay(100);
        waitTime += 100;
    }
    isInitializingEngine = false;
    if (DEBUG_MODE) console.log(`[AppCore DEBUG] Engine initialization finished after ${waitTime}ms.`);
}

async function initializeResearchSession() {
    const es = lastEngineSettings || {};
    createResearchConfigCommands(es, {
        threadCount: getEngineThreadCount(getResearchThreadCount(es.threads)),
        hashSize: getResearchHashSize(es.hashSize)
    }).forEach(cmd => sendToEngine(cmd));
    sendToEngine(`START ${BOARD_SIZE}`);
    await delay(300);
}

async function syncAndThink(aiColor) {
    if (!engineRuntime.getIsReady()) {
        if (DEBUG_MODE) console.log('[AppCore DEBUG] syncAndThink skipped because engineRuntime.getIsReady() is false');
        return;
    }
    if (!rapfiTimer) return;
    const activeTimer = (isAiVsAi && aiColorGlobal === 1) ? playerTimer : rapfiTimer;
    if (!activeTimer) return;

    await engineRuntime.ensureIdle();

    SearchState.resetSearchState();

    const timeLeft = Math.floor(activeTimer.getCurrentRemaining());
    const configuredMarginMs = Number(gameThinkTimeConfig.turnTimeMarginMs);
    const configuredPercent = Number(gameThinkTimeConfig.turnTimePercent);
    const marginMs = Math.max(0, Number.isFinite(configuredMarginMs) ? configuredMarginMs : 500);
    const percent = Math.min(100, Math.max(1, Number.isFinite(configuredPercent) ? configuredPercent : 20));
    const timeoutTurn = gameThinkTimeConfig.timeRule === 'perMove'
        ? Math.max(1, Math.floor(activeTimer.initialMs - marginMs))
        : Math.max(1, Math.floor((timeLeft * percent / 100) - marginMs));

    startThinkDebug("game", GameState.getMoveHistory().length, currentNBest, timeLeft);
    
    // Config and START are now sent only once per game initialization
    
    createTurnTimeCommands({
        timeLeft: gameThinkTimeConfig.timeRule === 'perMove' ? 0 : timeLeft,
        timeoutTurn,
        increment: activeTimer.incrementMs
    }).forEach(cmd => sendToEngine(cmd));

    sendToEngine(createYXBoardCommand(GameState.getMoveHistory()));
    
    sendToEngine(`YXNBEST ${currentNBest}`);
    engineRuntime.setBusy(true);
}

// 研究モード開始用関数


async function startResearchSession(reason = "manual") {
    if (!isResearchMode) return;
    const sessionId = ResearchSessionState.startNewResearchSession(GameState.getBoardKey());

    // We no longer restart the engine. If it's busy, the old search result will be 
    // discarded via activeThinkSessionId mismatch. The new commands will queue.
    if (engineRuntime.getIsStarting()) {
        await delay(50);
    }

    resetResearchBuffers();
    finishThinkDebug("research-restart");

    const nbest = currentNBest || 5;

    const ready = await engineRuntime.ensureReady();
    if (!ready) {
        if (DEBUG_MODE) console.error(`[Research DEBUG #${sessionId}] engine ready timeout or generation mismatch`);
        return;
    }
    if (!isResearchMode || sessionId !== ResearchSessionState.getResearchSessionSeq()) {
        if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] stale session skipped`);
        return;
    }

    if (!engineRuntime.getSupportsThreads() && engineRuntime.getIsIOS() && engineRuntime.getIsBusy()) {
        ResearchSessionState.setPendingIOSResearchReason(reason);
        if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] iOS single-thread engine is busy; queued latest research position until current search finishes.`);
        return;
    }

    const latestMoves = GameState.applyMoveHistory(GameState.getMoveHistory(), `research:${reason}`);
    ResearchSessionState.setCurrentResearchBoardKey(createMoveHistoryKey(latestMoves));
    const prepared = await prepareResearchEngine({
        engineRuntime,
        sendToEngine,
        initializeResearchSession,
        delay,
        sessionId,
        reason
    });
    if (!prepared) return;

    const researchTimeout = getResearchTimeout({
        supportsThreads: engineRuntime.getSupportsThreads(),
        isIOS: engineRuntime.getIsIOS(),
        iosTimeoutMs: IOS_RESEARCH_TIMEOUT_MS
    });

    logResearchBoardForEngine({
        sessionId,
        reason,
        moves: latestMoves,
        toNotation
    });
    startThinkDebug(`research:${reason}`, latestMoves.length, nbest, researchTimeout);

    sendResearchSearchCommand({
        moves: latestMoves,
        nbest,
        researchTimeout,
        sendToEngine,
        engineRuntime
    });
}

// 棋譜解析の処理(一手分の解析、全ての手が終わるまで繰り返す)
function saveGameRecord(winner) {
    try {
        const record = createGameRecord({
            winner,
            isAiVsAi,
            aiColor: aiColorGlobal,
            moveHistory: GameState.getMoveHistory(),
            evalHistory: GameState.getEvalHistory()
        });
        appendGameRecord(record);
    } catch (e) { console.error("保存エラー:", e); }
}

function updateGameRecordEvals(targetRecordId, newEvals) {
    try {
        return updateGameRecordEvalsById(targetRecordId, newEvals);
    } catch(e) { return false; }
}

function stopGameTimers() {
    stopGameSessionTimers(createGameSessionContext());
}

function stopGameLoop() {
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
    }
}

function sendHistoryList() {
    sendToRenderer('history_list', loadGameRecordsNewestFirst());
}

function applyResearchSettings(nbest, threads, hashSize) {
    if (nbest) currentNBest = nbest;
    applyResearchEngineSettings({ threads, hashSize });
}


function scheduleResearchAction(reason, debounceDelay, staleLog = "") {
    ResearchSessionState.scheduleResearchAction(debounceDelay, () => {
        if (!isResearchMode) {
            if (staleLog) console.log(staleLog);
            return;
        }
        startResearchSession(reason);
    });
}



function stopResearchModeSession() {
    if (DEBUG_MODE) console.log("\x1b[36m[SYSTEM] 研究モード終了\x1b[0m");
    ResearchSessionState.stopResearchSession();
    sendToEngine("YXSTOP");
    engineRuntime.setBusy(false);
}


function finishGameAfterPlayerMoveIfNeeded(x, y, color) {
    if (isGameRunning && !gameEnded && GameState.checkWin(x, y, color)) {
        if (playerTimer) playerTimer.stop();
        terminateGame('あなた');
        return true;
    }
    if (isGameRunning && !gameEnded && currentMaxMoves > 0 && GameState.getMoveHistory().length >= currentMaxMoves) {
        if (playerTimer) playerTimer.stop();
        terminateGame('Draw');
        return true;
    }
    return false;
}

function createGameSessionContext() {
    return {
        engineRuntime,
        sendToEngine,
        sendToRenderer,
        broadcastLog,
        initializeGameSession,
        syncAndThink,
        terminateGame,
        terminateByTimeout,
        finishGameAfterPlayerMoveIfNeeded,
        clearGameActionTimer,
        bumpGameActionSeq: () => { gameActionSeq++; },
        stopAnalysisSession,
        getPlayerTimer: () => playerTimer,
        setPlayerTimer: (timer) => { playerTimer = timer; },
        getRapfiTimer: () => rapfiTimer,
        setRapfiTimer: (timer) => { rapfiTimer = timer; },
        getGameRunning: () => isGameRunning,
        setGameRunning: (value) => { isGameRunning = value; },
        getGameEnded: () => gameEnded,
        setGameEnded: (value) => { gameEnded = value; },
        getAiColorGlobal: () => aiColorGlobal,
        setAiColorGlobal: (value) => { aiColorGlobal = value; },
        getGlobalPlayerColor: () => globalPlayerColor,
        setGlobalPlayerColor: (value) => { globalPlayerColor = value; },
        getAiVsAi: () => isAiVsAi,
        setAiVsAi: (value) => { isAiVsAi = value; },
        setCurrentMaxMoves: (value) => { currentMaxMoves = value; },
        setCurrentNBest: (value) => { currentNBest = value; },
        setHumanStyle: (value) => { isHumanStyle = value; },
        setCurrentBlunderThreshold: (value) => { currentBlunderThreshold = value; },
        setCurrentBlunderRate: (value) => { currentBlunderRate = value; },
        setCurrentMissMateRate: (value) => { currentMissMateRate = value; },
        getRapfiThinking: () => isRapfiThinking,
        setRapfiThinking: (value) => { isRapfiThinking = value; },
        setLastEngineSettings: (value) => { lastEngineSettings = value; },
        setIntentionalKill: (value) => { isIntentionalKill = value; },
        setCrashRetryCount: (value) => { crashRetryCount = value; },
        getAnalyzing: () => isAnalysisRunning(),
        setAnalyzing: setAnalysisRunning,
        setResearchMode: (value) => { isResearchMode = value; }
    };
}

function createAnalysisContext() {
    return {
        trace,
        engineRuntime,
        sendToEngine,
        sendToRenderer,
        finishThinkDebug,
        delay,
        setResearchMode: (value) => { isResearchMode = value; },
        setGameRunning: (value) => { isGameRunning = value; },
        setAnalyzing: setAnalysisRunning
    };
}

function clearGameActionTimer() {
    if (gameActionTimer) {
        clearTimeout(gameActionTimer);
        gameActionTimer = null;
    }
}

function scheduleGameAction(callback, debounceDelay) {
    const currentSeq = ++gameActionSeq;
    clearGameActionTimer();

    gameActionTimer = setTimeout(async () => {
        if (!isGameRunning || gameEnded || gameActionSeq !== currentSeq) return;
        lastGameActionTime = performance.now();
        await callback(currentSeq);
    }, debounceDelay);
}

function stopAnalysisSession({ stopEngine = false } = {}) {
    stopAnalysisSessionState(analysisState, createAnalysisContext(), { stopEngine });
}

function terminateGame(winnerName) {
    stopGameTimers();
    stopGameLoop();
    const isDraw = winnerName === 'Draw';
    console.log(`\x1b[31m[GAME OVER]\x1b[0m ${isDraw ? '引き分け' : '勝者: ' + winnerName}`);
    isIntentionalKill = false; isGameRunning = false; gameEnded = true; isRapfiThinking = false;
    saveGameRecord(winnerName);
    const isManual = winnerName === 'ManualEnd';
    sendToRenderer('game_over', { reason: isDraw ? 'draw' : (isManual ? 'manual' : 'win'), winner: winnerName });
    sendToRenderer('show_graph', GameState.getEvalHistory());
    sendToRenderer('analysis_mode_started');
    try { sendHistoryList(); } catch(e) {}
}

function terminateByTimeout(winnerName) {
    stopGameTimers();

    if (!isGameRunning) return;
    stopGameLoop();
    console.log(`\x1b[31m[TIMEOUT]\x1b[0m 勝者: ${winnerName}`);
    isIntentionalKill = false; isGameRunning = false; gameEnded = true; isRapfiThinking = false;
    saveGameRecord(winnerName);
    sendToRenderer('game_over', { reason: 'timeout', winner: winnerName });
    sendToRenderer('show_graph', GameState.getEvalHistory());
    sendToRenderer('analysis_mode_started');
    try { sendHistoryList(); } catch(e) {}
}

const cleanup = () => {
    engineRuntime.discard("terminate");
};

// ---------------------------------------------------------
// IPC 通信 (htmlから送られてきたものを受信する一連の処理)
// ---------------------------------------------------------

window.backendAPI_request_history = function() {
    try {
        if (hasStoredGameRecords()) {
            sendHistoryList();
        }
    } catch(e) { console.error(e); }
};

// 特に研究モード時で候補手数を変更したとき即反映させたくて追記した
window.backendAPI_update_engine_setting = function(data) {
    if (data.name === 'MultiPV') {
        currentNBest = data.value;
    }

    if (isResearchMode) {
        startResearchSession(`setting:${data.name || "unknown"}`);
    }
};

window.backendAPI_load_game_record = function(recordId) {
    try {
        const target = findGameRecordById(recordId);
        if (target) {
            console.log(`Loading record: ${target.title}`);
            sendToRenderer('load_record_data', { id: target.id, moves: target.moves, evals: target.evals || [] });
        } else {
            console.warn(`Record not found for ID: ${recordId}`);
        }
    } catch (e) { console.error(e); }
};

window.backendAPI_delete_game_record = function(recordId) {
    try {
        const newJson = deleteGameRecordById(recordId);
        sendToRenderer('history_list', newJson.reverse());
    } catch (e) { console.error(e); }
};

window.backendAPI_analyze_game = function(data) {
    startAnalysisSession(analysisState, createAnalysisContext(), data);
};

window.backendAPI_save_analysis_result = function(data) {
    if (data.recordId) {
        updateGameRecordEvals(data.recordId, data.evals);
        try { sendHistoryList(); } catch(e) {}
    }
};

window.backendAPI_save_quiz_list = function(quizList) {
    try { saveQuizList(quizList); } catch(e) {}
};

window.backendAPI_request_quiz_list = function() {
    try {
        const quizData = loadQuizList();
        if (quizData) { sendToRenderer('quiz_list_data', quizData); }
    } catch (e) { console.error(e); }
};

window.backendAPI_start_game = function(data) {
    const requestedPercent = Number(data.turnTimePercent ?? data.engineSettings?.turnTimePercent);
    const requestedMarginMs = Number(data.turnTimeMarginMs ?? data.engineSettings?.turnTimeMarginMs);
    gameThinkTimeConfig = {
        timeRule: data.timeRule === 'perMove' ? 'perMove' : 'normal',
        turnTimePercent: Math.min(100, Math.max(1, Number.isFinite(requestedPercent) ? requestedPercent : 20)),
        turnTimeMarginMs: Math.max(0, Number.isFinite(requestedMarginMs) ? requestedMarginMs : 500)
    };
    startGameSession(createGameSessionContext(), data);
};

window.backendAPI_research_sync = async function(history, nbest, threads, hashSize) {
    if (!isResearchMode) return;

    applyResearchSettings(nbest, threads, hashSize);
    GameState.applyMoveHistory(history, "research_sync");

    if (DEBUG_MODE) {
        console.log(`[Research] 盤面同期 (${history.length}手)。プロセスを維持して再解析します。`);
    }

    startResearchSession("sync");
};

// プレイヤー着手処理
// --- 【修正③】async 関数に変更 ---
window.backendAPI_player_move = async function(move) {
    await handleGamePlayerMove(createGameSessionContext(), move);
};


async function takebackPlayerMove(reason = "player takeback") {
    return takebackGamePlayerMove(createGameSessionContext(), reason);
}


window.backendAPI_undo_move = function() {
    if (isGameRunning && !gameEnded && !isAiVsAi) {
        takebackPlayerMove("game undo");
        return;
    }

    if (GameState.getMoveHistory().length === 0) return;

    // UIの即時反映
    GameState.popLastMove();
    GameState.rebuildBoardFromHistory(); // popした後の履歴から正しい盤面を完全再構築
    GameState.popEvalHistory();
    sendToRenderer('undo_result', { moveHistory: GameState.getMoveHistory() });

    if (!isGameRunning || gameEnded) return;

    // シーケンス管理と Adaptive Debounce
    const now = performance.now();
    const debounceDelay = (now - lastGameActionTime > 500) ? 30 : 150;

    scheduleGameAction(async (currentSeq) => {
        if (engineRuntime.getIsStarting()) {
            await delay(20);
        }

        const nextColor = GameState.getNextColor();
        const isAiTurn = (nextColor === aiColorGlobal);
        isRapfiThinking = false;

        if (!isAiTurn && !isAiVsAi) {
            // プレイヤー手番への復帰
            if (rapfiTimer) rapfiTimer.stop();
            if (playerTimer) {
                playerTimer.stop();
                playerTimer.start();
            }
            console.log(`[Game DEBUG] Undo to player turn.`);
            return;
        }

        console.log(`[Game DEBUG] Undo to AI turn. Restarting engine...`);
        
        // --- カプセル化された起動と二重ガード ---
        const ready = await engineRuntime.ensureReady();
        if (!ready) return; // タイムアウト、または別操作で世代が進んだ場合は安全に中断

        // 念のための UIシーケンス最終確認
        if (gameActionSeq !== currentSeq) return;

        // 思考の明示的な再開
        isRapfiThinking = true;
        if (playerTimer) playerTimer.stop();
        if (rapfiTimer) {
            rapfiTimer.stop();
            rapfiTimer.start();
        }

        syncAndThink(aiColorGlobal);
    }, debounceDelay);
};

window.backendAPI_takeback_move = async function() {
    await takebackPlayerMove("player takeback");
};

window.backendAPI_finish_game = function() {
    finishGameSession(createGameSessionContext());
};

// 研究モード切り替え
window.backendAPI_toggle_research = function(enabled, nbest, threads, hashSize) {
    isResearchMode = enabled;
    isGameRunning = false;
    isRapfiThinking = false;
    ResearchSessionState.stopResearchSession();

    if (isAnalysisRunning()) {
        stopAnalysisSession({ stopEngine: true });
    }

    if (isResearchMode) {
        applyResearchSettings(nbest, threads, hashSize);
        if (DEBUG_MODE) console.log(`\x1b[36m[SYSTEM] 研究モード開始 (MultiPV: ${currentNBest})\x1b[0m`);
    } else {
        stopResearchModeSession();
    }
};

// 研究モード中の着手（盤面更新）
window.backendAPI_research_click = function(move) {
    if (!isResearchMode) return;

    const x = parseInt(move.x);
    const y = parseInt(move.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !isInsideBoard(x, y)) {
        if (DEBUG_MODE) console.warn(`[Research DEBUG] click ignored invalid coordinate: ${JSON.stringify(move)}`);
        broadcastLog(`[DEBUG] Research click ignored invalid coordinate: ${JSON.stringify(move)}`);
        return;
    }

    if (GameState.getServerBoard()[y][x] === 0) {
        const color = GameState.getNextColor();
        if (!GameState.applyMoveTransaction(x, y, color)) {
            return;
        }
        
        // --- Adaptive Debounce ---
        const now = performance.now();
        const debounceDelay = (now - ResearchSessionState.getLastResearchActionTime() > 500) ? 10 : 30;
        scheduleResearchAction("click", debounceDelay, "[Research DEBUG] Debounced click ignored due to state change");
    } else {
        if (DEBUG_MODE) console.warn(`[Research DEBUG] click ignored occupied coordinate: ${x},${y} [${toNotation(x, y)}]`);
    }
};

// 研究モード中の「待った」
window.backendAPI_research_undo = function() {
    if (!isResearchMode || GameState.getMoveHistory().length === 0) return;
    GameState.popLastMove();
    GameState.rebuildBoardFromHistory(); // 変更
    
    sendToRenderer('undo_result', { moveHistory: GameState.getMoveHistory() });
    
    // --- Adaptive Debounce ---
    const now = performance.now();
    const debounceDelay = (now - ResearchSessionState.getLastResearchActionTime() > 500) ? 30 : 150;
    scheduleResearchAction("undo", debounceDelay);
};

// ---------------------------------------------------------
// AI ロジック
// ---------------------------------------------------------

function selectLowStrengthMove(defaultX, defaultY) {
    if (!SearchState.getCurrentCandidates() || SearchState.getCurrentCandidates().length === 0) return { x: defaultX, y: defaultY };
    let validCandidates = SearchState.getCurrentCandidates().filter(c => c !== undefined && c !== null);
    if (validCandidates.length === 0) return { x: defaultX, y: defaultY };
    validCandidates.sort((a, b) => b.score - a.score);
    const bestMove = validCandidates[0];
    const bestScore = bestMove.score;

    if (currentMissMateRate > 0) {
        const mateThresholdScore = 30000 - currentMissMateRate;
        const isLongMate = (s) => s > 20000 && s <= mateThresholdScore;
        if (validCandidates.some(c => isLongMate(c.score))) {
            const nonLongMateMoves = validCandidates.filter(c => !isLongMate(c.score));
            if (nonLongMateMoves.length > 0) {
                validCandidates = nonLongMateMoves;
                console.log(`[LowLevel AI] Missed long mate (M${currentMissMateRate}+).`);
            }
        }
    }

    const isBlunderTurn = (Math.random() * 100 < currentBlunderRate);
    if (isBlunderTurn && bestScore > -100) {
        const blunderMoves = SearchState.getCurrentCandidates().filter(c => {
            const diff = bestScore - c.score;
            return diff >= 300 && c.score > -16000;
        });
        if (blunderMoves.length > 0) {
            const blunderMove = blunderMoves[Math.floor(Math.random() * blunderMoves.length)];
            broadcastLog(`\x1b[31m[LowLevel AI] 😱 BLUNDER TRIGGERED! (Rate: ${currentBlunderRate}%)\x1b[0m Selected: ${blunderMove.score}`);
            return blunderMove;
        }
    }

    let filtered = validCandidates.filter(c => c.score > currentBlunderThreshold);
    if (filtered.length === 0) {
        const fallbackMove = createDefaultEngineMove(defaultX, defaultY, validCandidates);
        const scoreText = fallbackMove.score !== undefined ? fallbackMove.score : "unknown";
        console.log(`\x1b[33m[LowLevel AI]\x1b[0m All candidates below threshold. Selected engine move: ${toNotation(defaultX, defaultY)} Score=${scoreText}`);
        return fallbackMove;
    }
    const naturalMoves = filtered.filter(c => {
        const makesFour = checksFourOnBoard(GameState.getServerBoard(), c.x, c.y, aiColorGlobal);
        if (makesFour && (bestScore - c.score >= 30)) return false;
        return true;
    });
    if (naturalMoves.length > 0) filtered = naturalMoves;
    const randomIndex = Math.floor(Math.random() * filtered.length);
    const selected = filtered[randomIndex];
    const moveStr = toNotation(selected.x, selected.y);
    const pvString = (selected.pv && selected.pv.length > 0) ? selected.pv.join(" ") : "";
    broadcastLog(`\x1b[36m[LowLevel AI]\x1b[0m Random Select: ${moveStr} (Score: ${selected.score}) PV: ${pvString}`);
    return selected;
}

// HTML側「人間の強豪らしい打ち筋」の設定内容
function selectHumanLikeMove(candidates, defaultX, defaultY) {
    if (!candidates || candidates.length === 0) return { x: defaultX, y: defaultY };

    const sorted = [...candidates].filter(c => c !== undefined && c !== null).sort((a, b) => b.score - a.score);
    if (sorted.length === 0) return { x: defaultX, y: defaultY };
    let best = sorted[0];

    if (best.score >= 29970) {
        console.log(`[HumanStyle] Short Mate found. Executing best move.`); return best;
    }
    if (GameState.getMoveHistory().length < 20) {
        if (sorted.length >= 2) {
            const second = sorted[1];
            if ((best.score - second.score) >= 100) {
                console.log(`[HumanStyle-Opening] Best move is dominant. Selected Best.`); return best;
            } else {
                const selected = (Math.random() < 0.5) ? second : best;
                console.log(`[HumanStyle-Opening] Random selection. Selected: ${selected === second ? "2nd" : "Best"}`); return selected;
            }
        } else return best;
    }

    const isLongMate = (s) => s > 20000 && s <= 29969;
    let filtered = [...sorted];
    if (sorted.some(c => isLongMate(c.score))) {
        const nonMateMoves = sorted.filter(c => c.score <= 20000);
        if (nonMateMoves.length > 0) filtered = nonMateMoves;
    }

    const currentBestScore = filtered[0].score;
    const rate = (currentBlunderRate > 0) ? currentBlunderRate : 2;
    if ((Math.random() * 100 < rate) && currentBestScore > -100) {
        const blunderMoves = filtered.filter(c => {
            const diff = currentBestScore - c.score;
            return diff >= 300 && c.score <= currentBlunderThreshold && c.score > -16000;
        });
        if (blunderMoves.length > 0) {
            const blunderMove = blunderMoves[Math.floor(Math.random() * blunderMoves.length)];
            broadcastLog(`\x1b[31m[HumanStyle] 😱 BLUNDER TRIGGERED! (Rate: ${rate}%)\x1b[0m Selected: ${blunderMove.score}`);
            return blunderMove;
        }
    }

    let safeMoves = filtered.filter(c => {
        const diff = currentBestScore - c.score;
        return !(diff >= 300 && c.score <= currentBlunderThreshold);
    });
    if (safeMoves.length === 0) {
        const fallbackMove = createDefaultEngineMove(defaultX, defaultY, sorted);
        const scoreText = fallbackMove.score !== undefined ? fallbackMove.score : "unknown";
        console.log(`[HumanStyle] All candidates filtered out. Selected engine move: ${toNotation(defaultX, defaultY)} Score=${scoreText}`);
        return fallbackMove;
    }

    const naturalMoves = safeMoves.filter(c => {
        if (safeMoves.length === 1) return true;
        const bestMove = safeMoves[0];
        const bestMakesFour = checksFourOnBoard(GameState.getServerBoard(), bestMove.x, bestMove.y, aiColorGlobal);
        let referenceScore = currentBestScore;
        if (bestMakesFour) {
            const nextNonFourMove = safeMoves.find(m => !checksFourOnBoard(GameState.getServerBoard(), m.x, m.y, aiColorGlobal));
            if (nextNonFourMove) referenceScore = nextNonFourMove.score;
        }
        const cMakesFour = checksFourOnBoard(GameState.getServerBoard(), c.x, c.y, aiColorGlobal);
        if (cMakesFour && (referenceScore - c.score >= 30)) return false;
        return true;
    });
    if (naturalMoves.length > 0) filtered = naturalMoves; else filtered = safeMoves;

    const r = Math.random() * 100;
    let selected = filtered[0];
    let type = "Best(50%)";

    if (r < 50) selected = filtered[0];
    else if (r < 70) {
        if (filtered.length > 1) { selected = filtered[1]; type = "2nd(20%)"; }
        else { selected = filtered[0]; type = "Best"; }
    } else if (r < 90) {
        if (filtered.length > 2) { selected = filtered[2]; type = "3rd(20%)"; }
        else { selected = filtered[0]; type = "Best"; }
    } else {
        const restPool = [];
        for (let i = 3; i < filtered.length; i++) restPool.push({ m: filtered[i], t: `${i+1}th` });
        if (restPool.length > 0) {
            const pick = restPool[Math.floor(Math.random() * restPool.length)];
            selected = pick.m; type = `${pick.t}(10% pool)`;
        } else selected = filtered[0];
    }
    console.log(`[HumanStyle] Selected ${type}. Score: ${selected.score}`);
    return selected;
}

// =========================================================
// ページロード時の初期化
// =========================================================
window.backendAPI_init = function() {
    engineRuntime.ensureReady(); // Preload engine

    try {
        sendHistoryList();
    } catch(e) { console.error('history load error:', e); }
    try {
        const quizzes = loadQuizList();
        if (quizzes) sendToRenderer('quiz_list_data', quizzes);
    } catch(e) { if (DEBUG_MODE) console.error('quiz load error:', e); }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(window.backendAPI_init, 100));
} else {
    setTimeout(window.backendAPI_init, 100);
}
