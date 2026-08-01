/**
 * フロントエンドからバックエンドプロセスへコマンドを送信するためのインターフェースモジュール。
 * 
 * 実行環境に応じたメッセージパッシングの違いを抽象化し、対局開始や設定変更などのリクエストをラップする。
 * 
 * 主な役割:
 * - バックエンド通信の抽象化レイヤーの提供
 * - メッセージフォーマットの標準化
 */

// Renderer -> backend command helpers.
// Keep these as thin pass-throughs so the preload/event contract stays unchanged.

function getApi() {
    return window.electronAPI || null;
}

export function hasBackendApi() {
    return Boolean(getApi());
}

export function requestInitialData(delayMs = 100) {
    if (!hasBackendApi()) return false;
    setTimeout(() => {
        requestQuizList();
        requestHistory();
    }, delayMs);
    return true;
}

export function requestQuizList() {
    getApi()?.requestQuizList();
}

export function requestHistory() {
    getApi()?.requestHistory();
}

export function sendUpdateEngineSetting(setting) {
    getApi()?.sendUpdateEngineSetting(setting);
}

export function toggleResearch(enabled, multiPv, threads, hashSize) {
    getApi()?.toggleResearch(enabled, multiPv, threads, hashSize);
}

export function invalidateResearch(boardKey) {
    getApi()?.invalidateResearch?.(boardKey);
}

export function researchSync(moveHistory, multiPv, threads, hashSize) {
    getApi()?.researchSync(moveHistory, multiPv, threads, hashSize);
}

export function analyzeGame(options) {
    getApi()?.analyzeGame(options);
}

export function saveAnalysisResult(result) {
    getApi()?.saveAnalysisResult(result);
}

export function saveQuizList(quizList) {
    getApi()?.saveQuizList(quizList);
}

export function loadGameRecord(recordId) {
    getApi()?.loadGameRecord(recordId);
}

export function deleteGameRecord(recordId) {
    getApi()?.deleteGameRecord(recordId);
}

export function playerMove(move) {
    getApi()?.playerMove(move);
}

export function startGame(options) {
    getApi()?.startGame(options);
}

export function takebackMove() {
    const api = getApi();
    if (!api) return;
    if (typeof api.takebackMove === 'function') {
        api.takebackMove();
        return;
    }
    api.undoMove();
}

export function finishGame() {
    getApi()?.finishGame();
}

export function startChallengeGame(options) {
    return getApi()?.startChallengeGame?.(options);
}

export function stopAllActiveModesForChallenge() {
    return getApi()?.stopAllActiveModesForChallenge?.();
}
