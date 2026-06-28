/**
 * 一括解析処理のセッション管理モジュール。
 * 
 * 1つの解析セッション（現在解析中の局面から完了まで）の状態を保持し、探索タイムアウトの設定や、エンジンからのPV（読み筋）・スコアの回収を行う。
 * セッションごとの固有IDを用いて、古いセッションの遅延出力による誤作動を防ぐ。
 * 
 * 主な役割:
 * - 解析時の探索深度や時間制限に基づくセッションのライフサイクル管理
 * - 解析完了イベントの発火およびフロントエンドへの結果通知
 */

import { BOARD_SIZE } from '../config/constants.js';
import { createAnalysisQueue } from './queue.js';
import { buildBoardFromMoves, checkWinOnBoard } from '../game/board.js';
import { getNextColorFromHistory, getOpponentColor } from '../game/moves.js';
import { checkForbidden, canOpponentWinNext } from '../game/forbidden.js';
import { createYXBoardCommand } from '../engine/yxboard.js';
import { resetResearchBuffers } from '../research/buffers.js';
import * as SearchState from '../state/search-state.js';

export function createAnalysisState() {
    return {
        isAnalyzing: false,
        timeoutId: null,
        queue: [],
        results: [],
        timePerMove: 1000,
        resolver: null,
        sessionId: 0
    };
}

export function clearAnalysisTimeout(state) {
    if (state.timeoutId) {
        clearTimeout(state.timeoutId);
        state.timeoutId = null;
    }
}

export function resolveAnalysisResult(state, result) {
    if (!state.resolver) return false;
    state.resolver(result);
    state.resolver = null;
    return true;
}

export function hasPendingAnalysisResult(state) {
    return state.isAnalyzing && !!state.resolver;
}

export function resolveAnalysisFromMove(state, x, y) {
    const result = SearchState.getCurrentCandidates().length > 0
        ? SearchState.getCurrentCandidates().filter(c => c !== undefined)
        : [{ x, y, score: SearchState.getCurrentLastEval() || 0 }];
    return resolveAnalysisResult(state, result);
}

export function resolveAnalysisFromBestMove(state) {
    const cleanCandidates = SearchState.getCurrentCandidates().filter(c => c !== undefined);
    return resolveAnalysisResult(state, cleanCandidates);
}

export function stopAnalysisSession(state, ctx, { stopEngine = false } = {}) {
    state.sessionId++;
    clearAnalysisTimeout(state);
    resolveAnalysisResult(state, []);
    state.queue = [];
    state.isAnalyzing = false;
    ctx.setAnalyzing(false);
    if (stopEngine) ctx.sendToEngine("YXSTOP");
}

function getCompletedPositionWinner(board, moves) {
    if (moves.length === 0) return 0;
    const lastMove = moves[moves.length - 1];
    return checkWinOnBoard(board, parseInt(lastMove.x), parseInt(lastMove.y), parseInt(lastMove.color))
        ? lastMove.color
        : 0;
}

function pushCompletedAnalysisResult(state, ctx, item, winner) {
    const finalScore = (winner === 1) ? 30000 : -30000;
    state.results.push({ move: item.moveNum, score: finalScore, bestMove: null, candidates: [], timeMs: 0 });
    ctx.sendToRenderer('analysis_progress', { current: item.moveNum, total: item.total, score: finalScore });
}

function pushForbiddenBlackStopResult(state, ctx, item, forbidden) {
    state.results.push({
        move: item.moveNum,
        score: -30000,
        bestMove: null,
        candidates: [],
        timeMs: 0,
        note: `black forbidden stop after white four${forbidden?.type ? `: ${forbidden.type}` : ''}`
    });
    ctx.sendToRenderer('analysis_progress', { current: item.moveNum, total: item.total, score: -30000 });
}

function getImmediateWinningSpots(board, color) {
    const spots = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (board[y][x] !== 0) continue;
            board[y][x] = color;
            const win = checkWinOnBoard(board, x, y, color);
            board[y][x] = 0;
            if (win) spots.push({ x, y });
        }
    }
    return spots;
}

