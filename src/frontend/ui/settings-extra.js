/**
 * 拡張機能や高度な設定のUI操作を管理するモジュール。
 * 
 * トグルボタンやスライダーなどの入力を受け付け、設定変更イベントを送信する。
 * 
 * 主な役割:
 * - 詳細なUIコントロールのイベントバインディング
 * - 拡張設定項目の動的な表示制御
 */

export function installSettingsExtraMethods(proto) {
    proto.loadDefaultEngineSettings = function() {
            if (!confirm("詳細設定（Engine/解析）を初期値に戻しますか？\n(保存ボタンを押すまで確定されません)")) return;
            document.getElementById('confResetBoard').checked = false;
            document.getElementById('engMaxMoves').value = 150;
            document.getElementById('engThreads').value = 1;
            document.getElementById('engMaxNodes').value = 0;
            document.getElementById('engHashSize').value = 17000;
            document.getElementById('engStrength').value = 100;
           // document.getElementById('engStrengthVal').textContent = "100"; 
            document.getElementById('engMultiPV').value = 3;
            document.getElementById('engTurnTimePercent').value = 20;
            document.getElementById('engTurnTimeMarginMs').value = 500;
            document.getElementById('engBlunderThreshold').value = -200;
            document.getElementById('engBlunderRate').value = 5;
            document.getElementById('engMissMateRate').value = 30;
            document.getElementById('engHumanStyle').checked = false;
            document.getElementById('analyzeStartMove').value = 6;
            document.getElementById('analyzeTime').value = 5;
            document.getElementById('analyzeNBest').value = 3;
            document.getElementById('analyzeThreads').value = 4;
            document.getElementById('analyzeHashSize').value = 16000;
            document.getElementById('timeRuleMode').value = "normal";
            document.getElementById('playerPerMoveSec').value = 10;
            document.getElementById('aiPerMoveSec').value = 10;
            document.getElementById('uiBoardColor').value = "#F9EBCF";
            document.getElementById('uiMoveSound').checked = true;
            document.getElementById('uiTimeSound').checked = true;
            document.getElementById('uiBoardCoords').checked = true;
            document.getElementById('uiStoneShading').checked = true;
            this.setBoardColor("#F9EBCF");
            this.applyUiSettings();
            this.updateTimeRuleUi();
            this.applyIOSThreadLimit();
        
    };

    proto.switchTab = function(tabName) {
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.getElementById('tab-' + tabName).classList.add('active');
            if (tabName === 'engine') buttons[0].classList.add('active');
            else if (tabName === 'analysis') buttons[1].classList.add('active');
            else if (tabName === 'ui') buttons[2].classList.add('active');
        
    };
}
