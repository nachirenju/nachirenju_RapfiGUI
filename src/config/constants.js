/**
 * アプリケーション全体で共有される各種定数を定義するモジュール。
 * 
 * 盤面サイズ（15x15）、石の色（黒/白/空き）、エンジンの最大スレッド数、探索深度の上限など、各システムで共通して使用されるマジックナンバーや固定値を一元管理する。
 * デバッグフラグ（DEBUG_MODE）などもここで定義し、アプリケーションの動作モードを制御する。
 * 
 * 主な役割:
 * - 変更されにくい固定値の集約による保守性の向上
 * - 環境やモードごとの設定値の提供
 */

export const BOARD_SIZE = 15;

// DEBUG_MODE は let で宣言し、UIトグルスイッチからリアルタイムに切り替え可能にする。
// setDebugMode() を呼ぶと、モジュール内のDEBUG_MODEとグローバルの window.DEBUG_MODE が同期される。
export let DEBUG_MODE = false;

/**
 * デバッグモードのON/OFFを切り替える。
 * UIトグルスイッチから呼び出され、モジュール内の DEBUG_MODE と
 * グローバルの window.DEBUG_MODE を同時に更新する。
 * @param {boolean} val - デバッグモードの新しい値
 */
export function setDebugMode(val) {
    DEBUG_MODE = !!val;
    window.DEBUG_MODE = !!val;
}
