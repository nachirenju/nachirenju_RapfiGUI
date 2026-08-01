/**
 * UIやエンジンの動作に関するデフォルト設定値（初期値）を定義するモジュール。
 * 
 * 初回起動時やリセット時に読み込まれる各種設定を保持し、設定データ構造のスキーマとしての役割も果たす。
 * 
 * 主な役割:
 * - 初期設定データの提供
 * - 設定のバリデーション用リファレンスの提供
 */

// Default settings installer extracted from the former inline frontend script.

export function installDefaultEngineSettings(app) {
    app.loadDefaultEngineSettings = function() {
        if (!confirm("詳細設定（Engine/解析）を初期値に戻しますか？\n(保存ボタンを押すまで確定されません)")) {
            return;
        }
        document.getElementById('engMaxMoves').value = 150;
        document.getElementById('engThreads').value = 1;
        document.getElementById('engMaxNodes').value = 0;
        document.getElementById('engMaxDepth').value = 50;
        document.getElementById('engHashSize').value = 17000;
       // document.getElementById('engStrength').value = 100;
       // document.getElementById('engStrengthVal').textContent = "100"; 
        document.getElementById('engMultiPV').value = 1;
        document.getElementById('engBlunderThreshold').value = -200;
        document.getElementById('engBlunderRate').value = 5;
        document.getElementById('engMissMateRate').value = 30;
        document.getElementById('engHumanStyle').checked = false;
        document.getElementById('timeRuleMode').value = "normal";
        document.getElementById('playerPerMoveSec').value = 10;
        document.getElementById('aiPerMoveSec').value = 10;
        document.getElementById('uiBoardColor').value = "#F2E2BF";
        document.getElementById('uiMoveSound').checked = true;
        document.getElementById('uiTimeSound').checked = true;
        document.getElementById('uiBoardCoords').checked = true;
        document.getElementById('uiStoneShading').checked = true;
        document.getElementById('uiLargeBoardText').checked = false;
        document.getElementById('uiTimerOnSide').checked = false;
        app.setBoardColor("#F2E2BF");
        app.applyUiSettings();
        app.updateTimeRuleUi();

        document.getElementById('analyzeStartMove').value = 6;
        document.getElementById('analyzeTime').value = 5;
        document.getElementById('analyzeNBest').value = 3;
        document.getElementById('analyzeThreads').value = 4;
        app.setChallengeHideSolved(true);
        app.applyIOSThreadLimit();
    };
}
