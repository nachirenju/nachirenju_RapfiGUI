/**
 * Yixin-Boardプロトコル等の盤面フォーマット変換モジュール。
 * 
 * 現在の盤面状態（石の配置リスト）から、エンジンが理解できる形式（「BOARD」コマンドと座標の羅列）に変換するエンコーダー、
 * およびエンジンからの特殊な座標表現をデコードする機能を実装する。
 * 
 * 主な役割:
 * - アプリ内座標系（0-14等）とエンジン座標系（例: H8）との相互変換
 * - BOARDコマンド送信データの構築
 */

export function createYXBoardCommand(moves) {
    if (!moves || moves.length === 0) return 'YXBOARD\nDONE';

    let cmd = 'YXBOARD';

    for (const move of moves || []) {
        if (typeof move.x === 'number' && typeof move.y === 'number') {
            cmd += ` ${move.x},${move.y},${move.color}`;
        }
    }

    return `${cmd} DONE`;
}

export function formatMovesForEngineDebug(moves, toNotation) {
    return (moves || [])
        .map(move => `${move.x},${move.y},${move.color}[${toNotation(move.x, move.y)}]`)
        .join(' ');
}
