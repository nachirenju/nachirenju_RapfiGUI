/**
 * ゲーム進行に関する各種操作（待った、投了、対局開始/終了など）のUIイベント制御モジュール。
 * 
 * 操作ボタンをクリックした際の入力を処理し、状態チェックを行った上でバックエンドへのコマンド発行や警告ダイアログの表示を行う。
 * 
 * 主な役割:
 * - 対局制御関連のユーザーインタラクションのハンドリング
 * - 不正操作のブロック・バリデーション
 */

import { BOARD_SIZE, EMPTY, BLACK, WHITE } from '../board/renju-engine.js';
import * as backendCommands from '../ipc/backend-commands.js';

export function installGameControlMethods(proto) {
    proto.getResearchBoardKey = function(history = this.moveHistory) {
        return (history || []).map(move => `${move.x},${move.y},${move.color}`).join('|');
    };

    proto.resetResearchUiForCurrentPosition = function() {
        this.researchCandidates = {};
        this.currentResearchDepth = 0;
        this.researchBoardKey = this.getResearchBoardKey();
        const pvContent = document.getElementById('pv-content');
        if (pvContent) pvContent.innerHTML = '';
        this.requestUpdateGraph();
    };

    proto.scheduleResearchSync = function({ debounceMs = 80 } = {}) {
        if (!backendCommands.hasBackendApi()) return;
        const syncSeq = ++this.researchSyncSeq;
        const historySnapshot = this.moveHistory.map(move => ({ ...move }));
        this.researchBoardKey = this.getResearchBoardKey(historySnapshot);
        if (this.researchSyncTimer) clearTimeout(this.researchSyncTimer);
        this.researchSyncTimer = setTimeout(() => {
            if (!this.isResearchMode || this.researchSyncSeq !== syncSeq) return;
            this.researchSyncTimer = null;
            backendCommands.researchSync(historySnapshot, this.getMultiPVSetting(), this.getThreadSetting(), this.getHashSetting());
        }, debounceMs);
    };

    proto.isAiVsAi = function() {
            const val = document.getElementById('playerColor').value;
            return parseInt(val) === 0;
        
    };

    proto.canTakebackMove = function() {
            if (!this.gameActive || this.isAiVsAi() || this.takebackPending) return false;
            const playerColor = parseInt(document.getElementById('playerColor').value);
            return this.moveHistory.some(move => move.color === playerColor);
        
    };

    proto.updateTakebackButton = function() {
            if (!this.takebackBtn) return;
            this.takebackBtn.disabled = !this.canTakebackMove();
        
    };

    proto.handleClick = function(coords) {
            const x = coords.ix;
            const y = coords.iy;
            if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE || this.board[y][x] !== EMPTY) return; //着手できないときは何もしない
            if (this.quizMode) { this.checkQuizAnswer(x, y); return; }

          if (this.isResearchMode) {
                this.playSound('move');
                const currentColor = (this.moveHistory.length % 2 === 0) ? BLACK : WHITE;
                
                
                this.board[y][x] = currentColor;
                const newMove = {x, y, color: currentColor};

                // 履歴分岐処理
                if (this.moveHistory.length < this.fullGameHistory.length) {
                    this.fullGameHistory = this.fullGameHistory.slice(0, this.moveHistory.length);
                }
                this.moveHistory.push(newMove);
                this.fullGameHistory.push(newMove);
                this.lastMove = {x, y};
                
                // UIに表示させる
                this.resetResearchUiForCurrentPosition();
                this.drawBoard();
                
                this.scheduleResearchSync({ debounceMs: 0 });
                return;
            }

            if (this.reviewMode || !this.gameActive) {
                this.playSound('move');
                const currentColor = (this.moveHistory.length % 2 === 0) ? BLACK : WHITE;
                const newMove = {x, y, color: currentColor};
                if (this.moveHistory.length < this.fullGameHistory.length) { this.fullGameHistory = this.fullGameHistory.slice(0, this.moveHistory.length); }
                this.moveHistory.push(newMove);
                this.fullGameHistory.push(newMove);
                this.resetBoardTo(this.moveHistory);
                this.updateNotationText(); 
                if (backendCommands.hasBackendApi()) backendCommands.playerMove({ x, y });
                return;
            }
            if (!this.isPlayerTurn) return;
            const playerColor = parseInt(document.getElementById('playerColor').value);
            if (playerColor === BLACK) {
                this.board[y][x] = BLACK;
                const forbidden = this.checkForbidden(x, y, false, true);
                this.board[y][x] = EMPTY;
                if (forbidden) { this.statusEl.innerHTML = `<span class="forbidden-msg">禁手(${forbidden.type})です！</span>`; return; }
            }
            this.playSound('move');
            const myColor = (this.moveHistory.length % 2 === 0) ? BLACK : WHITE;
            this.moveHistory.push({ x, y, color: myColor });
            this.resetBoardTo(this.moveHistory);
            this.updateNotationText();
            this.updateTakebackButton();
            if (this.timeIncrements && this.timeIncrements.player > 0) {
                this.timers.player += this.timeIncrements.player;
                this.updateTimerUI(); 
            }
            this.isPlayerTurn = false; 
            this.activeSide = 'rapfi';
            this.lastTick = performance.now();
            if (backendCommands.hasBackendApi()) backendCommands.playerMove({ x, y });
        
    };

    proto.handleRightClick = function(e) { 
            if (this.isResearchMode) {
                if (this.moveHistory.length === 0) return;

                // 1. ローカルの履歴と盤面を更新（最後の手を削除）
                const last = this.moveHistory.pop();
                this.board[last.y][last.x] = 0; // 石を消す
                
                // fullGameHistoryも合わせておく（これをしないと「進む」ボタンでおかしくなる）
                this.fullGameHistory = [...this.moveHistory]; 
                
                // 最終手のマーク位置を更新
                this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;

                // 2. 表示のリセット
                this.resetResearchUiForCurrentPosition();
                this.drawBoard();

                // 3. エンジンと同期（更新後の履歴を送って再解析させる）
                this.scheduleResearchSync({ debounceMs: 120 });
                return;
            }
            if(this.moveHistory.length > 0) this.takebackMove(); 
    };

    proto.startGame = function() {
            // 研究モードがONなら強制終了しておく
            if (this.isResearchMode) {
                this.stopResearchModeUi();
            }
            this.stopAnalysisModeUi();
            this.clearChallengeModeUi();
            this.clearRealtimeEval();

            //二局目以降設定ON時、盤面リセットの確認
           const shouldConfirm = document.getElementById('confResetBoard').checked;

            if (this.hasPlayedOnce && this.moveHistory.length > 0) {
                if (shouldConfirm) {
                    if (confirm("盤面をリセットして対局を開始しますか？\n\n[OK] = リセットして開始\n[キャンセル] = 現在の盤面から開始")) {
                        this.resetBoard();
                        this.fullGameHistory = [];
                    }
                }
                // 設定OFF、またはキャンセルの場合は何もしない（そのままの盤面で下に続く）
            }

            this.setGraphVisibility(false);
            if (this.evalChart) { this.evalChart.destroy(); this.evalChart = null; }
            this.saveConfig();
            const pMin = parseInt(document.getElementById('playerTimeMin').value) || 0;
            const pSec = parseInt(document.getElementById('playerTimeSec').value) || 0;
            const pTime = (pMin * 60) + pSec; 
            const pInc = document.getElementById('playerIncConfig').value;
            const aMin = parseInt(document.getElementById('aiTimeMin').value) || 0;
            const aSec = parseInt(document.getElementById('aiTimeSec').value) || 0;
            const aTime = (aMin * 60) + aSec; 
            const aInc = document.getElementById('aiIncConfig').value;
            const pColor = document.getElementById('playerColor').value;
            const timeRule = document.getElementById('timeRuleMode')?.value || 'normal';
            const playerPerMoveSec = parseInt(document.getElementById('playerPerMoveSec').value) || 10;
            const aiPerMoveSec = parseInt(document.getElementById('aiPerMoveSec').value) || 10;
            const turnTimePercentInput = parseFloat(document.getElementById('engTurnTimePercent').value);
            const turnTimeMarginInput = parseInt(document.getElementById('engTurnTimeMarginMs').value);
            const turnTimePercent = Number.isFinite(turnTimePercentInput) ? turnTimePercentInput : 20;
            const turnTimeMarginMs = Number.isFinite(turnTimeMarginInput) ? turnTimeMarginInput : 500;
            const effectivePlayerTime = timeRule === 'perMove' ? playerPerMoveSec : pTime;
            const effectiveAiTime = timeRule === 'perMove' ? aiPerMoveSec : aTime;
            const effectivePlayerInc = timeRule === 'perMove' ? 0 : parseInt(pInc);
            const effectiveAiInc = timeRule === 'perMove' ? 0 : parseInt(aInc);

            this.timeIncrements = { player: effectivePlayerInc * 1000, rapfi: effectiveAiInc * 1000 };
            const engineSettings = {
                maxMoves: document.getElementById('engMaxMoves').value,
                threads: this.isIOSDevice ? 1 : document.getElementById('engThreads').value,
                maxNodes: document.getElementById('engMaxNodes').value,
                strength: 100,
                maxDepth: document.getElementById('engMaxDepth').value,
                hashSize: document.getElementById('engHashSize').value,
                nbest: document.getElementById('engMultiPV').value,
                turnTimePercent: document.getElementById('engTurnTimePercent').value,
                turnTimeMarginMs: document.getElementById('engTurnTimeMarginMs').value,
                humanStyle: document.getElementById('engHumanStyle').checked,
                blunderThreshold: document.getElementById('engBlunderThreshold').value,
                blunderRate: document.getElementById('engBlunderRate').value,
                missMateRate: document.getElementById('engMissMateRate').value
            };
            this.currentMaxMoves = parseInt(engineSettings.maxMoves);
            this.timers.player = effectivePlayerTime * 1000;
            this.timers.rapfi = effectiveAiTime * 1000;
            this.fullGameHistory = [...this.moveHistory];
            this.setGraphVisibility(false);
            
            if (backendCommands.hasBackendApi()) {
                backendCommands.startGame({ 
                    playerTime: effectivePlayerTime, playerIncrement: effectivePlayerInc, 
                    aiTime: effectiveAiTime, aiIncrement: effectiveAiInc,
                    timeRule: timeRule,
                    playerPerMove: playerPerMoveSec,
                    aiPerMove: aiPerMoveSec,
                    turnTimePercent,
                    turnTimeMarginMs,
                    playerColor: parseInt(pColor), initialStones: this.moveHistory,
                    engineSettings: engineSettings 
                });
                this.statusEl.textContent = "対局開始処理中...";
                this.hasPlayedOnce = true;
            } else {
                alert("Electron API not loaded");
            }
        
    };

    proto.handleGameControl = function() {
            if (this.gameActive) {
                this.finishGame();
            } else {
                this.startGame();
            }
        
    };

    proto.takebackMove = function() {
            if (!this.canTakebackMove()) return;
            this.takebackPending = true;
            this.updateTakebackButton();
            this.statusEl.textContent = "待った処理中...";
            if (this.takebackPendingTimer) clearTimeout(this.takebackPendingTimer);
            this.takebackPendingTimer = setTimeout(() => {
                this.takebackPending = false;
                this.takebackPendingTimer = null;
                this.updateTakebackButton();
            }, 5000);
            backendCommands.takebackMove();
        
    };

    proto.finishGame = function() { 
            if (this.isResearchMode) return;

            if (this.isAiVsAi()) {
                if(confirm("観戦を終了しますか？\n(現在の状態で対局を中断します)")) { 
                    backendCommands.finishGame(); 
                }
            } else {
                if(confirm("対局を終了しますか？")) { 
                    backendCommands.finishGame(); 
                } 
            }
        
    };
}
