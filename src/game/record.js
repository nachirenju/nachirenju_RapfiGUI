/**
 * 対局結果情報を含めた「ゲームレコード」を生成・管理するモジュール。
 * 
 * 終局時に盤面状態と履歴などをまとめてメタデータオブジェクトとして構築する。
 * 
 * 主な役割:
 * - 試合終了時のレコードデータのシリアライズと構築
 * - 棋譜のメタ情報の管理
 */

function formatRecordDate(date) {
    return date.getFullYear()
        + (date.getMonth() + 1).toString().padStart(2, '0')
        + date.getDate().toString().padStart(2, '0')
        + date.getHours().toString().padStart(2, '0')
        + date.getMinutes().toString().padStart(2, '0');
}

export function createGameRecord({ winner, isAiVsAi, aiColor, moveHistory, evalHistory, now = new Date() }) {
    const dateStr = formatRecordDate(now);
    let blackName, whiteName, winnerColor, winnerCode;

    if (isAiVsAi) {
        blackName = 'Rapfi';
        whiteName = 'Rapfi';
        if (winner === '黒番AI') {
            winnerColor = 'Black'; winnerCode = 'AIvsAI';
        } else if (winner === '白番AI') {
            winnerColor = 'White'; winnerCode = 'AIvsAI';
        } else {
            winnerColor = 'Draw'; winnerCode = 'Draw';
        }
    } else {
        const playerColor = (aiColor === 2) ? 1 : 2;
        blackName = (playerColor === 1) ? 'User' : 'Rapfi';
        whiteName = (playerColor === 1) ? 'Rapfi' : 'User';
        if (winner === 'あなた') {
            winnerColor = (playerColor === 1) ? 'Black' : 'White'; winnerCode = 'User';
        } else if (winner === 'Rapfi') {
            winnerColor = (playerColor === 1) ? 'White' : 'Black'; winnerCode = 'Rapfi';
        } else {
            winnerColor = 'Draw'; winnerCode = 'Draw';
        }
    }

    return {
        id: Date.now(),
        title: `●${blackName} 〇${whiteName} ${dateStr} ${winnerColor} win`,
        moves: moveHistory,
        evals: evalHistory,
        winner: winnerCode,
        timestamp: now.getTime()
    };
}
