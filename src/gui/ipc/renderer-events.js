/**
 * バックエンドプロセスから送信されるイベントの受信・ルーティングモジュール。
 * 
 * 思考出力（PV・評価値）、着手通知、エラーなどの非同期イベントをリスニングし、適切なUIコンポーネントへディスパッチする。
 * 
 * 主な役割:
 * - バックエンドからの非同期イベントのエントリーポイント
 * - イベントペイロードの解析と該当ハンドラーの呼び出し
 */

// Renderer IPC event bindings extracted from RapfiApp.
import { EMPTY } from '../board/renju-engine.js';
import { saveAnalysisResult } from './backend-commands.js';

export function registerIpcEvents(app) {
            if (!window.electronAPI) return;

            window.electronAPI.onEngineReady(() => {
                if (typeof originalLog !== 'undefined') {
                    originalLog("AI engine loading complete.");
                } else {
                    console.log("AI engine loading complete.");
                }
                app.engineReady = true;
                app.updateGameControlButton();
                document.querySelector('.analyze-btn').disabled = false;
                document.getElementById('btnResearch').disabled = false;
                const btnChallenge = document.getElementById('btnChallenge');
                if (btnChallenge) btnChallenge.disabled = false;
                app.statusEl.textContent = "AI準備完了！";
            });

            if (!window.electronAPI) return;

            window.electronAPI.onGameStarted((data) => {
                app.takebackPending = false;
                if (app.takebackPendingTimer) {
                    clearTimeout(app.takebackPendingTimer);
                    app.takebackPendingTimer = null;
                }
                app.stopAnalysisModeUi();
                if (app.isResearchMode) {
                    app.stopResearchModeUi({ notifyBackend: false, updateStatus: false });
                }
                app.gameActive = true; app.reviewMode = false;
                app.activeSide = (data.turn === 'player') ? 'player' : 'rapfi';
                app.isPlayerTurn = (data.turn === 'player');
                if(data.playerTime) app.timers.player = data.playerTime * 1000;
                if(data.aiTime) app.timers.rapfi = data.aiTime * 1000;
                app.statusEl.textContent = app.isPlayerTurn ? "あなたの番です" : "Rapfi思考中...";

                // 観戦モードならタイマーの名前を変更する
                if (app.isAiVsAi()) {
                    document.querySelector('#playerTimerBox .timer-label').textContent = "Rapfi (黒)";
                    document.querySelector('#rapfiTimerBox .timer-label').textContent = "Rapfi (白)";
                } else {
                    document.querySelector('#playerTimerBox .timer-label').textContent = "あなた";
                    document.querySelector('#rapfiTimerBox .timer-label').textContent = "Rapfi";
                }

                app.lastTick = performance.now();
                app.fullGameHistory = [...app.moveHistory];
                app.currentRecordId = null;
                document.querySelector('.analyze-btn').disabled = true;
                app.statsContainer.style.display = 'none';
                document.getElementById('btnReset').disabled = true;
                document.getElementById('notationDisplay').readOnly = true;
                app.updateTakebackButton();
                app.updateGameControlButton();
                const cec = document.getElementById('challengeEndControls');
                if (cec) cec.style.display = 'none';
                const skipBtn = document.getElementById('btnSkipChallenge');
                if (skipBtn) skipBtn.style.display = app.challengeMode ? 'inline-block' : 'none';
            });

            window.electronAPI.onMove((data) => {
                if (app.takebackPending) return;
                if (app.board[data.y][data.x] !== EMPTY) {
                    // ここはAI思考中のクリック防止用なので、AI vs AIではあまり関係ないが維持
                    if (app.gameActive && !app.isAiVsAi()) { 
                        app.isPlayerTurn = false; app.activeSide = 'rapfi'; app.statusEl.textContent = "Rapfi思考中..."; 
                    }
                    return; 
                }
                app.playSound('move');
                app.board[data.y][data.x] = data.color;
                app.moveHistory.push({ x: data.x, y: data.y, color: data.color });
                app.lastMove = { x: data.x, y: data.y };
                app.drawBoard();
                app.updateTakebackButton();
                
                if (app.gameActive) {
                    // サーバーから送られてきた正確な残り時間で同期
                    if (data.aiTime !== undefined) app.timers.rapfi = data.aiTime;
                    if (data.playerTime !== undefined) app.timers.player = data.playerTime;
                    app.updateTimerUI();
                    
                    // ★修正: 次の手番判定ロジック
                    const playerColorVal = parseInt(document.getElementById('playerColor').value);
                    const isSpectator = (playerColorVal === 0); // 観戦モード判定

                    if (isSpectator) {
                        // AI vs AI の場合
                        // 直前に打たれた石の色(data.color)が黒なら、次は白(Rapfiタイマー)
                        // 直前に打たれた石の色(data.color)が白なら、次は黒(Playerタイマー)
                        // ※main.js側で PlayerTimer=黒, RapfiTimer=白 として扱っている前提
                        
                        if (data.color === 1) { // 黒が打った -> 次は白
                            app.activeSide = 'rapfi';
                            app.statusEl.textContent = "白番AI思考中...";
                        } else { // 白が打った -> 次は黒
                            app.activeSide = 'player';
                            app.statusEl.textContent = "黒番AI思考中...";
                        }
                        app.isPlayerTurn = false; // 常に人間は打てない
                    } else {
                        // 既存の User vs AI のロジック
                        // AIが打ってきた(data.isAI=true)なら、次は人間(player)
                        app.isPlayerTurn = true; 
                        app.activeSide = 'player';
                        app.statusEl.textContent = "あなたの番です";
                    }
                    
                    app.lastTick = performance.now();
                }
            });

            window.electronAPI.onUndoResult((data) => {
                app.takebackPending = false;
                if (app.takebackPendingTimer) {
                    clearTimeout(app.takebackPendingTimer);
                    app.takebackPendingTimer = null;
                }
                app.moveHistory = data.moveHistory;
                app.resetBoardTo(app.moveHistory);
                app.fullGameHistory = [...app.moveHistory];
                app.lastMove = app.moveHistory.length > 0 ? app.moveHistory[app.moveHistory.length - 1] : null;
                app.updateNotationText();
                if (data.takeback) {
                    app.isPlayerTurn = true;
                    app.activeSide = 'player';
                    app.statusEl.textContent = "あなたの番です";
                    app.lastTick = performance.now();
                }
                app.updateTakebackButton();
            });

          window.electronAPI.onAiLog((msgs) => {
                const logContainer = document.getElementById('aiLogContainer');
                if (!logContainer) return;
                
                // main.js から配列でドバッと来るパターンと、1行だけ来るパターン両方に対応
                const messages = Array.isArray(msgs) ? msgs : [msgs];
                
                // メッセージを追加
                messages.forEach(msg => {
                    //  評価値の抽出とリアルタイム表示
                    if (msg.includes('Eval') && msg.includes('Depth') && msg.includes('MESSAGE')) {
                        // MultiPVでRank2以降の候補手のログは無視し、最善手の評価値だけを拾う
                        if (!msg.match(/\([2-9]\)/) && !msg.match(/\([1-9][0-9]\)/)) {
                            const evalMatch = msg.match(/Eval\s+([+-]?M?\d+|[+-]?\d+)/i);
                            if (evalMatch) {
                                app.updateRealtimeEval(evalMatch[1]);
                            }
                        }
                    }
                    const div = document.createElement('div');
                    div.textContent = msg;
                    if (msg.includes('[AI PV]')) div.style.color = '#4ec9b0';
                    if (msg.includes('[LowLevel AI]')) div.style.color = '#ce9178';
                    if (msg.includes('BLUNDER')) div.style.color = '#f44747'; 
                    logContainer.appendChild(div);
                });

                
                while (logContainer.childNodes.length > 100) {
                    logContainer.removeChild(logContainer.firstChild);
                }

                // 一番下までスクロール
                logContainer.scrollTop = logContainer.scrollHeight;
            });

            // 対局終了イベント
            window.electronAPI.onGameOver((data) => {
                app.takebackPending = false;
                if (app.takebackPendingTimer) {
                    clearTimeout(app.takebackPendingTimer);
                    app.takebackPendingTimer = null;
                }
                app.gameActive = false; 
                app.setGraphVisibility(true);
                app.reviewMode = true; 
                app.activeSide = null;
                app.updateTakebackButton();
                document.getElementById('btnReset').disabled = false;
                document.querySelector('.analyze-btn').disabled = false;
                document.getElementById('notationDisplay').readOnly = false;
                document.querySelector('#playerTimerBox .timer-label').textContent = "あなた";
                document.querySelector('#rapfiTimerBox .timer-label').textContent = "Rapfi";
                app.updateGameControlButton();

                if (app.challengeMode) {
                    const skipBtn = document.getElementById('btnSkipChallenge');
                    if (skipBtn) skipBtn.style.display = 'none';
                    const cec = document.getElementById('challengeEndControls');
                    if (cec) cec.style.display = 'flex';
                    
                    if (data.reason !== 'manual' && data.reason !== 'draw' && data.winner !== 'Rapfi') {
                        app.markChallengeSolved(app.currentChallenge.challengeId);
                    }
                }

                if (data.reason === 'timeout') {
                    //  音を鳴らしてからアラートを出す
                    app.playSound('timeout');
                    
                    // 音が鳴り始めるのを0.1秒待ってからアラートを表示（ブラウザの描画停止対策）
                    setTimeout(() => {
                        alert(data.winner === 'Rapfi' ? "時間切れ！あなたの負けです" : "Rapfiの時間切れ！");
                    }, 100);

                } else if (data.reason === 'manual') {
                    alert('対局を終了しました。');
                    app.statusEl.textContent = '対局終了';
                } else if (data.reason === 'draw') {
                    const limitMsg = (app.currentMaxMoves > 0) ? `${app.currentMaxMoves}手` : "規定手数";
                    alert(`${limitMsg}に達したため、規定により引き分けです。`);
                    app.statusEl.textContent = "対局終了 - 引き分け";
                } else {
                    alert(`${data.winner}の勝ちです！`);
                    app.statusEl.textContent = `対局終了 - ${data.winner}の勝利`;
                }
            });

            window.electronAPI.onShowGraph((historyData) => {
                app.graphContainer.style.display = 'block';
                app.statusEl.textContent = "対局終了 - 検討モード";
                app.fullGameHistory = [...app.moveHistory];
                app.drawGraph(historyData);
                app.statsContainer.style.display = 'none';
            });

            window.electronAPI.onHistoryList((list) => {
                app.recordList = list;
                if (app.modalEl.style.display === 'block') app.renderModalList();
            });

            window.electronAPI.onLoadRecordData((data) => {
                app.closeLoadModal();
                app.stopAnalysisModeUi();
                if (app.isResearchMode) {
                    app.stopResearchModeUi({ notifyBackend: false, updateStatus: false });
                }
                app.gameActive = false; app.reviewMode = true; app.activeSide = null;
                app.clearChallengeModeUi();
                app.statusEl.textContent = "過去の棋譜をロードしました";
                app.fullGameHistory = data.moves;
                app.currentRecordId = data.id; 
                app.goToLast(); 
                if (data.evals && data.evals.length > 0) {
                    app.drawGraph(data.evals);
                    app.statsContainer.style.display = 'none';
                } else {
                    app.graphContainer.style.display = 'none';
                }
                document.querySelector('.analyze-btn').disabled = false;
                app.updateGameControlButton();
            });

            window.electronAPI.onAnalysisProgress((data) => {
                if (!app.analysisModeActive) return;
                console.log(`進捗受信: ${data.current}/${data.total} (Score: ${data.score})`);
                document.getElementById('progressWrapper').style.display = 'block';
                document.getElementById('analyzeProgress').max = data.total;
                document.getElementById('analyzeProgress').value = data.current;
                document.getElementById('progressText').textContent = `${data.current}/${data.total}`;
            });

            window.electronAPI.onQuizListData((list) => {
                if (list && list.length > 0) {
                    app.quizList = list;
                    console.log(`保存されたクイズ ${list.length}問 をロードしました`);
                }
            });

            window.electronAPI.onAnalysisComplete((results) => {
                if (!app.analysisModeActive) return;
                app.analysisModeActive = false;
                alert("解析が完了しました。");
                document.getElementById('progressWrapper').style.display = 'none';
                app.lastAnalysisResults = results;
                app.setGraphVisibility(true);
                app.drawGraph(results);
                app.calculateAndShowStats(results);
                if (app.currentRecordId) {
                    saveAnalysisResult({ recordId: app.currentRecordId, evals: results });
                }
            });
        window.electronAPI.onResearchUpdate((data) => {
                if (!app.isResearchMode || app.gameActive || app.analysisModeActive) return;
                // data = { rank, depth, x, y, score, turnColor }

                if (app.board[data.y][data.x] !== EMPTY) {
                return;
            }

            if (data.depth < app.currentResearchDepth - 3) {
                app.currentResearchDepth = 0;
            }
                
                // 1. 深さが進んだらリセット (既存の処理)
                if (data.depth > app.currentResearchDepth) {
                    app.currentResearchDepth = data.depth;
                    app.researchCandidates = {}; 

                    const pvContent = document.getElementById('pv-content');//ミニ盤もリセット
                    if (pvContent) pvContent.innerHTML = ''; 
    
                }

                // 同じ順位(rank)のデータが既に存在する場合、それは古い情報なので消す
                // (例: 同じDepth内で、最善手が F7 から K5 に変わった場合など)
                Object.keys(app.researchCandidates).forEach(key => {
                    if (app.researchCandidates[key].rank === data.rank) {
                        delete app.researchCandidates[key];
                    }
                });

                // 2. データを登録 (既存の処理)
                const key = `${data.x},${data.y}`;
                app.researchCandidates[key] = data;
                
                app.drawBoard(); // 再描画

                if (data.rank === 1) {
                    const currentMoveNum = app.moveHistory.length;
                    // AIのスコアを手番から見て「黒番視点」のスコアに変換して記録
                    const blackViewScore = (data.turnColor === 2) ? -data.score : data.score;
                    app.researchEvals[currentMoveNum] = blackViewScore;
                    app.requestUpdateGraph();
                    
                }
                app.updatePvMiniBoard(data);
            });
        
}
