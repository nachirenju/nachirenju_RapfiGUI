/**
 * 「次の一手クイズ」のリスト表示と管理を行うUIモジュール。
 * 
 * 解析結果から抽出されたクイズデータを一覧表示し、ユーザーがクイズに再挑戦するためのモード遷移をハンドリングする。
 * 
 * 主な役割:
 * - クイズデータのDOMレンダリングとインタラクション処理
 * - クイズ実行モードと通常モードの切り替え制御
 */

import { MARGIN, CELL_SIZE } from '../board/renju-engine.js';
import * as backendCommands from '../ipc/backend-commands.js';

export function installQuizListMethods(proto) {
    proto.openQuizModal = function() {
            if (this.gameActive) { alert("対局中は利用できません"); return; }
            const selectBtn = document.querySelector('#quizModal .modal-footer button[onclick*="toggleSelectAllQuizzes"]');
            if (selectBtn) {
                selectBtn.textContent = "全て選択";
                selectBtn.style.backgroundColor = "#20c997";
            }
            if (!this.quizList || this.quizList.length === 0) { 
                document.getElementById('quizListDisplay').innerHTML = '<li style="padding:20px; text-align:center;">保存されたクイズはありません。</li>';
                this.quizModal.style.display = 'block';
                return; 
            }
            const listEl = document.getElementById('quizListDisplay');
            listEl.innerHTML = "";
            [...this.quizList].reverse().forEach(q => {
                const li = document.createElement('li');
                this.drawThumbnail(this.thumbCanvas, q.historyBefore, q.historyBefore.length);
                const thumbUrl = this.thumbCanvas.toDataURL();
                let badgeClass = "bg-que";
                if(q.type === "悪手") badgeClass = "bg-bad";
                if(q.type === "勝ち逃し") badgeClass = "bg-miss";
                if(q.type === "敗着") badgeClass = "bg-lose";
                const turnText = q.turn === 1 ? "黒番" : "白番";
                li.innerHTML = `
                    <input type="checkbox" class="quiz-checkbox" value="${q.id}">
                    <img src="${thumbUrl}" class="quiz-thumbnail" style="width:80px; height:80px; margin-right:10px; border:1px solid #ccc; background:#F9EBCF;">
                    <div style="flex:1; cursor:pointer;" onclick="window.app.startQuiz(${q.id})">
                        <div style="margin-bottom:4px;">
                            <span class="quiz-badge ${badgeClass}">${q.type}</span> 
                            <strong>${q.moveNum}手目</strong> (${turnText})
                        </div>
                        <div style="font-size:12px; color:#666;">
                            実戦: ${this.getNotation(q.badMove.x, q.badMove.y)}
                        </div>
                    </div>
                    <button class="modal-btn btn-open" onclick="window.app.startQuiz(${q.id})">挑戦</button>
                `;
                listEl.appendChild(li);
            });
            this.quizModal.style.display = 'block';
        
    };

    proto.deleteSelectedQuizzes = function() {
            const checkedBoxes = document.querySelectorAll('.quiz-checkbox:checked');
            if (checkedBoxes.length === 0) { alert("削除する項目を選択してください。"); return; }
            if (!confirm(`選択した ${checkedBoxes.length} 件のクイズを削除しますか？`)) { return; }
            const idsToDelete = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
            this.quizList = this.quizList.filter(q => !idsToDelete.includes(q.id));
            backendCommands.saveQuizList(this.quizList);
            this.openQuizModal();
        
    };

    proto.closeQuizModal = function() {
            this.quizModal.style.display = 'none';
        
    };

    proto.downloadQuizJson = function() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.quizList, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "next_move_quiz.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        
    };

    proto.startQuiz = function(id) {
            const quiz = this.quizList.find(q => q.id === id);
            if (!quiz) return;
            this.closeQuizModal();
            this.quizMode = true;
            this.currentQuiz = quiz;
            this.moveHistory = [...quiz.historyBefore];
            this.resetBoardTo(this.moveHistory);
            document.getElementById('btnQuitQuiz').style.display = 'inline-block';
            this.statusEl.innerHTML = `【クイズモード】 ${quiz.moveNum}手目 (${quiz.turn===1?"黒":"白"}) の <span style="font-weight:bold; color:#d00;">${quiz.type}</span> 局面。<br>次の一手（最善手）を指してください。`;
            document.querySelector('.board-wrapper').style.boxShadow = "0 0 15px rgba(156, 39, 176, 0.6)"; 
        
    };

    proto.endQuizMode = function() {
            this.quizMode = false;
            this.currentQuiz = null;
            document.querySelector('.board-wrapper').style.boxShadow = "";
            this.statusEl.textContent = "検討モード";
            this.resetBoardTo(this.moveHistory); 
        
    };

    proto.checkQuizAnswer = function(x, y) {
            if (!this.currentQuiz) return;
            const correct = this.currentQuiz.bestMove;
            const isCorrect = (x === correct.x && y === correct.y);
            if (isCorrect) {
                this.showFeedback("正解！", true);
                let lineText = "";
                if (this.currentQuiz.bestLine && this.currentQuiz.bestLine.length > 0) {
                    lineText = this.currentQuiz.bestLine.map(m => {
                        if (typeof m === 'object' && m.x !== undefined) return this.getNotation(m.x, m.y);
                        return m.toString();
                    }).join(" → ");
                }
                const actualMoveStr = this.getNotation(this.currentQuiz.badMove.x, this.currentQuiz.badMove.y);
                this.statusEl.innerHTML = `
                    <div style="line-height:1.5;">
                        <span style="color:green; font-weight:bold; font-size:1.2em;">正解！</span> 
                        <span style="font-weight:bold;">${this.getNotation(x,y)}</span> が最善手でした。<br>
                        <span style="font-size: 0.9em; color: #d00;">(実戦の手: <strong>${actualMoveStr}</strong>)</span><br>
                        <span style="font-size: 0.9em; color: #666;">Rapfiの読み筋: <strong>${lineText}</strong></span>
                    </div>
                `;
                this.moveHistory.push({x, y, color: this.currentQuiz.turn});
                this.resetBoardTo(this.moveHistory);
                setTimeout(() => {
                     this.visualizeBestLine(this.currentQuiz.bestLine);
                     this.drawActualMove(this.currentQuiz.badMove);
                }, 500);
                this.quizMode = false;
                document.querySelector('.board-wrapper').style.boxShadow = ""; 
                document.getElementById('btnQuitQuiz').style.display = 'none';
            } else {
                this.showFeedback("不正解...", false);
            }
        
    };

    proto.showFeedback = function(text, isSuccess) {
            this.quizOverlay.textContent = text;
            this.quizOverlay.className = isSuccess ? "quiz-correct" : "quiz-wrong";
            setTimeout(() => {
                this.quizOverlay.className = "";
                this.quizOverlay.textContent = "";
            }, 1500);
        
    };

    proto.quitQuizMode = function() {
            this.quizMode = false;
            this.currentQuiz = null;
            document.getElementById('btnQuitQuiz').style.display = 'none';
            document.querySelector('.board-wrapper').style.boxShadow = "";
            this.statusEl.textContent = "クイズを終了し、検討モードに戻りました。";
        
    };

    proto.toggleSelectAllQuizzes = function(btn) {
            const checkboxes = document.querySelectorAll('.quiz-checkbox');
            const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
            checkboxes.forEach(cb => { cb.checked = anyUnchecked; });
            btn.textContent = anyUnchecked ? "全選択解除" : "全て選択";
            btn.style.backgroundColor = anyUnchecked ? "#6c757d" : "#20c997";
        
    };

    proto.visualizeBestLine = function(line) {
            // lineが空、または「正解手のみ」しかない場合は何もしない
            if (!line || line.length <= 1) return;
            
            // 先頭（正解手そのもの）を除外し、続きの手順のみを取り出す
            const continuation = line.slice(1);
            
            // 色の決定: 正解手(this.currentQuiz.turn)の「次」の手番からスタート
            let currentColor = (this.currentQuiz.turn === 1) ? 2 : 1;
            
            // 手数の決定
            const startNum = this.moveHistory.length;

            const letters = "abcdefghijklmno";

            continuation.forEach((move, i) => {
                const num = startNum + 1 + i;
                
                let x, y;

                // --- 座標データの形式判定と変換 ---
                if (typeof move === 'object' && move.x !== undefined) {
                    // 既にオブジェクト形式 {x: 7, y: 7} の場合
                    x = move.x;
                    y = move.y;
                } else if (typeof move === 'string') {
                    // 文字列形式 "H8" や "h8" の場合
                    const colStr = move.charAt(0).toLowerCase(); // 'h'
                    const rowStr = move.substring(1);            // '8'
                    
                    x = letters.indexOf(colStr);                 // 7
                    y = 15 - parseInt(rowStr, 10);               // 7 (15-8)
                }

                // 座標が正常に取得できた場合のみ描画
                if (x !== undefined && y !== undefined && x >= 0 && x < 15 && y >= 0 && y < 15) {
                    // 半透明で描画
                    this.drawStone(x, y, currentColor, 0.8, num);
                }
                
                // 次の手のために色を反転
                currentColor = (currentColor === 1) ? 2 : 1;
            });
        
    };

    proto.drawActualMove = function(move) {
            if (!move) return;
            const cx = MARGIN + move.x * CELL_SIZE;
            const cy = MARGIN + move.y * CELL_SIZE;
            this.drawStone(move.x, move.y, move.color, 0.5);
            this.ctx.save();
            this.ctx.strokeStyle = "#dc3545"; 
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 8, cy - 8);
            this.ctx.lineTo(cx + 8, cy + 8);
            this.ctx.moveTo(cx + 8, cy - 8);
            this.ctx.lineTo(cx - 8, cy + 8);
            this.ctx.stroke();
            this.ctx.fillStyle = "#dc3545";
            this.ctx.font = "bold 11px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "bottom";
            this.ctx.fillText("実戦", cx, cy - 10);
            this.ctx.restore();
        
    };

    proto.saveCurrentPositionAsQuiz = function() {
            if (this.gameActive) { alert("対局中は保存できません"); return; }
            if (this.moveHistory.length === 0) { alert("盤面に石がありません"); return; }
            const moveNum = this.moveHistory.length;
            const actualMove = this.moveHistory[moveNum - 1]; 
            const analysisForThisPos = this.lastAnalysisResults ? this.lastAnalysisResults.find(r => r.move === moveNum - 1) : null;
            const newQuiz = {
                id: Date.now(), moveNum: moveNum, type: "ユーザー登録", turn: actualMove.color, 
                historyBefore: this.moveHistory.slice(0, moveNum - 1), 
                bestMove: actualMove, badMove: actualMove, 
                candidates: analysisForThisPos ? (analysisForThisPos.candidates || []) : [],
                bestLine: analysisForThisPos && analysisForThisPos.candidates && analysisForThisPos.candidates[0] ? analysisForThisPos.candidates[0].pv : [],
                scoreBest: analysisForThisPos ? analysisForThisPos.score : 0, scoreBad: analysisForThisPos ? analysisForThisPos.score : 0 
            };
            this.quizList.push(newQuiz);
            backendCommands.saveQuizList(this.quizList);
            alert(`${moveNum}手目（${this.getNotation(actualMove.x, actualMove.y)}）を正解としてクイズに保存しました！`);
        
    };
}
