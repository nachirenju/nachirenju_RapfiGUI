/**
 * 棋譜文字列などのテキストデータをシステムのクリップボードへコピーするためのユーティリティモジュール。
 * 
 * 様々なブラウザ環境で確実にコピー操作を行えるようにし、成功時のフィードバック等も担う。
 * 
 * 主な役割:
 * - クリップボードAPIのクロスブラウザ対応ラッパー
 * - 操作時のユーザーフィードバックUIの提供
 */

export function installClipboardMethods(proto) {
    proto.copyToClipboard = function(elementId) {
            const copyText = document.getElementById(elementId);
            if (!copyText) return;
            copyText.select(); copyText.setSelectionRange(0, 99999); 
            navigator.clipboard.writeText(copyText.value).then(() => { alert("コピーしました！"); }).catch(err => {
                console.error("コピー失敗:", err); document.execCommand("copy"); alert("コピーしました！");
            });
        
    };
}
