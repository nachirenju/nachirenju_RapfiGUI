/**
 * 設定画面のレイアウト構成、タブ切り替えナビゲーションを管理するモジュール。
 * 
 * ユーザーが目的の設定項目にアクセスしやすいUI構造を提供する。
 * 
 * 主な役割:
 * - 設定パネル内のタブUIのステート管理
 * - レイアウト変更時のDOMの再レンダリング処理
 */

// Moves settings panels into the current modal layout after the app is created.
export function mountDetachedSettingsPanels() {
    const timeSettingsMount = document.getElementById('timeSettingsMount');
    const timeSettingsPanel = document.getElementById('timeSettingsPanel');
    const colorSettingsPanel = document.getElementById('colorSettingsPanel');

    if (timeSettingsMount && timeSettingsPanel) {
        timeSettingsMount.appendChild(timeSettingsPanel);
    }
    if (timeSettingsMount && colorSettingsPanel) {
        timeSettingsMount.appendChild(colorSettingsPanel);
    }
}
