/**
 * 進行中のゲームのグローバルな状態（盤面データ、履歴等）を保持するストアモジュール。
 * 
 * 状態の変更時にイベントを発行して、フロントエンドやエンジン連携を連動させる。
 * 
 * 主な役割:
 * - ゲームデータのメモリ内保持と不変性の管理
 * - 状態変更トランザクションの保証
 */

import { createEmptyBoard, buildBoardFromMoves, isInsideBoard, toNotation, checkWinOnBoard } from '../game/board.js';
import { broadcastLog } from '../renderer/events.js';
import { getNextColorFromHistory } from '../game/moves.js';
import { DEBUG_MODE } from '../config/constants.js';

let moveHistory = [];
let serverBoard = createEmptyBoard();
let evalHistory = [];

export function getMoveHistory() { return moveHistory.slice(); }
export function getServerBoard() { return serverBoard; }
export function getEvalHistory() { return evalHistory.slice(); }

export function clearGameHistory() {
    moveHistory = [];
    serverBoard = createEmptyBoard();
    evalHistory = [];
}

export function pushEvalHistory(item) {
    evalHistory.push(item);
}
export function popEvalHistory() { return evalHistory.pop(); }

export function getNextColor() {
    return getNextColorFromHistory(moveHistory);
}

export function rebuildBoardFromHistory() {
    const { board, duplicate } = buildBoardFromMoves(moveHistory);
    if (duplicate) {
        console.error(
            `\x1b[31m[FATAL] Duplicate stone detected at ${duplicate.x},${duplicate.y} [${toNotation(duplicate.x, duplicate.y)}]\x1b[0m\n`,
            "Move:", duplicate,
            "History:", moveHistory
        );
    }
    serverBoard = board;
}

export function applyMoveTransaction(x, y, color) {
    if (!serverBoard[y] || serverBoard[y][x] !== 0) {
        return false;
    }

    moveHistory.push({ x, y, color });

    const { board, duplicate } = buildBoardFromMoves(moveHistory, { stopOnDuplicate: true });
    if (duplicate) {
        moveHistory.pop();
        console.error(`\x1b[31m[FATAL] transaction rollback: occupied cell ${x},${y} [${toNotation(x, y)}]\x1b[0m`);
        return false;
    }

    serverBoard = board;
    return true;
}

export function checkWin(x, y, color) {
    return checkWinOnBoard(serverBoard, x, y, color);
}

function normalizeMove(raw, index, source, occupied = new Set()) {
    const x = Number.parseInt(raw && raw.x, 10);
    const y = Number.parseInt(raw && raw.y, 10);
    let color = Number.parseInt(raw && raw.color, 10);
    const expectedColor = (index % 2 === 0) ? 1 : 2;

    if (!Number.isInteger(x) || !Number.isInteger(y) || !isInsideBoard(x, y)) {
        if (DEBUG_MODE) console.warn(`[Board DEBUG] ${source}: invalid move ignored at #${index + 1}: ${JSON.stringify(raw)}`);
        broadcastLog(`[DEBUG] Invalid board coordinate ignored: ${JSON.stringify(raw)}`);
        return null;
    }

    if (color !== 1 && color !== 2) {
        if (DEBUG_MODE) console.warn(`[Board DEBUG] ${source}: invalid color at ${x},${y}; using expected color ${expectedColor}`);
        color = expectedColor;
    } else if (color !== expectedColor) {
        if (DEBUG_MODE) console.warn(`[Board DEBUG] ${source}: color order mismatch at #${index + 1} ${toNotation(x, y)} color=${color} expected=${expectedColor}`);
    }

    const key = `${x},${y}`;
    if (occupied.has(key)) {
        if (DEBUG_MODE) console.warn(`[Board DEBUG] ${source}: duplicate stone ignored at #${index + 1}: ${x},${y} [${toNotation(x, y)}]`);
        broadcastLog(`[DEBUG] Duplicate stone ignored: ${x},${y} [${toNotation(x, y)}]`);
        return null;
    }
    occupied.add(key);
    return { x, y, color };
}

export function applyMoveHistory(rawHistory, source) {
    const occupied = new Set();
    const normalized = [];
    const board = createEmptyBoard();
    const sourceHistory = Array.isArray(rawHistory) ? rawHistory : [];

    sourceHistory.forEach((m, index) => {
        const normalizedMove = normalizeMove(m, index, source, occupied);
        if (!normalizedMove) return;
        normalized.push(normalizedMove);
        board[normalizedMove.y][normalizedMove.x] = normalizedMove.color;
    });

    moveHistory = normalized;
    serverBoard = board;
    return normalized;
}

export function pushMoveToHistory(x, y, color) {
    moveHistory.push({ x, y, color });
}

export function popLastMove() {
    if (moveHistory.length === 0) return null;
    const lastMove = moveHistory.pop();
    rebuildBoardFromHistory();
    return lastMove;
}

export function takebackUntilColor(color) {
    if (moveHistory.length === 0) return false;
    
    const originalHistory = moveHistory.slice();
    let removedColorMove = false;
    
    while (moveHistory.length > 0) {
        const move = moveHistory.pop();
        if (move.color === color) {
            removedColorMove = true;
            break;
        }
    }
    
    if (!removedColorMove) {
        moveHistory = originalHistory;
        return false;
    }
    
    rebuildBoardFromHistory();
    truncateEvalHistoryToMoveCount();
    return true;
}

export function getBoardKey() {
    return moveHistory.map(m => `${m.x},${m.y},${m.color}`).join('|');
}


export function truncateEvalHistoryToMoveCount() {
    if (evalHistory.length > moveHistory.length) {
        evalHistory.length = moveHistory.length;
    }
}