function getForbiddenBlackStop(board, x, y) {
    if (!board[y] || board[y][x] !== 0) return null;
    board[y][x] = 1;
    const forbidden = checkForbidden(board, x, y);
    board[y][x] = 0;
    return forbidden;
}

function getForbiddenStopAfterWhiteFour(board, currentTurnColor) {
    if (currentTurnColor !== 1) return null;

    const whiteWinningSpots = getImmediateWinningSpots(board, 2);
    if (whiteWinningSpots.length !== 1) return null;

    const stop = whiteWinningSpots[0];
    return getForbiddenBlackStop(board, stop.x, stop.y);
}

function sendAnalysisSetupCommands(ctx, item) {
    ctx.sendToEngine("YXSHOWINFO");
    if (item.threads) ctx.sendToEngine(`INFO thread_num ${item.threads}`);
    if (item.hashSize) ctx.sendToEngine(`INFO hash_size ${item.hashSize}`);
    ctx.sendToEngine("INFO RULE 2");
    ctx.sendToEngine(`START ${BOARD_SIZE}`);
    ctx.sendToEngine("INFO show_detail 3");
}

export async function processAnalysisQueue(state, ctx, sessionId) {
    if (!state.isAnalyzing || state.sessionId !== sessionId) return;

    if (state.queue.length === 0) {
        ctx.trace('SYSTEM', null, 'Analysis Complete');
        clearAnalysisTimeout(state);
        resolveAnalysisResult(state, []);
        if (ctx.engineRuntime.getIsBusy()) ctx.sendToEngine("YXSTOP");
        ctx.engineRuntime.setBusy(false);
        ctx.finishThinkDebug("research-off");
        resetResearchBuffers();
        state.isAnalyzing = false;
        ctx.setAnalyzing(false);
        ctx.sendToRenderer('analysis_complete', state.results);
        return;
    }

    const item = state.queue.shift();
    ctx.trace('STEP', null, `--- Move ${item.moveNum} Start ---`);

    const moveNum = item.moveNum;
    const moves = item.moves;
    const currentTurnColor = getNextColorFromHistory(moves);
    const currentNBestAnalysis = item.nbest || 3;
    const { board: tempBoard } = buildBoardFromMoves(moves);

    const winner = getCompletedPositionWinner(tempBoard, moves);
    if (winner) {
        console.log(`[Analysis Skip] position already completed at move ${moveNum}`);
        pushCompletedAnalysisResult(state, ctx, item, winner);
        processAnalysisQueue(state, ctx, sessionId);
        return;
    }

    const forbiddenStop = getForbiddenStopAfterWhiteFour(tempBoard, currentTurnColor);
    if (forbiddenStop) {
        console.log(`[Analysis Skip] black stop is forbidden after white four at move ${moveNum}. Score set to -30000.`);
        pushForbiddenBlackStopResult(state, ctx, item, forbiddenStop);
        processAnalysisQueue(state, ctx, sessionId);
        return;
    }

    await ctx.engineRuntime.ensureIdle();
    if (!state.isAnalyzing || state.sessionId !== sessionId) return;

    if (!ctx.engineRuntime.getIsReady()) {
        ctx.engineRuntime.start();
        ctx.trace('WAIT', 0, 'Waiting for boot (1000ms)...');
        await ctx.delay(1000);
    } else {
        ctx.sendToEngine("YXSTOP");
    }

    sendAnalysisSetupCommands(ctx, item);
    SearchState.resetSearchState({ resetEval: true });
    ctx.sendToEngine(createYXBoardCommand(item.moves));

    const thinkTime = state.timePerMove;
    ctx.sendToEngine(`INFO time_left 1000000`);
    ctx.sendToEngine(`INFO time_increment 0`);
    ctx.sendToEngine(`INFO timeout_turn ${thinkTime}`);
    ctx.sendToEngine(`YXNBEST ${currentNBestAnalysis}`);
    ctx.engineRuntime.setBusy(true);

    ctx.trace('TIMER', 0, `Measurement Start (Timeout set to ${thinkTime + 5000}ms)`);
    const startTime = performance.now();

    const timeoutMs = thinkTime + 5000;
    const rawCandidates = await new Promise(resolve => {
        state.resolver = resolve;
        state.timeoutId = setTimeout(() => {
            if (state.resolver) {
                ctx.trace('TIMEOUT', 0, 'JS Timeout Fired!');
                const valid = SearchState.getCurrentCandidates()
                    ? SearchState.getCurrentCandidates().filter(c => c !== undefined && c !== null)
                    : [];
                resolveAnalysisResult(state, valid);
                state.timeoutId = null;
                ctx.engineRuntime.setBusy(false);
            }
        }, timeoutMs);
    });
    if (!state.isAnalyzing || state.sessionId !== sessionId) return;

    const elapsedMs = performance.now() - startTime;
    ctx.trace('FINISH', 0, `Move analysis done in ${elapsedMs.toFixed(0)}ms`);

    const candidates = Array.isArray(rawCandidates) ? rawCandidates.filter(c => c) : [];
    let bestMove = null;
    let finalScore = 0;

    const prevRes = state.results.length > 0 ? state.results[state.results.length - 1] : null;
    if (candidates.length > 0) {
        bestMove = candidates[0];
        finalScore = bestMove.score;
    } else if (Number.isFinite(SearchState.getCurrentLastEval())) {
        finalScore = SearchState.getCurrentLastEval();
    } else {
        if (prevRes) finalScore = (currentTurnColor === 1) ? prevRes.score : -prevRes.score;
        else finalScore = 0;
    }

    if (bestMove) {
        tempBoard[bestMove.y][bestMove.x] = currentTurnColor;
        if (checkWinOnBoard(tempBoard, bestMove.x, bestMove.y, currentTurnColor)) {
            finalScore = 30000;
            bestMove.score = 30000;
        }
        if (currentTurnColor === 1) {
            const forbidden = checkForbidden(tempBoard, bestMove.x, bestMove.y);
            if (forbidden) {
                finalScore = -30000;
                bestMove.score = -30000;
                candidates.forEach(c => c.score = -30000);
            }
        }
        if (finalScore < 29000 && finalScore > -29000) {
            const opponentColor = getOpponentColor(currentTurnColor);
            if (canOpponentWinNext(tempBoard, opponentColor)) {
                finalScore = -30000;
                bestMove.score = -30000;
                candidates.forEach(c => c.score = -30000);
                console.log(`[Analysis correction] opponent immediate win detected. Score set to -30000.`);
            }
        }
        tempBoard[bestMove.y][bestMove.x] = 0;
    }

    let blackViewScore = finalScore;
    if (currentTurnColor === 2) {
        blackViewScore = -finalScore;
        if (candidates.length > 0) candidates.forEach(c => { if (c) c.score = -c.score; });
    }

    state.results.push({ move: moveNum, score: blackViewScore, bestMove, candidates, timeMs: elapsedMs });
    ctx.sendToRenderer('analysis_progress', { current: item.moveNum, total: item.total, score: blackViewScore });
    processAnalysisQueue(state, ctx, sessionId);
}

export function startAnalysisSession(state, ctx, data) {
    if (state.isAnalyzing) {
        console.log("Stopping previous analysis session...");
        stopAnalysisSession(state, ctx);
    }

    ctx.setResearchMode(false);
    ctx.stopResearchSession();
    ctx.setGameRunning(false);

    state.results = [];
    state.queue = createAnalysisQueue(data);
    state.timePerMove = data.timePerMove;
    if (state.queue.length > 0) {
        const sessionId = ++state.sessionId;
        state.isAnalyzing = true;
        ctx.setAnalyzing(true);
        processAnalysisQueue(state, ctx, sessionId);
    } else {
        ctx.setAnalyzing(false);
        ctx.sendToRenderer('analysis_complete', []);
    }
}
