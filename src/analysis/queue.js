/**
 * 一括解析モードにおける解析キュー（待ち行列）の管理モジュール。
 * 
 * ユーザーが指定した複数局面の連続解析リクエストをキューイングし、順番にエンジンへ渡して結果を取得する制御を行う。
 * 解析途中のキャンセルや、エラー発生時のキューのクリーンアップなど、状態の整合性を保ちながら順次処理を進める。
 * 
 * 主な役割:
 * - 局面リストに対する非同期的な順次処理のスケジュール
 * - 解析の一時停止、再開、キャンセルリクエストのハンドリング
 */

export function createAnalysisQueue(data) {
    const moves = data.moves;
    const queue = [];

    for (let i = (data.startMove || 1); i <= moves.length; i++) {
        queue.push({
            moveNum: i,
            moves: moves.slice(0, i),
            total: moves.length,
            nbest: data.nbest || 3,
            threads: data.threads || 1,
            hashSize: data.hashSize || 16000
        });
    }

    return queue;
}
