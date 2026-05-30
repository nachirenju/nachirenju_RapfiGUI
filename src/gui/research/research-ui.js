/**
 * 「研究モード」固有のUI（読み筋プレビュー、評価値表示）を管理するモジュール。
 * 
 * 送られてくる深さごとのPVやスコアを受け取り、サブキャンバスに読み筋を描画する。
 * 
 * 主な役割:
 * - 高頻度なエンジン出力データのリアルタイムDOM反映
 * - 読み筋（PV）の可視化と候補手レビューUIの管理
 */

import { BLACK, WHITE, MARGIN, CELL_SIZE } from '../board/renju-engine.js';
import * as backendCommands from '../ipc/backend-commands.js';

export function installResearchMethods(proto) {
    proto.closePvWindow = function() {
            document.getElementById('pv-container').style.display = 'none';
        
    };

    proto.togglePvWindow = function() {
            const el = document.getElementById('pv-container');
            el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'flex' : 'none';
        
    };

    proto.updatePvMiniBoard = function(data) {
            const container = document.getElementById('pv-content');
            if (!container) return;
            
            // ウィンドウが表示されていない時は描画処理をサボる（超軽量化）
            if (document.getElementById('pv-container').style.display === 'none') return;

            const boxId = `pv-box-rank-${data.rank}`;
            let box = document.getElementById(boxId);
            let canvas, ctx;

            // まだその順位の枠が無ければ作る
            if (!box) {
                box = document.createElement('div');
                box.id = boxId;
                box.className = 'pv-board-box';
                
                // HTML構造
                box.innerHTML = `
                    <div class="pv-board-info" id="pv-info-${data.rank}"></div>
                    <canvas id="pv-canvas-${data.rank}" width="300" height="300"></canvas>
                    <button class="nav-btn" style="width:100%; margin-top:5px; font-size:11px;" onclick="window.app.openPvReview(${data.rank})">🔍</button>
                `;
                container.appendChild(box);
                
                // 順位順(Rank 1, 2, 3...)に並び替える
                Array.from(container.children)
                    .sort((a, b) => parseInt(a.id.replace('pv-box-rank-', '')) - parseInt(b.id.replace('pv-box-rank-', '')))
                    .forEach(node => container.appendChild(node));
            }

            // 情報テキストの更新
            const infoEl = document.getElementById(`pv-info-${data.rank}`);
            let scoreStr = data.score;
            if (data.score >= 20000) scoreStr = "M" + (30000 - data.score);
            else if (data.score <= -20000) scoreStr = "-M" + (30000 + data.score);
            else if (data.score > 0) scoreStr = "+" + data.score;
            infoEl.innerHTML = `<span style="color:#007bff">Rank ${data.rank}</span> | Depth: ${data.depth} | Eval: ${scoreStr}`;

            canvas = document.getElementById(`pv-canvas-${data.rank}`);
            ctx = canvas.getContext('2d');

            // --- ここから描画処理 ---
            const w = canvas.width;
            const cellSize = w / 15;
            
            // 1. 背景と線を引く
            ctx.fillStyle = this.boardColor || "#F2E2BF";
            ctx.fillRect(0, 0, w, w);
            ctx.beginPath();
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            for(let i=0; i<15; i++) {
                const p = (i + 0.5) * cellSize;
                ctx.moveTo(p, cellSize/2); ctx.lineTo(p, w - cellSize/2);
                ctx.moveTo(cellSize/2, p); ctx.lineTo(w - cellSize/2, p);
            }
            ctx.stroke();

            const drawStone = (x, y, color, numText) => {
                if (x < 0 || x >= 15 || y < 0 || y >= 15) return;
                const cx = (x + 0.5) * cellSize;
                const cy = (y + 0.5) * cellSize;
                ctx.beginPath();
                ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = (color === 1) ? "#000" : "#fff";
                ctx.fill();
                if (color === 2) { ctx.strokeStyle = "#ccc"; ctx.lineWidth=1; ctx.stroke(); }
                
                if (numText) {
                    ctx.fillStyle = (color === 1) ? "#fff" : "#000";
                    ctx.font = "bold 12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(numText, cx, cy);
                }
            };

            // 2. 現在の盤面を描く（番号なし）
            const occupied = Array(15).fill(0).map(() => Array(15).fill(0));
            this.moveHistory.forEach(m => {
                drawStone(m.x, m.y, m.color, null);
                if (m.x >= 0 && m.x < 15 && m.y >= 0 && m.y < 15) {
                    occupied[m.y][m.x] = 1;
                }
            });

            // 3. 読み筋(PV)を描く（番号あり：1, 2, 3...）
            const letters = "abcdefghijklmno";
            let currentColor = data.turnColor; // 最初の石の色

            if (data.pv && data.pv.length > 0) {
                for (let index = 0; index < data.pv.length; index++) {
                    const moveStr = data.pv[index];
                    const colStr = moveStr.charAt(0).toLowerCase();
                    const rowStr = moveStr.substring(1);
                    const x = letters.indexOf(colStr);
                    const y = 15 - parseInt(rowStr, 10);
                    
                    if (x < 0 || x >= 15 || y < 0 || y >= 15 || occupied[y][x]) {
                        break;
                    }
                    occupied[y][x] = 1;
                    
                    drawStone(x, y, currentColor, (index + 1).toString());
                    
                    // 次の手は相手の色
                    currentColor = (currentColor === 1) ? 2 : 1;
                }
            }
        
    };

    proto.openPvReview = function(rank) {
            // 現在の候補手データから該当rankのものを探す
            const candidateKey = Object.keys(this.researchCandidates).find(key => this.researchCandidates[key].rank === rank);
            if (!candidateKey) return;
            const data = this.researchCandidates[candidateKey];

            // 再生用のデータをセット
            this.pvReviewData = {
                rank: data.rank,
                baseHistory: [...this.moveHistory], // 実戦の履歴
                pv: data.pv || [],                  // ["h8", "i9", ...] の配列
                step: 1,                            // 最初は1手目（AIの推奨手）を表示
                score: data.score,
                startColor: data.turnColor
            };

            document.getElementById('pvReviewRank').textContent = data.rank;
            document.getElementById('pvReviewModal').style.display = 'block';
            this.drawPvReviewBoard();
        
    };

    proto.closePvReview = function() {
            document.getElementById('pvReviewModal').style.display = 'none';
        
    };

    proto.pvReviewPrev = function() {
            if (this.pvReviewData.step > 0) {
                this.pvReviewData.step--;
                this.drawPvReviewBoard();
            }
        
    };

    proto.pvReviewNext = function() {
            if (this.pvReviewData.step < this.pvReviewData.pv.length) {
                this.pvReviewData.step++;
                this.drawPvReviewBoard();
            }
        
    };

    proto.pvReviewFirst = function() {
            if (this.pvReviewData && this.pvReviewData.step > 0) {
                this.pvReviewData.step = 0;
                this.drawPvReviewBoard();
            }
        
    };

    proto.pvReviewLast = function() {
            if (this.pvReviewData && this.pvReviewData.step < this.pvReviewData.pv.length) {
                this.pvReviewData.step = this.pvReviewData.pv.length;
                this.drawPvReviewBoard();
            }
        
    };

    proto.drawPvReviewBoard = function() {
            if (!this.pvReviewData) return;
            const canvas = document.getElementById('pvReviewCanvas');
            const ctx = canvas.getContext('2d');
            
            // 1. 盤面の背景（キャッシュ）を描画
            ctx.drawImage(this.bgCanvas, 0, 0);

            // 描画ヘルパー関数 (既存の石画像を利用)
            const drawStoneToCtx = (x, y, color, number) => {
                const cx = MARGIN + x * CELL_SIZE;
                const cy = MARGIN + y * CELL_SIZE;
                const stoneImg = (color === BLACK) ? this.blackStoneImg : this.whiteStoneImg;
                if (stoneImg) ctx.drawImage(stoneImg, cx - 15, cy - 15);
                
                if (number !== null) {
                    ctx.fillStyle = (color === BLACK) ? "white" : "black";
                    ctx.font = "bold 12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(number.toString(), cx, cy);
                }
            };

            // 2. 実戦の履歴を描画（番号なし）
            const occupied = Array(15).fill(0).map(() => Array(15).fill(0));
            this.pvReviewData.baseHistory.forEach(m => {
                drawStoneToCtx(m.x, m.y, m.color, null);
                if (m.x >= 0 && m.x < 15 && m.y >= 0 && m.y < 15) {
                    occupied[m.y][m.x] = 1;
                }
            });

            // 3. PV（読み筋）の進行を描画（1, 2, 3... と番号あり）
            const letters = "abcdefghijklmno";
            let currentColor = this.pvReviewData.startColor;
            let lastMove = null;

            for (let i = 0; i < this.pvReviewData.step; i++) {
                if (i >= this.pvReviewData.pv.length) break;
                
                const moveStr = this.pvReviewData.pv[i]; // "h8" などを座標に変換
                const x = letters.indexOf(moveStr.charAt(0).toLowerCase());
                const y = 15 - parseInt(moveStr.substring(1), 10);
                
                if (x < 0 || x >= 15 || y < 0 || y >= 15 || occupied[y][x]) {
                    break;
                }
                occupied[y][x] = 1;
                
                drawStoneToCtx(x, y, currentColor, (i + 1).toString());
                lastMove = {x, y};
                
                currentColor = (currentColor === 1) ? 2 : 1; // 色を反転
            }

            // スコアを人間が読みやすい形式（Mate表記など）に変換
            let scoreText = "";
            const score = this.pvReviewData.score;
            if (score !== undefined) {
                if (score > 20000) {
                    scoreText = ` <span style="margin-left:15px; color:#d9534f;">[Eval: +M${30000 - score}]</span>`;
                } else if (score < -20000) {
                    scoreText = ` <span style="margin-left:15px; color:#d9534f;">[Eval: -M${score + 30000}]</span>`;
                } else {
                    const sign = score > 0 ? "+" : "";
                    scoreText = ` <span style="margin-left:15px; color:#28a745;">[Eval: ${sign}${score}]</span>`;
                }
            }

         // 4. 最終手の赤い四角マークとテキスト更新
            if(lastMove) {
                ctx.strokeStyle = "red"; ctx.lineWidth = 2;
                ctx.strokeRect(MARGIN + lastMove.x*CELL_SIZE - 7, MARGIN + lastMove.y*CELL_SIZE - 7, 14, 14);
                
                const currentMoveStr = this.pvReviewData.pv[this.pvReviewData.step - 1];
                document.getElementById('pvReviewText').innerHTML = `読み筋 <span style="color:#007bff">${this.pvReviewData.step}</span> 手目 : ${currentMoveStr}${scoreText}`;
            } else {
                document.getElementById('pvReviewText').innerHTML = `開始局面（進行前）${scoreText}`;
            }
         //5. 棋譜をコピペできるように表示させる
         const notationEl = document.getElementById('pvReviewNotation');
            if (notationEl && this.pvReviewData) {
                let notationHtml = "";
                
                // 1. 実戦履歴（baseHistory）を座標から符号（小文字）に変換
                const letters = "abcdefghijklmno";
                const baseMoves = this.pvReviewData.baseHistory.map(m => `${letters[m.x]}${15 - m.y}`);
                
                // 2. 読み筋（pv）をすべて小文字に統一
                const pvMoves = (this.pvReviewData.pv || []).map(m => m.toLowerCase());
                
                // 3. 実戦履歴と読み筋を結合して「フル棋譜配列」を作る
                const fullMoves = [...baseMoves, ...pvMoves];
                
                // 現在フォーカスしている手の全体のインデックスを計算
                const currentFocusIndex = baseMoves.length + this.pvReviewData.step - 1;

                // スペースや余分なパディングを無くしてベタ打ちで結合
                fullMoves.forEach((move, index) => {
                    if (index === currentFocusIndex) {
                        // 現在見ている手（直前に打たれた手）
                        notationHtml += `<span style="color: #FF5C7A; font-weight: bold; background-color: rgba(255, 92, 122, 0.15); border-radius: 3px; padding: 1px 3px;">${move}</span>`;
                    } else if (index < currentFocusIndex) {
                        // 既に盤面に置かれている手（実戦＋進めた読み筋）
                        notationHtml += `<span style="color: var(--text-main); font-weight: 500;">${move}</span>`;
                    } else {
                        // まだ進めていない先の手（未来の読み筋）
                        notationHtml += `<span style="color: var(--text-muted);">${move}</span>`;
                    }
                });
                
                notationEl.innerHTML = notationHtml;
            }
        
    };

    proto.getMultiPVSetting = function() {
            const input = document.getElementById('engMultiPV');
            return input ? (parseInt(input.value) || 3) : 3;
        
    };

    proto.getThreadSetting = function() {
            if (this.isIOSDevice) return 1;
            const input = document.getElementById('engThreads');
            return input ? (parseInt(input.value) || 1) : 1;
        
    };

    proto.getHashSetting = function() {
            const input = document.getElementById('engHashSize');
            return input ? (parseInt(input.value) || 17000) : 17000;
        
    };

    proto.toggleResearchMode = function() {
    if (this.gameActive) { alert("対局中は切り替えられません"); return; }
    
    this.isResearchMode = !this.isResearchMode;
    this.clearRealtimeEval();
    const btn = document.getElementById('btnResearch');
    
    if (this.isResearchMode) {
        btn.classList.add('active');
        btn.textContent = "計算停止";
        this.statusEl.textContent = "研究モード: 盤面をクリックして進行 / AI解析中...";
        this.researchCandidates = {}; // リセット
        document.getElementById('pv-content').innerHTML = ''; // 読み筋プレビューをクリア

        this.setGraphVisibility(true);
        this.researchEvals = [];
        this.requestUpdateGraph();
        
        // Mainプロセスへ通知
       if (backendCommands.hasBackendApi()) {
                    
                    backendCommands.toggleResearch(true, this.getMultiPVSetting(), this.getThreadSetting(), this.getHashSetting());
                    
                    // 同期時も渡す
                    backendCommands.researchSync(this.moveHistory, this.getMultiPVSetting(), this.getThreadSetting(), this.getHashSetting());
                }
    } else {
        btn.classList.remove('active');
        btn.textContent = "研究モード";
        this.statusEl.textContent = "検討モード";
        this.researchCandidates = {};
        document.getElementById('pv-content').innerHTML = ''; // 読み筋プレビューをクリア
        this.drawBoard();
        
        // Mainプロセスへ通知
        if (backendCommands.hasBackendApi()) backendCommands.toggleResearch(false);
    }

    };
}
