/**
 * クイズリストの内容を印刷用のPDFファイルとしてエクスポートするモジュール。
 * 
 * 盤面図のレンダリング結果と解説テキストを指定のフォーマットにレイアウトしてPDFドキュメントを生成する。
 * 
 * 主な役割:
 * - HTML Canvasの盤面状態の画像化と配置
 * - 複数ページのPDFレイアウト制御およびファイル出力処理
 */

export function installQuizPdfMethods(proto) {
    proto.downloadQuizPdf = async function() {
            if (!this.quizList || this.quizList.length === 0) { alert("クイズがありません。"); return; }
            if (!confirm(`${this.quizList.length}問分のPDFを作成します。\nこれには数秒かかる場合があります。`)) return;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const cvs = document.createElement('canvas');
            const ctx = cvs.getContext('2d');
            cvs.width = 1200; cvs.height = 1600; 
            const sortedList = [...this.quizList].sort((a, b) => a.id - b.id);
            for (let i = 0; i < sortedList.length; i++) {
                const q = sortedList[i];
                this.drawPdfPage(ctx, cvs.width, cvs.height, q, i + 1, false);
                const imgDataQ = cvs.toDataURL('image/jpeg', 0.8);
                doc.addImage(imgDataQ, 'JPEG', 0, 0, 210, 297); 
                doc.addPage(); 
                this.drawPdfPage(ctx, cvs.width, cvs.height, q, i + 1, true);
                const imgDataA = cvs.toDataURL('image/jpeg', 0.8);
                doc.addImage(imgDataA, 'JPEG', 0, 0, 210, 297);
                if (i < sortedList.length - 1) { doc.addPage(); }
            }
            doc.save('Rapfi_NextMove_Quiz.pdf');
        
    };

    proto.drawStoneForPdf = function(ctx, cx, cy, cellSize, color, opacity, number) {
            const r = cellSize * 0.43; // 石の半径
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI*2);
            
            // グラデーション作成
            const grad = ctx.createRadialGradient(cx - r/3, cy - r/3, r/10, cx, cy, r);
            if (color === 1) { // 黒
                grad.addColorStop(0, "#666"); 
                grad.addColorStop(1, "#000"); 
            } else { // 白
                grad.addColorStop(0, "#fff"); 
                grad.addColorStop(1, "#ccc"); 
            }
            ctx.fillStyle = grad;
            ctx.fill();

            // 手数表示
            if (number !== null) {
                ctx.fillStyle = (color === 1) ? "white" : "black";
                ctx.font = `bold ${cellSize * 0.5}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(number.toString(), cx, cy);
            }
            ctx.restore();
        
    };

    proto.drawPdfPage = function(ctx, w, h, quiz, index, isAnswer) {
            ctx.fillStyle = "white"; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#333"; ctx.textAlign = "center"; ctx.textBaseline = "top";
            ctx.font = "bold 50px sans-serif";
            ctx.fillText(isAnswer ? `第 ${index} 問  解答` : `第 ${index} 問`, w / 2, 50);

            if (!isAnswer) {
                const turnText = quiz.turn === 1 ? "黒番" : "白番";
                let typeColor = "#666";
                if (quiz.type === "悪手" || quiz.type === "敗着") typeColor = "#dc3545";
                else if (quiz.type === "勝ち逃し") typeColor = "#d63384";
                else if (quiz.type === "疑問手") typeColor = "#ffc107";
                ctx.fillStyle = "#333"; ctx.font = "40px sans-serif"; ctx.fillText(`【 ${turnText} 】`, w / 2, 130);
                ctx.fillStyle = typeColor; ctx.font = "bold 50px sans-serif"; ctx.fillText(`この局面での最善手は？`, w / 2, 200);
                ctx.fillStyle = "#666"; ctx.font = "25px sans-serif"; ctx.fillText("実戦では「" + quiz.type + "」が打たれました。", w / 2, 270);
            } else {
                const bestMoveStr = this.getNotation(quiz.bestMove.x, quiz.bestMove.y);
                ctx.fillStyle = "#28a745"; ctx.font = "bold 60px sans-serif"; ctx.fillText(`正解手：${bestMoveStr}`, w / 2, 130);
                const loss = (quiz.turn === 1) ? (quiz.scoreBest - quiz.scoreBad) : (quiz.scoreBad - quiz.scoreBest);
                const fmtScore = (s) => { if (s >= 20000) return "黒勝ち(M)"; if (s <= -20000) return "白勝ち(M)"; return s > 0 ? `+${s}` : `${s}`; };
                const scoreText = `評価値: ${fmtScore(quiz.scoreBest)} → ${fmtScore(quiz.scoreBad)}`;
                const lossText = `(${loss}点 ダウン)`;
                ctx.font = "bold 30px sans-serif"; ctx.fillStyle = "#333"; ctx.fillText(scoreText, w / 2, 210);
                ctx.fillStyle = "#dc3545"; ctx.fillText(lossText, w / 2, 250);
            }

            const boardMargin = 80; const boardSizePx = w - (boardMargin * 2); const boardTop = 330; 
            ctx.fillStyle = "#F9EBCF"; ctx.fillRect(boardMargin, boardTop, boardSizePx, boardSizePx);
            ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath();
            const cellSize = boardSizePx / 15; 
            const getX = (x) => boardMargin + (x + 0.5) * cellSize;
            const getY = (y) => boardTop + (y + 0.5) * cellSize;
            for (let i = 0; i < 15; i++) {
                const p = boardMargin + (i + 0.5) * cellSize;
                ctx.moveTo(p, boardTop + cellSize/2); ctx.lineTo(p, boardTop + boardSizePx - cellSize/2);
                ctx.moveTo(boardMargin + cellSize/2, boardTop + (i + 0.5) * cellSize); ctx.lineTo(boardMargin + boardSizePx - cellSize/2, boardTop + (i + 0.5) * cellSize);
            }
            ctx.stroke();
            ctx.fillStyle = "#000"; [[3,3], [11,3], [7,7], [3,11], [11,11]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(getX(sx), getY(sy), 4, 0, Math.PI*2); ctx.fill(); });
            ctx.font = "bold 20px Arial"; ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            const letters = "ABCDEFGHIJKLMNO";
            for(let i=0; i<15; i++) { ctx.fillText((15-i).toString(), boardMargin/2, getY(i)); ctx.fillText(letters[i], getX(i), boardTop + boardSizePx + 20); }
            quiz.historyBefore.forEach((m, idx) => { this.drawStoneForPdf(ctx, getX(m.x), getY(m.y), cellSize, m.color, 1.0, idx + 1); });

            if (!isAnswer) {
                if (quiz.historyBefore && quiz.historyBefore.length > 0) {
                    const lastMove = quiz.historyBefore[quiz.historyBefore.length - 1];
                    const lastX = getX(lastMove.x); const lastY = getY(lastMove.y);
                    ctx.save(); ctx.strokeStyle = "#007bff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lastX, lastY, cellSize * 0.48, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
                }
            } else {
                const nextMoveNum = quiz.historyBefore.length + 1;
                const bestX = getX(quiz.bestMove.x); const bestY = getY(quiz.bestMove.y);
                this.drawStoneForPdf(ctx, bestX, bestY, cellSize, quiz.turn, 1.0, nextMoveNum);
                ctx.save(); ctx.strokeStyle = "#28a745"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(bestX, bestY, cellSize * 0.48, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = "#28a745"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("正解", bestX, bestY - cellSize * 0.55); ctx.restore();

                const candidateLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                if (quiz.candidates && quiz.candidates.length > 0) {
                    quiz.candidates.forEach((cand, idx) => {
                        const isBest = (cand.x === quiz.bestMove.x && cand.y === quiz.bestMove.y);
                        const isBad  = (cand.x === quiz.badMove.x && cand.y === quiz.badMove.y);
                        if (!isBest && !isBad) {
                            const cx = getX(cand.x); const cy = getY(cand.y); const label = candidateLabels[idx] || "?";
                            const s = cand.score; const scoreStr = (s >= 20000) ? "M" : (s <= -20000) ? "M" : (s > 0 ? `+${s}` : `${s}`);
                            this.drawCandidate(ctx, cx, cy, cellSize, label, scoreStr);
                        }
                    });
                }
                const bx = getX(quiz.badMove.x); const by = getY(quiz.badMove.y);
                this.drawStoneForPdf(ctx, bx, by, cellSize, quiz.badMove.color, 0.4, null);
                ctx.save(); ctx.strokeStyle = "#dc3545"; ctx.lineWidth = 8; ctx.beginPath();
                const crossSize = cellSize * 0.3;
                ctx.moveTo(bx - crossSize, by - crossSize); ctx.lineTo(bx + crossSize, by + crossSize); ctx.moveTo(bx + crossSize, by - crossSize); ctx.lineTo(bx - crossSize, by + crossSize); ctx.stroke();
                ctx.fillStyle = "#dc3545"; ctx.font = "bold 24px sans-serif"; ctx.fillText("実戦", bx, by - cellSize * 0.6); ctx.restore();

                const footerTop = boardTop + boardSizePx + 45; 
                ctx.fillStyle = "#333"; ctx.textAlign = "left"; ctx.font = "24px sans-serif"; 
                const actualStr = this.getNotation(quiz.badMove.x, quiz.badMove.y);
                ctx.fillText(`■ 実戦の手: ${actualStr} (${quiz.type})`, 80, footerTop);
                let currentTextY = footerTop + 35;
                if (quiz.candidates && quiz.candidates.length > 0) {
                    ctx.fillStyle = "#0056b3"; ctx.font = "22px sans-serif"; 
                    let candText = "参考: "; let count = 0;
                    quiz.candidates.forEach((cand, idx) => {
                        const label = candidateLabels[idx];
                        const isBest = (cand.x === quiz.bestMove.x && cand.y === quiz.bestMove.y);
                        const isBad  = (cand.x === quiz.badMove.x && cand.y === quiz.badMove.y);
                        if (!isBest && !isBad) {
                            const s = cand.score; const scoreStr = (s >= 20000) ? "M" : (s <= -20000) ? "M" : (s > 0 ? `+${s}` : `${s}`);
                            const moveStr = this.getNotation(cand.x, cand.y);
                            candText += ` [${label}] ${moveStr} (${scoreStr})  `; count++;
                        }
                    });
                    if(count > 0) { ctx.fillText(candText, 80, currentTextY); currentTextY += 35; }
                }
                let lineText = "";
                if (quiz.bestLine && quiz.bestLine.length > 0) {
                    lineText = quiz.bestLine.map(m => {
                        if (typeof m === 'object' && m.x !== undefined) return this.getNotation(m.x, m.y);
                        return m.toString().toUpperCase();
                    }).join(" → ");
                }
                ctx.fillStyle = "#333"; ctx.font = "24px sans-serif"; 
                if (lineText) {
                    const splitText = (text, chunk) => { const arr = []; for(let i=0; i<text.length; i+=chunk) arr.push(text.slice(i, i+chunk)); return arr; };
                    const lines = splitText(lineText, 70);
                    ctx.fillText(`■ 最善進行 (Rapfi):`, 80, currentTextY);
                    ctx.font = "20px monospace"; 
                    lines.forEach((line, lIdx) => { ctx.fillText(line, 110, currentTextY + 30 + (lIdx * 25)); });
                } else { ctx.fillText(`■ 最善進行: (記録なし)`, 80, currentTextY); }
            }
        
    };

    proto.drawCandidate = function(ctx, cx, cy, cellSize, label, scoreStr) {
            ctx.save(); ctx.beginPath(); ctx.fillStyle = "rgba(0, 123, 255, 0.7)"; ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 26px sans-serif"; ctx.fillText(label, cx, cy - 6); 
            ctx.font = "bold 13px sans-serif"; ctx.fillText(scoreStr, cx, cy + 16); ctx.restore();
        
    };
}
