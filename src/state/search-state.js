/**
 * エンジンの探索処理状態（PV配列、評価値スコア等）を保持するストアモジュール。
 * 
 * エンジン出力パーサーによって更新され、思考ロジックやUIにデータを提供する。
 * 
 * 主な役割:
 * - エンジン出力の最新スナップショットの保持
 * - プロセス間でのデータ共有基盤
 */

let currentLastEval = null;
let currentBestMove = null;
let currentPV = [];
let currentCandidates = [];

export function getCurrentLastEval() { return currentLastEval; }
export function setCurrentLastEval(val) { currentLastEval = val; }
export function getCurrentBestMove() { return currentBestMove; }
export function getCurrentPV() { return currentPV; }
export function getCurrentCandidates() { return currentCandidates; }
export function setCurrentCandidates(candidates) { currentCandidates = candidates; }

export function resetSearchState({ resetEval = false, resetPv = true } = {}) {
    if (resetEval) currentLastEval = null;
    currentCandidates = [];
    if (resetPv) currentPV = [];
    currentBestMove = null;
}

export function applySearchStateFromPv(pvData) {
    const { score, rank, movesStr, moveCoords } = pvData;
    if (rank === 1) currentLastEval = score;

    if (movesStr.length === 0 || !moveCoords) return;

    const idx = rank - 1;
    currentCandidates[idx] = { x: moveCoords.x, y: moveCoords.y, score: score, pv: movesStr };
    
    if (rank === 1) {
        currentBestMove = moveCoords;
        currentPV = pvData.currentPV;
        currentLastEval = score;
    }
}
