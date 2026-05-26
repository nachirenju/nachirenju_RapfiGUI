/**
 * エンジンの思考時間（探索に割り当てる時間）の計算および制御を行うモジュール。
 * 
 * 対局設定と現在の残り時間を基に、この手に使える最大・最適思考時間を算出し、エンジンに伝達する。
 * タイムアウト監視や、時間切れによる強制終了（YXSTOP）のトリガーも行う。
 * 
 * 主な役割:
 * - 動的な思考時間割り当てアルゴリズムの実行
 * - バックエンド側での時計管理・タイムアウト監視
 */

export function createTurnTimeCommands({ timeLeft, timeoutTurn, increment }) {
    return [
        `INFO TIME_LEFT ${timeLeft}`,
        `INFO TIMEOUT_TURN ${timeoutTurn}`,
        `INFO TIME_INCREMENT ${increment}`
    ];
}

export function createResearchTimeCommands(timeoutTurn) {
    return [
        'INFO TIME_LEFT 100000000',
        'INFO TIME_INCREMENT 0',
        `INFO TIMEOUT_TURN ${timeoutTurn}`
    ];
}
