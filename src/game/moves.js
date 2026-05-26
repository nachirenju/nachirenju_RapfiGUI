/**
 * 着手の履歴データ管理と、座標・符号間の変換ユーティリティモジュール。
 * 
 * 履歴操作（Undo/Redo）ロジックを提供し、エンジン用座標から内部座標へのマッピングを行う。
 * 
 * 主な役割:
 * - 着手履歴リストの状態管理
 * - 座標系の相互パース・フォーマット変換
 */

export function getNextColorFromHistory(moveHistory) {
    return ((moveHistory || []).length % 2 === 0) ? 1 : 2;
}

export function getOpponentColor(color) {
    return color === 1 ? 2 : 1;
}

export function createMoveHistoryKey(moves) {
    return (moves || []).map(move => `${move.x},${move.y},${move.color}`).join('|');
}
