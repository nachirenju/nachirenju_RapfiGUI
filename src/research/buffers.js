/**
 * 研究モードにおいて出力されるデータを一時的に蓄積・平滑化するモジュール。
 * 
 * 探索途中の情報によるUIのチラつきを防ぐため、データを貯めてから更新イベントを発火する。
 * 
 * 主な役割:
 * - エンジン出力データの流量制御
 * - UI更新のパフォーマンス最適化
 */

/**
 * 研究モードの再開始前に、探索状態と研究更新ログをまとめてリセットする。
 */


import * as SearchState from '../state/search-state.js';
import * as ResearchSessionState from '../state/research-session-state.js';

export function resetResearchBuffers() {
    SearchState.resetSearchState();
    ResearchSessionState.clearResearchUpdates();
}
