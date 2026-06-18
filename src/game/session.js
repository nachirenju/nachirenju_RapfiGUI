/**
 * 対局全体の進行ステートマシンおよびライフサイクル管理モジュール。
 * 
 * 「対局開始」「着手」「思考中」「終局」といったフローを統括し、現在手番や勝敗状態を保持する。
 * 
 * 主な役割:
 * - 対局フローの順序制御と状態の管理
 * - 手番に応じた入力の切り替えと同期処理
 */

import { TimeManager } from './timer.js';
import { toNotation } from './board.js';
import { parseGameTuningSettings, resolvePlayerColorSettings } from './settings.js';
import * as GameState from '../state/game-state.js';
import * as SearchState from '../state/search-state.js';
import { delay } from '../utils/async.js';
import { DEBUG_MODE } from '../config/constants.js';

export function stopGameTimers(ctx) {
    const playerTimer = ctx.getPlayerTimer();
    const rapfiTimer = ctx.getRapfiTimer();
    if (playerTimer) playerTimer.stop();
    if (rapfiTimer) rapfiTimer.stop();
}

export function pauseRunningTimer(timer) {
    if (!timer || !timer.isRunning) return;
    if (timer.timeoutId) {
        clearTimeout(timer.timeoutId);
        timer.timeoutId = null;
    }
    timer.remainingMs = timer.getCurrentRemaining();
    timer.isRunning = false;
}

export function resetGameStateForStart(ctx, data) {
    stopGameTimers(ctx);
    ctx.setPlayerTimer(null);
    ctx.setRapfiTimer(null);

    ctx.setIntentionalKill(false);
    ctx.setGameRunning(false);
    ctx.setGameEnded(false);
    ctx.setRapfiThinking(false);
    ctx.setCrashRetryCount(0);
    GameState.clearGameHistory();
    ctx.setAnalyzing(false);
    SearchState.resetSearchState({ resetEval: true });
    ctx.setResearchMode(false);
    ctx.stopResearchSession();
    ctx.stopAnalysisSession();
}

export function applyGameSettingsForStart(ctx, data) {
    ctx.setLastEngineSettings(data.engineSettings || {});

    const tuning = parseGameTuningSettings(data.engineSettings);
    ctx.setHumanStyle(tuning.isHumanStyle);
    ctx.setCurrentNBest(tuning.currentNBest);
    ctx.setCurrentBlunderThreshold(tuning.currentBlunderThreshold);
    ctx.setCurrentBlunderRate(tuning.currentBlunderRate);
    ctx.setCurrentMissMateRate(tuning.currentMissMateRate);
    ctx.setCurrentMaxMoves(tuning.currentMaxMoves);
    if (tuning.forceStrength100 && data.engineSettings) data.engineSettings.strength = 100;

    const colorSettings = resolvePlayerColorSettings(data.playerColor);
    ctx.setGlobalPlayerColor(colorSettings.playerColor);
    ctx.setAiVsAi(colorSettings.isAiVsAi);
    ctx.setAiColorGlobal(colorSettings.aiColor);
}

export function createGameTimers(ctx, data) {
    const timeRuleMode = data.timeRule === 'perMove' ? 'perMove' : 'normal';

    ctx.setPlayerTimer(new TimeManager(data.playerTime, data.playerIncrement, () => {
        if (!ctx.getGameRunning()) return;
        ctx.terminateByTimeout(ctx.getAiVsAi() ? '白番AI' : 'Rapfi');
    }, timeRuleMode));

    ctx.setRapfiTimer(new TimeManager(data.aiTime, data.aiIncrement, () => {
        if (!ctx.getGameRunning()) return;
        ctx.terminateByTimeout(ctx.getAiVsAi() ? '黒番AI' : 'あなた');
    }, timeRuleMode));
}

export function applyInitialStones(stones = []) {
    stones.forEach(s => {
        const sx = parseInt(s.x), sy = parseInt(s.y), sc = parseInt(s.color);
        GameState.pushMoveToHistory(sx, sy, sc);
    });
    GameState.rebuildBoardFromHistory();
}

export function startInitialTurn(ctx, data, nextColor) {
    const playerTimer = ctx.getPlayerTimer();
    const rapfiTimer = ctx.getRapfiTimer();

    if (ctx.getAiVsAi()) {
        ctx.setAiColorGlobal(nextColor);
        ctx.setRapfiThinking(true);

        if (nextColor === 1) {
            if (playerTimer) playerTimer.start();
        } else if (rapfiTimer) {
            rapfiTimer.start();
        }

        ctx.syncAndThink(ctx.getAiColorGlobal());
        ctx.sendToRenderer('game_started', { turn: 'rapfi', nextColor, playerTime: data.playerTime, aiTime: data.aiTime });
        return;
    }

    if (nextColor === ctx.getGlobalPlayerColor()) {
        if (playerTimer) playerTimer.start();
        ctx.sendToRenderer('game_started', { turn: 'player', nextColor, playerTime: data.playerTime, aiTime: data.aiTime });
    } else {
        ctx.setRapfiThinking(true);
        if (rapfiTimer) rapfiTimer.start();
        ctx.syncAndThink(ctx.getAiColorGlobal());
        ctx.sendToRenderer('game_started', { turn: 'rapfi', nextColor, playerTime: data.playerTime, aiTime: data.aiTime });
    }
}

export async function startGameSession(ctx, data) {
    if (DEBUG_MODE) console.log("\x1b[33m[SYSTEM] 対局開始\x1b[0m");

    resetGameStateForStart(ctx, data);
    applyGameSettingsForStart(ctx, data);
    createGameTimers(ctx, data);

    const ready = await ctx.engineRuntime.ensureReady();
    if (!ready) {
        ctx.broadcastLog('[ERROR] Engine did not become ready before game start.');
        if (DEBUG_MODE) console.error('[AppCore DEBUG] start_game aborted: Rapfi ready timeout');
        return;
    }

    await ctx.initializeGameSession();
    applyInitialStones(data.initialStones || []);

    ctx.setGameRunning(true);
    startInitialTurn(ctx, data, GameState.getNextColor());
}

