/**
 * 実行環境（PCブラウザ、iOS/Android等）の判定と、それに応じたUI動作の切り替えモジュール。
 * 
 * タッチイベントの調整や、iOS特有の制約への対応フラグを提供する。
 * 
 * 主な役割:
 * - クロスプラットフォーム対応のための環境検出
 * - 環境依存のハードウェア制御処理の分岐管理
 */

export function installDeviceMethods(proto) {
    proto.detectIOSDevice = function() {
            return typeof navigator !== 'undefined' &&
                (/iPad|iPhone|iPod/.test(navigator.platform) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
        
    };

    proto.applyIOSThreadLimit = function() {
            if (!this.isIOSDevice) return;

            const threadInputs = [
                document.getElementById('engThreads'),
                document.getElementById('analyzeThreads')
            ];

            threadInputs.forEach(input => {
                if (!input) return;
                input.value = 1;
                input.min = 1;
                input.max = 1;
                input.disabled = true;
                input.title = this.translateUiText('iOSではマルチスレッドは使えません');
            });

            const notice = document.getElementById('iosThreadNotice');
            if (notice) {
                notice.textContent = this.translateUiText('iOSではマルチスレッドは使えません');
                notice.style.display = 'block';
            }
        
    };
}
