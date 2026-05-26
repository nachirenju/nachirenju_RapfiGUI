/**
 * 連珠特有の複雑な禁手ルール（黒の三三、四四、長手）を判定する専門ロジックモジュール。
 * 
 * ライン探索アルゴリズムを用いて厳密に禁手評価を行う。
 * 
 * 主な役割:
 * - 複雑なパターンマッチングによる三三・四四の検知
 * - 長手（六連以上）の判定
 */

import { BOARD_SIZE } from '../config/constants.js';
import { checkWinOnBoard } from './board.js';

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function checkForbidden(board, x, y) {
    const fourDetails = [];
    for (let d = 0; d < 4; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        let cnt = 1, tx = x + dx, ty = y + dy;
        while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === 1) { cnt++; tx += dx; ty += dy; }
        tx = x - dx; ty = y - dy;
        while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === 1) { cnt++; tx -= dx; ty -= dy; }
        if (cnt >= 6) return { type: '長連' };
        let patternsInDir = countFourPatterns(board, x, y, dx, dy, 1);
        if (cnt === 4 && patternsInDir > 1) patternsInDir = 1;
        if (patternsInDir > 0) for (let i = 0; i < patternsInDir; i++) fourDetails.push({ dx, dy });
    }
    if (fourDetails.length >= 2) return { type: '四四' };

    const threeDetails = [];
    for (let d = 0; d < 4; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        const points = findThreeVitalPointsNoAlloc(board, x, y, dx, dy);
        if (points) {
            for (const p of points) {
                board[p.y][p.x] = 1;
                const isForbidden = checkForbidden(board, p.x, p.y);
                const makesFour = checkValidStraightFourNoAlloc(board, p.x, p.y, 1);
                board[p.y][p.x] = 0;
                if (!isForbidden && makesFour) { threeDetails.push({ dx, dy }); break; }
            }
        }
    }
    if (threeDetails.length >= 2) return { type: '三三' };
    return null;
}

export function canOpponentWinNext(board, color) {
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (board[y][x] === 0) {
                board[y][x] = color;
                const win = checkWinOnBoard(board, x, y, color);
                board[y][x] = 0;
                if (win) return true;
            }
        }
    }
    return false;
}

function countFourPatterns(board, x, y, dx, dy, color) {
    const winningSpots = new Set();
    for (let start = -4; start <= 0; start++) {
        let sCnt = 0, eCnt = 0, gapX = -1, gapY = -1;
        for (let k = 0; k < 5; k++) {
            const tx = x + (start + k) * dx, ty = y + (start + k) * dy;
            if (tx < 0 || tx >= BOARD_SIZE || ty < 0 || ty >= BOARD_SIZE) { eCnt = 99; break; }
            const v = board[ty][tx];
            if (v === color) sCnt++;
            else if (v === 0) { eCnt++; gapX = tx; gapY = ty; }
            else { eCnt = 99; break; }
        }
        if (sCnt === 4 && eCnt === 1) {
            const key = `${gapX},${gapY}`;
            if (!winningSpots.has(key)) {
                if (color === 1) {
                    board[gapY][gapX] = 1;
                    let cnt = 1, tx = gapX + dx, ty = gapY + dy;
                    while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === 1) { cnt++; tx += dx; ty += dy; }
                    tx = gapX - dx; ty = gapY - dy;
                    while (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE && board[ty][tx] === 1) { cnt++; tx -= dx; ty -= dy; }
                    board[gapY][gapX] = 0;
                    if (cnt > 5) continue;
                }
                winningSpots.add(key);
            }
        }
    }
    return winningSpots.size;
}

function findThreeVitalPointsNoAlloc(board, x, y, dx, dy) {
    const points = [];
    const line = new Int8Array(11);
    for (let k = -5; k <= 5; k++) {
        const tx = x + k * dx, ty = y + k * dy;
        if (tx < 0 || tx >= BOARD_SIZE || ty < 0 || ty >= BOARD_SIZE) line[k + 5] = 2;
        else line[k + 5] = (board[ty][tx] === 1 ? 1 : (board[ty][tx] === 0 ? 0 : 2));
    }
    for (let i = 1; i <= 6; i++) {
        let s = 0, e = 0;
        for (let j = 0; j < 5; j++) {
            if (line[i + j] === 1) s++;
            else if (line[i + j] === 0) e++;
            else { e = 99; break; }
        }
        if (s === 3 && e === 2) {
            if (line[i - 1] === 1 || line[i + 5] === 1) continue;
            for (let j = 0; j < 5; j++) {
                if (line[i + j] === 0 && (line[i + j - 1] === 1 || line[i + j + 1] === 1)) {
                    points.push({ x: x + (i + j - 5) * dx, y: y + (i + j - 5) * dy });
                }
            }
        }
    }
    return points.length > 0 ? points : null;
}

function checkValidStraightFourNoAlloc(board, x, y, color) {
    for (let d = 0; d < 4; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        for (let start = -4; start <= 0; start++) {
            const lK = start, rK = start + 5;
            if (!isVal(board, x, y, dx, dy, lK, 0)) continue;
            if (!isVal(board, x, y, dx, dy, rK, 0)) continue;
            let match = true;
            for (let k = 1; k <= 4; k++) {
                if (!isVal(board, x, y, dx, dy, start + k, color)) { match = false; break; }
            }
            if (match && canWinAt(board, x, y, dx, dy, lK, color) && canWinAt(board, x, y, dx, dy, rK, color)) return true;
        }
    }
    return false;
}

function isVal(board, cx, cy, dx, dy, k, val) {
    if (k === 0) return true;
    const tx = cx + k * dx, ty = cy + k * dy;
    if (tx < 0 || tx >= BOARD_SIZE || ty < 0 || ty >= BOARD_SIZE) return false;
    return board[ty][tx] === val;
}

function canWinAt(board, cx, cy, dx, dy, k, color) {
    const tx = cx + k * dx, ty = cy + k * dy;
    if (tx < 0 || tx >= BOARD_SIZE || ty < 0 || ty >= BOARD_SIZE || board[ty][tx] !== 0) return false;
    board[ty][tx] = color;
    const win = checkWinOnBoard(board, tx, ty, color);
    board[ty][tx] = 0;
    return win;
}
