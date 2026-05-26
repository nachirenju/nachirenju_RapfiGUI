/**
 * エンジンから出力される情報をリアルタイムに受け取り、構造化データに変換するモジュール。
 * 
 * 正規表現（regex.js）を用いて生テキストから必要な情報を抽出し、スコアやPVなどをフロントエンドに送信可能な形式に成形する。
 * また、エンジンがビジー状態かアイドル状態かのフラグ切り替えトリガーも担う。
 * 
 * 主な役割:
 * - 標準出力テキストのパースおよび内部状態オブジェクトへのマッピング
 * - 意味のあるイベント（探索完了、PV更新など）の発火
 */

import {
    REGEX_DEPTH_TEXT,
    REGEX_DEPTH,
    REGEX_MOVE_CMD,
    REGEX_MULTI_PV,
    REGEX_SCORE_PV,
    REGEX_WHITESPACE,
    REGEX_MESSAGE_PV,
    REGEX_SCORE_EVAL
} from '../config/regex.js';
import { createEmptyBoard, fromNotation, isInsideBoard } from '../game/board.js';
import { getOpponentColor } from '../game/moves.js';
import { parseRapfiScore } from './score.js';

export function classifyEngineLine(line) {
    const lowerLine = line.toLowerCase();
    const isBestMove = line.startsWith('bestmove');
    const moveMatch = line.match(REGEX_MOVE_CMD);
    const hasPv = line.indexOf('|') !== -1;

    return {
        isBestMove,
        moveMatch,
        isMoveCommand: !!moveMatch,
        hasPv,
        isSearchOutput: (hasPv && !line.startsWith('INFO')) || isBestMove || !!moveMatch,
        isMultiPVLine: (hasPv || line.includes('MESSAGE')) ? line.match(REGEX_MULTI_PV) : null,
        isStandardMessage: line.startsWith('MESSAGE') && hasPv,
        isError: line.startsWith('ERROR') || line.includes('Unknown'),
        isInformational: line.includes('Evaluator set') || line.includes('Load config'),
        isWarning: lowerLine.includes('unknown'),
        isFatalLikeError: lowerLine.includes('failed to initialized')
            || (lowerLine.includes('error') && !lowerLine.includes('winrate'))
            || lowerLine.includes('unable to open')
    };
}

export function parsePvSearchLine(line, moveHistory, nextColor) {
    if (!line.includes('|') || line.startsWith('INFO')) return null;

    const parts = line.split('|').map(part => part.trim());
    let depth = 0;
    const depthTextMatch = line.match(REGEX_DEPTH_TEXT);
    if (depthTextMatch) {
        depth = parseInt(depthTextMatch[1], 10);
    } else {
        const depthMatch = line.match(REGEX_DEPTH);
        if (depthMatch) depth = parseInt(depthMatch[1], 10);
    }

    let score = 0;
    const scoreMatch = line.match(REGEX_SCORE_PV);
    if (scoreMatch) score = parseRapfiScore(scoreMatch[1]);

    const rankMatch = line.match(REGEX_MULTI_PV);
    const rank = rankMatch ? parseInt(rankMatch[1], 10) : 1;
    const pvStr = parts[parts.length - 1];
    const originalMovesStr = pvStr.split(REGEX_WHITESPACE).filter(move => move.length >= 2);
    const movesStr = filterLegalPvMoves(originalMovesStr, moveHistory, nextColor);
    const moveCoords = movesStr.length > 0 ? fromNotation(movesStr[0]) : null;
    const currentPV = movesStr.map(move => fromNotation(move)).filter(move => move !== null);

    return { depth, score, rank, movesStr, moveCoords, currentPV };
}

export function parseInlineEvalScore(line) {
    if (line.match(REGEX_MESSAGE_PV)) return null;
    const scoreMatch = line.match(REGEX_SCORE_EVAL);
    return scoreMatch ? parseRapfiScore(scoreMatch[1]) : null;
}

function filterLegalPvMoves(originalMovesStr, moveHistory, nextColor) {
    const validMovesStr = [];
    if (originalMovesStr.length === 0) return validMovesStr;

    const virtualBoard = createEmptyBoard();
    for (const move of moveHistory) {
        virtualBoard[move.y][move.x] = move.color;
    }

    let currentColor = nextColor;
    for (const moveStr of originalMovesStr) {
        const coords = fromNotation(moveStr);
        if (!coords || !isInsideBoard(coords.x, coords.y)) break;
        if (virtualBoard[coords.y][coords.x] !== 0) break;
        virtualBoard[coords.y][coords.x] = currentColor;
        currentColor = getOpponentColor(currentColor);
        validMovesStr.push(moveStr);
    }

    return validMovesStr;
}
