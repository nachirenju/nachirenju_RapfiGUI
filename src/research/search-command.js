/**
 * 研究モードにおけるエンジンの探索コマンドを動的に構築・発行するモジュール。
 * 
 * 環境変数から、エンジンに渡すべき最適な探索引数（YXNBEST等）を生成する。
 * 
 * 主な役割:
 * - 研究モード専用のエンジンコマンド生成ロジック
 * - 探索開始前の引数バリデーション
 */

/**
 * 研究モードの局面送信と探索開始を扱う補助関数群。
 *
 * logResearchBoardForEngine():
 * - エンジンへ送る局面をデバッグログに出力する。
 *
 * sendResearchSearchCommand():
 * - 現在局面を YXBOARD で送信し、研究用の時間設定を行ったあと、
 *   YXNBEST で複数候補手探索を開始する。
 */


import { createResearchTimeCommands } from '../engine/time.js';
import { createYXBoardCommand, formatMovesForEngineDebug } from '../engine/yxboard.js';
import { DEBUG_MODE } from '../config/constants.js';

export function logResearchBoardForEngine({ sessionId, reason, moves, toNotation }) {
    const stones = formatMovesForEngineDebug(moves, toNotation);
    if (DEBUG_MODE) console.log(`[Board DEBUG] research #${sessionId} ${reason}: sending ${moves.length} stones -> ${stones || "(empty)"}`);
}

export function sendResearchSearchCommand({
    moves,
    nbest,
    researchTimeout,
    sendToEngine,
    engineRuntime
}) {
    sendToEngine(createYXBoardCommand(moves));
    createResearchTimeCommands(researchTimeout).forEach(cmd => sendToEngine(cmd));
    engineRuntime.setBusy(true);
    sendToEngine(`YXNBEST ${nbest}`);
}
