/**
 * フロントエンド側からの一括解析（バッチ解析）機能の実行制御を行うモジュール。
 * 
 * ユーザーからの解析開始・停止リクエストを受け取り、UI上で進捗ステータスを更新しながらバックエンドへ解析コマンドを順次送信する。
 * 完了時のサマリー画面への遷移など、フロー全体のUI制御を担う。
 * 
 * 主な役割:
 * - 解析モード時のUI状態管理とユーザーフィードバック
 * - 解析セッションごとのデータ集約処理への受け渡し
 */

import * as backendCommands from '../ipc/backend-commands.js';

export function installAnalysisRunnerMethods(proto) {
    proto.stopAnalysisModeUi = function() {
        this.analysisModeActive = false;
        const progress = document.getElementById('progressWrapper');
        if (progress) progress.style.display = 'none';
    };

    proto.startAnalysis = function() {
            if (this.gameActive) return;
            if (!this.moveHistory || this.moveHistory.length === 0) return;
            const targetMoves = [...this.moveHistory];
            const startMoveInput = document.getElementById('analyzeStartMove').value;
            const startMove = parseInt(startMoveInput) || 1;
            const timeInput = document.getElementById('analyzeTime').value;
            const timeSeconds = parseFloat(timeInput) || 1; 
            const timeMs = Math.floor(timeSeconds * 1000);  
            const n = document.getElementById('analyzeNBest').value;
            const threads = this.isIOSDevice ? 1 : document.getElementById('analyzeThreads').value;
            const hashSize = document.getElementById('analyzeHashSize').value;

            if (confirm(`現在の局面まで(${targetMoves.length}手)を解析します。\n${startMove}手目から開始。\n1手につき ${timeSeconds}秒 かかります。`)) {
                if (this.isResearchMode) {
                    this.stopResearchModeUi();
                }
                this.clearChallengeModeUi();
                this.analysisModeActive = true;
                this.setGraphVisibility(false);
                this.statsContainer.style.display = 'none';
                document.getElementById('progressWrapper').style.display = 'block';
                if (backendCommands.hasBackendApi()) {
                    backendCommands.analyzeGame({
                        moves: targetMoves,
                        timePerMove: timeMs,
                        recordId: this.currentRecordId,
                        startMove: startMove,
                        threads: parseInt(threads) || 1,
                        nbest: parseInt(n) || 3,
                        hashSize: parseInt(hashSize) || 16000
                    });
                } else {
                    alert("Electron API not found");
                }
            }
        
    };
}
