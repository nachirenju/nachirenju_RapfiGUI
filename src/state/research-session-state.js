/**
 * 研究モード特有のセッション状態（探索中か否か、深さ等）を保持するストアモジュール。
 * 
 * 一時的な解析データや、UIの候補手プレビューに利用される揮発性のデータを管理する。
 * 
 * 主な役割:
 * - 研究モード固有の揮発性状態データの一元管理
 * - 進行状況トラッキング
 */

let researchSessionSeq = 0;
let researchActionSeq = 0;
let currentResearchBoardKey = "";
let activeResearchBoardKey = "";
let pendingIOSResearchReason = "";
let researchUpdateMap = new Map();
let researchUpdateTimer = null;
let researchActionTimer = null;
let lastResearchActionTime = 0;

export function getResearchSessionSeq() { return researchSessionSeq; }
export function getResearchActionSeq() { return researchActionSeq; }
export function getLastResearchActionTime() { return lastResearchActionTime; }
export function getCurrentResearchBoardKey() { return currentResearchBoardKey; }
export function getActiveResearchBoardKey() { return activeResearchBoardKey; }
export function getPendingIOSResearchReason() { return pendingIOSResearchReason; }
export function setPendingIOSResearchReason(reason) { pendingIOSResearchReason = reason; }
export function clearPendingIOSResearchReason() { pendingIOSResearchReason = ""; }

export function startNewResearchSession(boardKey) {
    researchSessionSeq++;
    currentResearchBoardKey = boardKey;
    activeResearchBoardKey = "";
    clearResearchUpdates();
    return researchSessionSeq;
}

export function invalidateResearchPosition(boardKey = "") {
    researchSessionSeq++;
    currentResearchBoardKey = boardKey;
    activeResearchBoardKey = "";
    pendingIOSResearchReason = "";
    clearResearchUpdates();
    return researchSessionSeq;
}

export function setCurrentResearchBoardKey(boardKey) {
    currentResearchBoardKey = boardKey;
}

export function setActiveResearchBoardKey(boardKey) {
    activeResearchBoardKey = boardKey;
}

export function clearActiveResearchBoardKey() {
    activeResearchBoardKey = "";
}

export function isValidResearchSession(sessionId, boardKey) {
    if (sessionId !== undefined && sessionId !== researchSessionSeq) return false;
    if (boardKey !== undefined && boardKey !== currentResearchBoardKey) return false;
    return true;
}

export function stopResearchSession() {
    researchSessionSeq++;
    currentResearchBoardKey = "";
    activeResearchBoardKey = "";
    pendingIOSResearchReason = "";
    clearResearchUpdates();
    if (researchActionTimer) {
        clearTimeout(researchActionTimer);
        researchActionTimer = null;
    }
    researchActionSeq++;
}

export function scheduleResearchAction(debounceDelay, callback) {
    const currentSeq = ++researchActionSeq;
    if (researchActionTimer) {
        clearTimeout(researchActionTimer);
    }
    researchActionTimer = setTimeout(() => {
        if (researchActionSeq !== currentSeq) return;
        lastResearchActionTime = performance.now();
        callback();
    }, debounceDelay);
}

export function updateResearchPV(rank, data, onFlush) {
    researchUpdateMap.set(rank, data);
    if (!researchUpdateTimer) {
        researchUpdateTimer = setTimeout(() => {
            const updates = Array.from(researchUpdateMap.values());
            researchUpdateMap.clear();
            researchUpdateTimer = null;
            if (onFlush) onFlush(updates);
        }, 20);
    }
}

export function clearResearchUpdates() {
    researchUpdateMap.clear();
    if (researchUpdateTimer) {
        clearTimeout(researchUpdateTimer);
        researchUpdateTimer = null;
    }
}
