/**
 * 多言語対応（国際化・i18n）のためのテキスト切り替えおよび辞書データの管理を行うモジュール。
 * 
 * 言語設定に応じて、DOM内の特定属性を持つ要素のテキストコンテンツを動的に置換する。
 * 
 * 主な役割:
 * - 言語リソースの管理と翻訳テキストの適用
 * - 言語切り替え時のUI再描画トリガー
 */

export function installLanguageMethods(proto) {
    proto.translateUiText = function(text) {
            return window.rapfiTranslate ? window.rapfiTranslate(text) : text;
        
    };

    proto.updateGameControlButton = function() {
            const btn = this.gameControlBtn || document.getElementById('btnStart');
            if (!btn) return;

            if (this.gameActive) {
                btn.textContent = this.translateUiText('対局終了');
                btn.classList.remove('start-action');
                btn.classList.add('finish-action');
                btn.disabled = false;
            } else {
                btn.textContent = this.translateUiText('対局開始');
                btn.classList.remove('finish-action');
                btn.classList.add('start-action');
                btn.disabled = !this.engineReady;
            }
        
    };
}
