/**
 * 研究モード開始前のエンジン準備処理。
 * 
 * 既存の探索が残っている場合は YXSTOP / ensureIdle で安全に停止し、
 * 停止に失敗した場合はエンジンを破棄して再起動する。
 * 
 * single-thread 環境や iOS では探索停止の安定性が低いため、
 * 必要に応じてエンジンをリフレッシュしてから研究セッションを初期化する。
 * 
 * 戻り値:
 * - true  : 研究セッションの初期化まで完了
 * - false : エンジン停止または再起動に失敗
 */

import { DEBUG_MODE } from '../config/constants.js';

/**
 * 研究モード開始前のエンジン準備処理。
 *
 * 既存の探索が残っている場合は YXSTOP / ensureIdle で安全に停止し、
 * 停止に失敗した場合はエンジンを破棄して再起動する。
 *
 * single-thread 環境や iOS では探索停止の安定性が低いため、
 * 必要に応じてエンジンをリフレッシュしてから研究セッションを初期化する。
 *
 * 戻り値:
 * - true  : 研究セッションの初期化まで完了
 * - false : エンジン停止または再起動に失敗
 */



export async function stopEngineBeforeResearchStart({
    engineRuntime,
    sendToEngine,
    delay,
    sessionId,
    isCurrent = () => true
}) {
    if (!isCurrent()) return false;
    if (engineRuntime.getIsBusy()) {
        const idleSuccess = await engineRuntime.ensureIdle(3000);
        if (!idleSuccess || !isCurrent()) return false;
    } else {
        if (!isCurrent()) return false;
        if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] stopping previous engine session before research start.`);
        sendToEngine("YXSTOP");
        engineRuntime.setBusy(false);
        await delay(50);
        if (!isCurrent()) return false;
    }
    return true;
}

export async function prepareResearchEngine({
    engineRuntime,
    sendToEngine,
    initializeResearchSession,
    delay,
    sessionId,
    reason,
    isCurrent = () => true
}) {
    if (!isCurrent()) return false;
    if (!engineRuntime.getSupportsThreads()) {
        if (!engineRuntime.getIsIOS() && reason !== "toggle") {
            if (!isCurrent()) return false;
            if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] single-thread engine refresh before research update.`);
            engineRuntime.discard(`research:${reason}:single-thread-refresh`);
            await delay(350);
            if (!isCurrent()) return false;
            const restartedReady = await engineRuntime.ensureReady();
            if (!restartedReady || !isCurrent()) {
                if (DEBUG_MODE) console.error(`[Research DEBUG #${sessionId}] engine failed to ready after single-thread refresh.`);
                return false;
            }
        }
        if (engineRuntime.getIsIOS()) {
            const stopped = await stopEngineBeforeResearchStart({
                engineRuntime,
                sendToEngine,
                delay,
                sessionId,
                isCurrent
            });
            if (!isCurrent()) return false;
            if (!stopped) {
                if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] YXSTOP timed out. Restarting engine for safety.`);
                engineRuntime.discard(`research:${reason}:ios-stop-timeout`);
                await delay(100);
                if (!isCurrent()) return false;
                const restartedReady = await engineRuntime.ensureReady();
                if (!restartedReady || !isCurrent()) {
                    if (DEBUG_MODE) console.error(`[Research DEBUG #${sessionId}] engine failed to ready after iOS timeout restart.`);
                    return false;
                }
            }
        }
        return await initializeResearchSession(isCurrent);
    }

    const idleSuccess = await stopEngineBeforeResearchStart({
        engineRuntime,
        sendToEngine,
        delay,
        sessionId,
        isCurrent
    });
    if (!isCurrent()) return false;
    if (!idleSuccess) {
        if (DEBUG_MODE) console.log(`[Research DEBUG #${sessionId}] YXSTOP timed out. Restarting engine for safety.`);
        engineRuntime.discard(`research:${reason}:stop-timeout`);
        await delay(100);
        if (!isCurrent()) return false;
        const restartedReady = await engineRuntime.ensureReady();
        if (!restartedReady || !isCurrent()) {
            if (DEBUG_MODE) console.error(`[Research DEBUG #${sessionId}] engine failed to ready after timeout restart.`);
            return false;
        }
    }

    return await initializeResearchSession(isCurrent);
}
