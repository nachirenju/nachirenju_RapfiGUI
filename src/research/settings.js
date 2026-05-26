/**
 * 研究モード特有の設定パラメータを保持するモジュール。
 * 
 * UIからの入力を受け取り、研究セッションやバッファ管理モジュールへ設定値を供給する。
 * 
 * 主な役割:
 * - 研究用設定値の永続化と状態保持
 * - 設定変更時の再初期化トリガー
 */

let currentResearchThreads = 1;
let currentResearchHash = 1024;
let currentResearchTimePerMove = 100000000;

export function applyResearchEngineSettings({ threads, hashSize, timePerMove } = {}) {
    if (threads) currentResearchThreads = threads;
    if (hashSize) currentResearchHash = hashSize;
    if (timePerMove) currentResearchTimePerMove = timePerMove;
}

export function getResearchThreadCount(fallbackThreads) {
    return currentResearchThreads || fallbackThreads;
}

export function getResearchHashSize(fallbackHashSize) {
    return currentResearchHash || fallbackHashSize || 1024;
}

export function getResearchTimePerMove() {
    return currentResearchTimePerMove;
}

export function getResearchTimeout({ supportsThreads, isIOS, iosTimeoutMs }) {
    if (!supportsThreads && isIOS) {
        return Math.min(currentResearchTimePerMove || iosTimeoutMs, iosTimeoutMs);
    }
    return currentResearchTimePerMove;
}
