/**
 * レンダラーに特化した棋譜やテキストフォーマット処理モジュール。
 * 
 * UIに表示するためのテキストの整形を行う。
 * 
 * 主な役割:
 * - UI表示用テキストのフォーマット整形
 * - ユーザー入力テキストの正規化
 */

import { BOARD_SIZE } from '../config/constants.js';
import { REGEX_MOVE_CMD } from '../config/regex.js';
import { toNotation } from '../game/board.js';

export function formatMoveWithNotation(line, { includeTime = false, getTimeInfo = null } = {}) {
    const appendNotation = (match, xText, yText) => {
        const mx = parseInt(xText, 10);
        const my = parseInt(yText, 10);
        if (mx < 0 || mx >= BOARD_SIZE || my < 0 || my >= BOARD_SIZE) return match;
        return `${match} [${toNotation(mx, my)}]`;
    };

    const moveCmdMatch = line.match(REGEX_MOVE_CMD);
    if (!moveCmdMatch) {
        return line.replace(/\b(\d{1,2}),(\d{1,2})\b/g, appendNotation);
    }

    const mx = parseInt(moveCmdMatch[1], 10);
    const my = parseInt(moveCmdMatch[2], 10);
    if (mx < 0 || mx >= BOARD_SIZE || my < 0 || my >= BOARD_SIZE) return line;

    const timeInfo = includeTime && getTimeInfo ? getTimeInfo() : '';
    return `${line} [${toNotation(mx, my)}]${timeInfo}`;
}
