/**
 * 検討モードや棋譜読み込み時における、手番移動（前後へのナビゲーション）を制御するモジュール。
 * 
 * 「最初へ」「前へ」「次へ」「最後へ」といった操作を受け付け、盤面・UIへの反映を行う。
 * キーボードショートカット操作バインディングも実装する。
 * 
 * 主な役割:
 * - 棋譜のシーク操作のロジック処理
 * - 履歴変更に応じた盤面再描画や評価値グラフとの同期
 */

import { BOARD_SIZE, EMPTY } from '../board/renju-engine.js';
import * as backendCommands from '../ipc/backend-commands.js';

export function installReviewNavigationMethods(proto) {
    proto.resetBoardTo = function(history) {
            for(let y=0; y<BOARD_SIZE; y++) this.board[y].fill(EMPTY);
            history.forEach(m => this.board[m.y][m.x] = m.color);
            this.lastMove = history.length > 0 ? history[history.length-1] : null;
            this.drawBoard();
        
    };

    proto.firstMove = function() { if(this.gameActive) return; this.jumpToMove(0); 
    };

    proto.prevMove = function() { 
            if(this.gameActive) { 
                this.takebackMove();
                return; 
            } 
            this.jumpToMove(this.moveHistory.length - 1); 
        
    };

    proto.nextMove = function() { if(this.gameActive) return; this.jumpToMove(this.moveHistory.length + 1); 
    };

    proto.goToLast = function() { if(this.gameActive) return; this.jumpToMove(this.fullGameHistory.length); 
    };

    proto.jumpToMove = function(moveNumber) {
            if (!this.fullGameHistory) return;
            if (moveNumber < 0) moveNumber = 0;
            if (moveNumber > this.fullGameHistory.length) moveNumber = this.fullGameHistory.length;
            const targetHistory = this.fullGameHistory.slice(0, moveNumber);
            this.moveHistory = targetHistory;
            this.resetBoardTo(targetHistory);
            this.drawBoard();
            
            // 研究モードなら同期
         if (this.isResearchMode && backendCommands.hasBackendApi()) {
                this.researchCandidates = {}; 
                this.currentResearchDepth = 0;
                this.requestUpdateGraph();
                // 設定値を渡す
                backendCommands.researchSync(this.moveHistory, this.getMultiPVSetting(), this.getThreadSetting(), this.getHashSetting());
            }
        
    };

    proto.resetReview = function() { 
            if (this.gameActive) return;
            if(confirm("盤面をリセットしますか？")) { 
                this.resetBoard(); 
                this.fullGameHistory = []; 
                this.challengeMode = false;
                const cec = document.getElementById('challengeEndControls');
                if (cec) cec.style.display = 'none';
                const clbl = document.getElementById('challengeLabel');
                if (clbl) clbl.style.display = 'none';
                
                // 研究モードなら空の履歴を同期
             if (this.isResearchMode && backendCommands.hasBackendApi()) {
                    this.researchCandidates = {};
                    
                    backendCommands.researchSync([], this.getMultiPVSetting(), this.getThreadSetting(), this.getHashSetting());
                }
            } 
        
    };
}
