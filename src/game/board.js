/**
 * 連珠の盤面データの操作と、基本的な局面判定を行うコアロジックモジュール。
 * 
 * データ構造を用いて石の配置を管理し、着手履歴の追加・削除に伴う盤面の更新を行う。
 * 
 * 主な役割:
 * - 盤面データ構造の定義およびアクセスAPIの提供
 * - 基本的な着手合法性チェック
 */

import { BOARD_SIZE } from '../config/constants.js';

export function createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

export function isInsideBoard(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function buildBoardFromMoves(moves, { stopOnDuplicate = false } = {}) {
    const board = createEmptyBoard();
    let duplicate = null;
    let invalid = null;

    for (const move of moves || []) {
        if (!isInsideBoard(move.x, move.y)) {
            invalid = invalid || move;
            continue;
        }
        if (board[move.y][move.x] !== 0) {
            duplicate = duplicate || move;
            if (stopOnDuplicate) return { board, duplicate, invalid };
        }
        board[move.y][move.x] = move.color;
    }

    return { board, duplicate, invalid };
}

export function toNotation(x, y) {
    return String.fromCharCode(65 + x) + (BOARD_SIZE - y);
}

export function fromNotation(coord) {
    if (!coord || coord.length < 2) return null;
    const code = coord.charCodeAt(0);
    const x = (code >= 97) ? (code - 97) : (code - 65);
    const y = BOARD_SIZE - parseInt(coord.substring(1), 10);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) return { x, y };
    return null;
}

export function checkWinOnBoard(board, x, y, color) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    const isWin = (cnt) => (color === 1 ? cnt === 5 : cnt >= 5);
    x = parseInt(x);
    y = parseInt(y);
    color = parseInt(color);
    for (let [dx, dy] of dirs) {
        let count = 1;
        let tx = x + dx, ty = y + dy;
        while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === color) {
            count++;
            tx += dx;
            ty += dy;
        }
        tx = x - dx;
        ty = y - dy;
        while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === color) {
            count++;
            tx -= dx;
            ty -= dy;
        }
        if (isWin(count)) return true;
    }
    return false;
}

export function checksFourOnBoard(board, x, y, color) {
    if (board[y][x] !== 0) return false;
    board[y][x] = color;
    let makesFour = false;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let [dx, dy] of dirs) {
        for (let k = -4; k <= 4; k++) {
            if (k === 0) continue;
            const tx = x + k * dx, ty = y + k * dy;
            if (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === 0) {
                board[ty][tx] = color;
                if (checkWinOnBoard(board, tx, ty, color)) makesFour = true;
                board[ty][tx] = 0;
                if (makesFour) break;
            }
        }
        if (makesFour) break;
    }
    board[y][x] = 0;
    return makesFour;
}
