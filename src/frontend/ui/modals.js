/**
 * アプリ内で使用される各種モーダルダイアログの開閉・表示制御モジュール。
 * 
 * モーダルのZインデックス管理、背景のオーバーレイ処理などを一元管理し、モーダル間の競合を防ぐ。
 * 
 * 主な役割:
 * - 共通のモーダル開閉ロジックの提供
 * - モーダル表示時のスクロールロック管理
 */

import * as backendCommands from '../ipc/backend-commands.js';

export function installModalMethods(proto) {
    proto.openLoadModal = function() { 
            if (this.gameActive) { alert("対局中は開けません"); return; } 
            this.modalEl.style.display = 'block'; 
            this.selectedRecordId = null; 
            this.renderModalList(); 
        
    };

    proto.closeLoadModal = function() { this.modalEl.style.display = 'none'; 
    };

    proto.drawThumbnail = function(canvas, moves, maxMoves) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const cellSize = w / 15; // 15路盤
            
            // 背景
            ctx.fillStyle = "#F9EBCF";
            ctx.fillRect(0, 0, w, h);
            
            // 罫線
            ctx.beginPath();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "#888";
            for(let i=0; i<15; i++) {
                const p = (i + 0.5) * cellSize;
                ctx.moveTo(p, cellSize/2);
                ctx.lineTo(p, h - cellSize/2);
                ctx.moveTo(cellSize/2, p);
                ctx.lineTo(w - cellSize/2, p);
            }
            ctx.stroke();
            
            // 星（天元など）
            ctx.fillStyle = "#000";
            [[3,3], [11,3], [7,7], [3,11], [11,11]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc((x+0.5)*cellSize, (y+0.5)*cellSize, 1.5, 0, Math.PI*2);
                ctx.fill();
            });

            // 石を描画
            const limit = (maxMoves && maxMoves < moves.length) ? maxMoves : moves.length;
            for(let i=0; i<limit; i++) {
                const m = moves[i];
                if (m.x < 0 || m.x >= 15 || m.y < 0 || m.y >= 15) continue;

                const cx = (m.x + 0.5) * cellSize;
                const cy = (m.y + 0.5) * cellSize;
                const r = cellSize * 0.4;
                
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI*2);
                ctx.fillStyle = (m.color === 1) ? "#000" : "#fff";
                ctx.fill();
                
                // 白石の輪郭
                if (m.color === 2) {
                    ctx.lineWidth = 0.5;
                    ctx.strokeStyle = "#ccc";
                    ctx.stroke();
                }
            }
        
    };

    proto.renderModalList = function() {
            this.modalListEl.innerHTML = "";
            let w = 0, l = 0, d = 0;
            let lastDateStr = null;
            this.recordList.forEach((r, index) => {
                let titleColor = "#666"; 
                if (r.winner) {
                    if (r.winner === 'User') { w++; titleColor = "#007bff"; } 
                    else if (r.winner === 'Rapfi') { l++; titleColor = "#dc3545"; } 
                    else { d++; titleColor = "#666"; }
                } else {
                    if (r.title.includes("Draw")) { d++; titleColor = "#666"; } 
                    else if ((r.title.includes("●User") && r.title.includes("Black win")) || (!r.title.includes("●User") && r.title.includes("White win"))) { w++; titleColor = "#007bff"; } 
                    else { l++; titleColor = "#dc3545"; }
                }

                const li = document.createElement('li');
                li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.alignItems = "center"; li.style.padding = "10px 15px";

                const num = this.recordList.length - index;
                const numStr = num.toString().padStart(2, '0');

                const ts = r.timestamp || r.id;
                const dateObj = new Date(ts);
                const y = dateObj.getFullYear();
                const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const day = dateObj.getDate().toString().padStart(2, '0');
                const h = dateObj.getHours().toString().padStart(2, '0');
                const min = dateObj.getMinutes().toString().padStart(2, '0');
                const datePart = `${y}/${m}/${day}`;
                const fullDateStr = `${datePart}/${h}:${min}`;

                let dateDisplayHtml = "";
                if (datePart === lastDateStr) {
                    dateDisplayHtml = `<span style="visibility:hidden;">${datePart}/</span>${h}:${min}`;
                } else {
                    dateDisplayHtml = fullDateStr;
                    lastDateStr = datePart;
                }

                let simpleTitle = r.title.replace(/\d{12,14}/, "").replace(/\s+/g, " ").trim();
                simpleTitle = simpleTitle.replace("Draw win", "Draw");

                const textContainer = document.createElement('div');
                textContainer.className = 'list-text';
                textContainer.style.flex = "1";
                textContainer.style.display = "flex";
                textContainer.style.flexDirection = "column";
                textContainer.style.justifyContent = "center";
                
                const numDiv = document.createElement('div');
                numDiv.innerHTML = `<span style="font-size:18px; font-weight:bold; color:#333;">${numStr}</span>`;
                numDiv.style.marginBottom = "12px"; 

                const infoDiv = document.createElement('div');
                infoDiv.style.fontSize = "13px";
                infoDiv.style.color = "#555";
                infoDiv.innerHTML = `
                    <span style="font-family:monospace; font-weight:bold;">${dateDisplayHtml}</span> 
                    <span style="margin-left:8px; color:${titleColor}; font-weight:bold;">${simpleTitle}</span>
                `;

                textContainer.appendChild(numDiv);
                textContainer.appendChild(infoDiv);

                const canvas = document.createElement('canvas');
                canvas.className = 'list-thumb';
                canvas.width = 100; canvas.height = 100;
                this.drawThumbnail(canvas, r.moves || [], 20);

                if (r.id === this.selectedRecordId) li.classList.add('selected');
                li.onclick = () => { this.selectedRecordId = r.id; this.renderModalList(); };
                li.appendChild(textContainer);
                li.appendChild(canvas);
                this.modalListEl.appendChild(li);
            });
            const t = w + l + d;
            const rate = t > 0 ? ((w / t) * 100).toFixed(1) : "0.0";
            document.getElementById('statsBar').innerHTML = `<span style="color:#007bff">Win: ${w}</span> - <span style="color:#dc3545">Loss: ${l}</span> - <span style="color:#666">Draw: ${d}</span> (勝率 ${rate}%)`;
        
    };

    proto.openSelectedRecord = function() { if (!this.selectedRecordId) { alert("選択してください"); return; } backendCommands.loadGameRecord(this.selectedRecordId); 
    };

    proto.deleteSelectedRecord = function() { if (!this.selectedRecordId) { alert("選択してください"); return; } if (confirm("本当に削除しますか？")) { backendCommands.deleteGameRecord(this.selectedRecordId); this.selectedRecordId = null; } 
    };
}
