/**
 * AIの着手生成および候補手制御ロジックを管理するモジュール。
 * 
 * エンジンから出力された複数の候補手（MultiPV）や評価値を分析し、実際にAIがどの手を打つか（あるいは人間らしい揺らぎを加えるか）を選択する。
 * レベル調整に基づく意図的な悪手や、特定の局面（詰めろ防ぎ等）における強制手の判定・ハンドリングもここで行う。
 * 
 * 主な役割:
 * - エンジンの探索結果（PV・スコア）からの最終的な着手の決定
 * - レベル（難易度）に応じたランダム性の付与やヒューマンライクな着手の生成
 */

export function createDefaultEngineMove(defaultX, defaultY, candidates = []) {
    const found = candidates.find(candidate => candidate && candidate.x === defaultX && candidate.y === defaultY);
    return found ? { ...found, x: defaultX, y: defaultY } : { x: defaultX, y: defaultY };
}