export async function handlePlayerMove(ctx, move) {
    if (ctx.getAnalyzing()) return;

    if (ctx.engineRuntime.getIsStarting()) {
        await delay(20);
    }

    const x = parseInt(move.x), y = parseInt(move.y);
    const color = GameState.getNextColor();
    if (!GameState.applyMoveTransaction(x, y, color)) {
        return;
    }
    GameState.pushEvalHistory({ move: GameState.getMoveHistory().length, score: SearchState.getCurrentLastEval() || 0 });
    if (DEBUG_MODE) console.log(`\x1b[32m[MOVE]\x1b[0m ${toNotation(x, y)} (${color === 1 ? '黒' : '白'})`);

    if (ctx.finishGameAfterPlayerMoveIfNeeded(x, y, color)) return;

    if (ctx.getGameRunning() && !ctx.getGameEnded()) {
        const playerTimer = ctx.getPlayerTimer();
        const rapfiTimer = ctx.getRapfiTimer();
        if (playerTimer) playerTimer.stop();

        const ready = await ctx.engineRuntime.ensureReady();
        if (!ready) {
            if (DEBUG_MODE) console.error("[AppCore DEBUG] player_move aborted: engine not ready");
            return;
        }

        if (!ctx.getGameRunning() || ctx.getGameEnded()) return;

        if (DEBUG_MODE) console.log(`[AppCore DEBUG] Player moved. Setting isRapfiThinking = true and calling syncAndThink`);
        ctx.setRapfiThinking(true);
        if (rapfiTimer) rapfiTimer.start();
        ctx.syncAndThink(ctx.getAiColorGlobal());
    }
}

export async function takebackPlayerMove(ctx, reason = "player takeback") {
    if (!ctx.getGameRunning() || ctx.getGameEnded() || ctx.getAiVsAi() || GameState.getMoveHistory().length === 0) return false;

    const removed = GameState.takebackUntilColor(ctx.getGlobalPlayerColor());
    if (!removed) return false;

    ctx.clearGameActionTimer();
    ctx.bumpGameActionSeq();
    pauseRunningTimer(ctx.getPlayerTimer());
    pauseRunningTimer(ctx.getRapfiTimer());
    ctx.setRapfiThinking(false);

    if (ctx.engineRuntime.getIsBusy()) {
        ctx.sendToEngine("YXSTOP");
        await ctx.engineRuntime.ensureIdle();
    }
    SearchState.resetSearchState();

    const playerTimer = ctx.getPlayerTimer();
    if (playerTimer) playerTimer.start();

    ctx.sendToRenderer('undo_result', {
        moveHistory: GameState.getMoveHistory(),
        turn: 'player',
        takeback: true,
        aiTime: ctx.getRapfiTimer() ? ctx.getRapfiTimer().getCurrentRemaining() : 0,
        playerTime: playerTimer ? playerTimer.getCurrentRemaining() : 0
    });
    return true;
}

export function finishGameSession(ctx) {
    ctx.terminateGame('ManualEnd');
}

export async function stopAllActiveModesForChallengeSession(ctx) {
    if (ctx.getAnalyzing()) {
        ctx.setAnalyzing(false);
        ctx.stopAnalysisSession();
    }
    
    ctx.setResearchMode(false);
    ctx.stopResearchSession();
    
    if (ctx.getGameRunning()) {
        stopGameTimers(ctx);
        ctx.setGameRunning(false);
        ctx.setGameEnded(true);
    }
    
    // Use ensureIdle instead of discard to avoid iOS WebAssembly OOM crashes from rapidly respawning workers.
    await ctx.engineRuntime.ensureIdle();
}

export async function startChallengeGameSession(ctx, data) {
    const DEBUG_MODE = true; // Temporary flag for console logic if needed
    if (DEBUG_MODE) console.log("\x1b[33m[SYSTEM] 挑戦対局開始\x1b[0m");

    stopGameTimers(ctx);
    ctx.setPlayerTimer(null);
    ctx.setRapfiTimer(null);
    ctx.setIntentionalKill(false);
    ctx.setGameRunning(false);
    ctx.setGameEnded(false);
    ctx.setRapfiThinking(false);
    ctx.setCrashRetryCount(0);
    ctx.setAnalyzing(false);
    SearchState.resetSearchState({ resetEval: true });
    ctx.setResearchMode(false);
    ctx.stopResearchSession();

    // Apply settings
    applyGameSettingsForStart(ctx, data);
    
    // Challenge-specific color overrides
    if (data.playerColor) {
        ctx.setGlobalPlayerColor(data.playerColor);
        ctx.setAiColorGlobal(data.playerColor === 1 ? 2 : 1);
        ctx.setAiVsAi(false);
    }

    createGameTimers(ctx, data);

    const ready = await ctx.engineRuntime.ensureReady();
    if (!ready) {
        ctx.broadcastLog('[ERROR] Engine did not become ready before challenge start.');
        throw new Error('Engine ready timeout');
    }

    await ctx.initializeGameSession();
    
    // History is NOT cleared via clearGameHistory() because UI already deep copied it. 
    // We just set it. Wait, the history in GameState must be synced!
    GameState.clearGameHistory();
    applyInitialStones(data.initialStones || []);

    ctx.setGameRunning(true);
    
    const nextTurn = GameState.getNextColor();
    // For challenge mode, user starts.
    startInitialTurn(ctx, data, nextTurn);
}
