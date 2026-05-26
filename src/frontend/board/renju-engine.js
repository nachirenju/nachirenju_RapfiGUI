/**
 * フロントエンド側での連珠の基本ルールエンジンモジュール。
 * 
 * 着手可能な位置の判定や、五連の成立チェックなど、軽量なルール検証をクライアント側で即座に行うためのロジックを実装する。
 * 
 * 主な役割:
 * - 盤面配列の更新と基本的な勝敗判定
 * - ユーザー操作に対する即時フィードバック用ルールの提供
 */

// Board engine extracted from the former inline frontend script.
export const BOARD_SIZE = 15;
    export const EMPTY = 0;
    export const BLACK = 1; 
    export const WHITE = 2; 
    export const MARGIN = 30; 
    export const CELL_SIZE = 34; 

    //盤面の描画、クリック処理、禁手判定、棋譜表記を管理
   export class RenjuEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(EMPTY));
        this.moveHistory = [];
        this.showNumbers = true;
        this.enableMoveSound = true;
        this.enableTimeSound = true;
        this.showBoardCoordinates = true;
        this.useStoneShading = true;
        this.lastMove = null;
        this.DIRS = [[1,0], [0,1], [1,1], [1,-1]];
        
        // タッチ操作用変数
        this.touchTimer = null;
        this.startTouchX = 0;
        this.startTouchY = 0;

        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.canvas.width;
        this.bgCanvas.height = this.canvas.height;
        this.bgCtx = this.bgCanvas.getContext('2d'); // 透明度不要で高速化
        this.initBackground(); // 背景を1回だけ描画して保存

        this.drawBoard();

        // --- Event Listeners ---
        this.canvas.addEventListener('mousedown', e => { 
            if(e.button === 0) {
                const coords = this.getBoardCoords(e);
                this.handleBoardInput(coords.ix, coords.iy);
            }
        });

        this.canvas.addEventListener('touchstart', e => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            this.startTouchX = touch.clientX;
            this.startTouchY = touch.clientY;
            const coords = this.getBoardCoords(touch);
            this.lastTouchCoords = coords;
            this.touchTimer = setTimeout(() => {
                this.handleBoardRightClick(coords.ix, coords.iy);
                this.touchTimer = null;
                this.lastTouchCoords = null;
            }, 500);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const moveX = touch.clientX;
            const moveY = touch.clientY;
            const diffX = moveX - this.startTouchX;
            const diffY = moveY - this.startTouchY;
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            if (distance > 10) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
                this.lastTouchCoords = null;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', e => {
            if (e.cancelable) e.preventDefault();
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
                if (this.lastTouchCoords) {
                    this.handleBoardInput(this.lastTouchCoords.ix, this.lastTouchCoords.iy);
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', e => { 
            e.preventDefault(); 
            const coords = this.getBoardCoords(e);
            this.handleBoardRightClick(coords.ix, coords.iy); 
        });

        this.drawBoard();
    }

    getBoardCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return { ix: -1, iy: -1 };
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const xPos = (clientX - rect.left) * scaleX;
        const yPos = (clientY - rect.top) * scaleY;
        const ix = Math.round((xPos - MARGIN) / CELL_SIZE);
        const iy = Math.round((yPos - MARGIN) / CELL_SIZE);
        return { ix, iy };
    }

    handleBoardInput(ix, iy) {
        if (ix >= 0 && ix < BOARD_SIZE && iy >= 0 && iy < BOARD_SIZE) {
            this.handleClick({ ix, iy });
        }
    }

    handleBoardRightClick(ix, iy) {
        this.handleRightClick();
    }

    resetBoard() {
        for(let y=0; y<BOARD_SIZE; y++) this.board[y].fill(EMPTY);
        this.moveHistory = [];
        this.lastMove = null;
        this.drawBoard();
    }

    // 盤面の背景（線や座標）を1回だけ描画するメソッド
    initBackground() {
        const ctx = this.bgCtx;
        
        // 背景色
        ctx.fillStyle = this.boardColor || "#F9EBCF";
        ctx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        if (this.showBoardCoordinates !== false) {
            ctx.fillStyle = "#000";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            for(let i=0; i<BOARD_SIZE; i++) {
                const y = MARGIN + i * CELL_SIZE;
                ctx.fillText((15-i).toString(), MARGIN/2, y);
            }
            const letters = "ABCDEFGHIJKLMNO";
            for(let i=0; i<BOARD_SIZE; i++) {
                const x = MARGIN + i * CELL_SIZE;
                ctx.fillText(letters[i], x, this.bgCanvas.height - MARGIN/2);
            }
        }

        // 罫線を描く
        ctx.strokeStyle = "#000"; 
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < BOARD_SIZE; i++) {
            const p = MARGIN + i * CELL_SIZE;
            ctx.moveTo(MARGIN, p); ctx.lineTo(MARGIN + 14 * CELL_SIZE, p);
            ctx.moveTo(p, MARGIN); ctx.lineTo(p, MARGIN + 14 * CELL_SIZE);
        }
        ctx.stroke();
        
        // 星（黒い点）を描く
        const stars = [[3,3], [11,3], [7,7], [3,11], [11,11]];
        ctx.fillStyle = "#000";
        stars.forEach(([x, y]) => {
            ctx.beginPath(); 
            ctx.arc(MARGIN + x * CELL_SIZE, MARGIN + y * CELL_SIZE, 3, 0, Math.PI*2); 
            ctx.fill();
        });

        this.blackStoneImg = this.createStoneImage(BLACK);
        this.whiteStoneImg = this.createStoneImage(WHITE);
    }

    createStoneImage(color) {
        const cvs = document.createElement('canvas');
        cvs.width = 30; // 石の直径 (15 * 2)
        cvs.height = 30;
        const ctx = cvs.getContext('2d', { alpha: true });
        
        ctx.beginPath();
        ctx.arc(15, 15, 15, 0, Math.PI * 2);
        if (this.useStoneShading === false) {
            ctx.fillStyle = color === BLACK ? "#111" : "#f7f7f7";
            ctx.fill();
            ctx.strokeStyle = color === BLACK ? "#000" : "#999";
            ctx.lineWidth = 1;
            ctx.stroke();
            return cvs;
        }
        const grad = ctx.createRadialGradient(10, 10, 2, 15, 15, 15);
        if (color === BLACK) { 
            grad.addColorStop(0, "#666"); 
            grad.addColorStop(1, "#000"); 
        } else { 
            grad.addColorStop(0, "#fff"); 
            grad.addColorStop(1, "#ccc"); 
        }
        ctx.fillStyle = grad;
        ctx.fill();
        return cvs;
    }


    drawBoard() {
        // 1. キャッシュした背景画像を1発で描画（劇的に軽い）
        this.ctx.drawImage(this.bgCanvas, 0, 0);

        // 2. 石を描画
        this.moveHistory.forEach((move, index) => {
            this.drawStone(move.x, move.y, move.color, 1.0, index + 1);
        });
        
        // 3. 最終手の赤い四角マーク
        if(this.lastMove) {
            this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 2;
            this.ctx.strokeRect(MARGIN + this.lastMove.x*CELL_SIZE - 7, MARGIN + this.lastMove.y*CELL_SIZE - 7, 14, 14);
        }
        
        // 4. 研究モード等のオーバーレイ
        if (this.isResearchMode) {
            this.drawResearchOverlays();
        }
        
        this.updateNotationText();
    }

   
      drawResearchOverlays() {
            const ctx = this.ctx;
            const K = 210; // 勝率計算用定数

            for (const key in this.researchCandidates) {
                const data = this.researchCandidates[key];
                const cx = MARGIN + data.x * CELL_SIZE;
                const cy = MARGIN + data.y * CELL_SIZE;
                
                // --- 円の描画 ---
                let fillStyle, strokeStyle;
                
                if (data.rank === 1) {
                    // 1位: スカイブルー (濃いめの枠線)
                    fillStyle = "rgba(0, 191, 255, 0.85)"; // DeepSkyBlue
                    strokeStyle = "#00008B"; // DarkBlue
                } else if (data.rank === 2) {
                    // 2位: 黄緑 (濃いめの枠線)
                    fillStyle = "rgba(50, 205, 50, 0.85)"; // LimeGreen
                    strokeStyle = "#006400"; // DarkGreen
                } else if (data.rank === 3) {
                    // 3位: オレンジ (濃いめの枠線)
                    fillStyle = "rgba(255, 165, 0, 0.85)"; // Orange
                    strokeStyle = "#8B4500"; // Chocolate/DarkOrange
                } else {
                    // その他: グレー
                    fillStyle = "rgba(100, 100, 100, 0.8)"; 
                    strokeStyle = "#333333";
                }

                ctx.beginPath();
                ctx.arc(cx, cy, 15, 0, Math.PI * 2);
                ctx.fillStyle = fillStyle;
                ctx.fill();
                
                ctx.lineWidth = 2; // 細い線
                ctx.strokeStyle = strokeStyle;
                ctx.stroke();

                // --- テキスト描画 (白文字 + 黒縁取り) ---
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white";     // 文字色
                ctx.strokeStyle = "black";   // 縁取り色
                ctx.lineWidth = 2;         // 縁取りの太さ（文字が小さいので極細にする）

                // ヘルパー関数: 縁取り付きテキスト描画
                const drawOutlinedText = (text, x, y, font) => {
                    ctx.font = font;
                    ctx.strokeText(text, x, y); // 先に縁取り
                    ctx.fillText(text, x, y);   // 上に白文字
                };
                
                // 1. 順位
                drawOutlinedText(`(${data.rank})`, cx, cy - 9, "bold 10px Arial");

                // 2. 評価値 (Mの場合は手数を計算して表示)
                let scoreText = data.score;
                if (data.score >= 20000) {
                    const moves = 30000 - data.score;
                    scoreText = "M" + moves;
                } else if (data.score <= -20000) {
                    const moves = 30000 + data.score;
                    scoreText = "-M" + Math.abs(moves);
                }
                drawOutlinedText(scoreText, cx, cy + 1, "bold 11px Arial");

                // 3. 勝率
                let viewScore = data.score;
                if (viewScore >= 20000) viewScore = 30000;
                if (viewScore <= -20000) viewScore = -30000;
                
                const winRate = 1 / (1 + Math.exp(-viewScore / K));
                const winRatePct = Math.round(winRate * 100);

                drawOutlinedText(`${winRatePct}%`, cx, cy + 11, "10px Arial");
            }
        }

    updateNotationText() {
        if (this._lastMoveCount === this.moveHistory.length) return;
        this._lastMoveCount = this.moveHistory.length;

        const notationArea = document.getElementById('notationDisplay');
        const sgfInput = document.getElementById('sgfText');
        const isNotationFocused = (document.activeElement === notationArea);
        const isSgfFocused = (document.activeElement === sgfInput);

        const letters = "abcdefghijklmno";
        const legacyNotation = this.moveHistory.map(m => letters[m.x] + (15 - m.y)).join("");
        if (!isNotationFocused && notationArea) notationArea.value = legacyNotation;

        let sgfValue = "(;GM[1]SZ[15])";
        if (this.moveHistory.length > 0) {
            let s = "";
            this.moveHistory.forEach((m) => {
                const side = (m.color === 1) ? "B" : "W";
                const col = String.fromCharCode(97 + m.x);
                const row = String.fromCharCode(97 + m.y);
                s += `;${side}[${col}${row}]`;
            });
            sgfValue = `(;GM[1]SZ[15]\n${s})`;
        }
        if (!isSgfFocused && sgfInput) sgfInput.value = sgfValue;
    }

  drawStone(x, y, color, opacity=1.0, number=null) {
        const cx = MARGIN + x * CELL_SIZE;
        const cy = MARGIN + y * CELL_SIZE;
        
        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        
        // キャッシュした石の画像を貼り付け（中心座標を合わせるため -15 ずらす）
        const stoneImg = (color === BLACK) ? this.blackStoneImg : this.whiteStoneImg;
        if (stoneImg) {
            this.ctx.drawImage(stoneImg, cx - 15, cy - 15);
        }

        // 手数（数字）の描画
        if (this.showNumbers && number !== null) {
            this.ctx.fillStyle = (color === BLACK) ? "white" : "black";
            this.ctx.font = "bold 12px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(number.toString(), cx, cy);
        }
        
        this.ctx.restore();
    }

    handleClick(e) {} 
    handleInput(e) { const coords = this.getBoardCoords(e); this.handleBoardInput(coords.ix, coords.iy); }
    handleRightClick(e) {}
    
    // 禁手ロジック
    checkForbidden(x, y, isSimulation, checkThree) {
        let fourDetails=[];for(let d=0;d<4;d++){const dx=this.DIRS[d][0],dy=this.DIRS[d][1];let cnt=1,tx=x+dx,ty=y+dy;while(tx>=0&&tx<15&&ty>=0&&ty<15&&this.board[ty][tx]===BLACK){cnt++;tx+=dx;ty+=dy;}tx=x-dx;ty=y-dy;while(tx>=0&&tx<15&&ty>=0&&ty<15&&this.board[ty][tx]===BLACK){cnt++;tx-=dx;ty-=dy;}if(cnt>=6)return{type:"長連",details:[]};let patternsInDir=this.countFourPatterns(x,y,dx,dy,BLACK);if(cnt===4&&patternsInDir>1)patternsInDir=1;if(patternsInDir>0)for(let i=0;i<patternsInDir;i++)fourDetails.push({dx,dy});}if(fourDetails.length>=2)return{type:"四四",details:fourDetails};if(!checkThree)return null;let threeDetails=[];for(let d=0;d<4;d++){const dx=this.DIRS[d][0],dy=this.DIRS[d][1];const points=this.findThreeVitalPointsNoAlloc(x,y,dx,dy);if(points){for(const p of points){this.board[p.y][p.x]=BLACK;const isForbidden=this.checkForbidden(p.x,p.y,true,false);const makesFour=this.checkValidStraightFourNoAlloc(p.x,p.y,BLACK);this.board[p.y][p.x]=EMPTY;if(!isForbidden&&makesFour){threeDetails.push({dx,dy,vitalPoint:p});break;}}}}if(threeDetails.length>=2)return{type:"三三",details:threeDetails};return null;
    }
    countFourPatterns(x,y,dx,dy,color){const winningSpots=new Set();for(let start=-4;start<=0;start++){let sCnt=0,eCnt=0,gapX=-1,gapY=-1;for(let k=0;k<5;k++){const tx=x+(start+k)*dx,ty=y+(start+k)*dy;if(tx<0||tx>=15||ty<0||ty>=15){eCnt=99;break;}const v=this.board[ty][tx];if(v===color)sCnt++;else if(v===EMPTY){eCnt++;gapX=tx;gapY=ty;}else{eCnt=99;break;}}if(sCnt===4&&eCnt===1){const key=`${gapX},${gapY}`;if(!winningSpots.has(key)){if(color===BLACK){this.board[gapY][gapX]=BLACK;let cnt=1,tx=gapX+dx,ty=gapY+dy;while(tx>=0&&tx<15&&ty>=0&&ty<15&&this.board[ty][tx]===BLACK){cnt++;tx+=dx;ty+=dy;}tx=gapX-dx;ty=gapY-dy;while(tx>=0&&tx<15&&ty>=0&&ty<15&&this.board[ty][tx]===BLACK){cnt++;tx-=dx;ty-=dy;}this.board[gapY][gapX]=EMPTY;if(cnt>5)continue;}winningSpots.add(key);}}}return winningSpots.size;}
    findThreeVitalPointsNoAlloc(x,y,dx,dy){const points=[];const line=new Int8Array(11);for(let k=-5;k<=5;k++){const tx=x+k*dx,ty=y+k*dy;if(tx<0||tx>=15||ty<0||ty>=15)line[k+5]=2;else{const v=this.board[ty][tx];line[k+5]=(v===BLACK?1:(v===EMPTY?0:2));}}for(let i=1;i<=6;i++){let s=0,e=0;for(let j=0;j<5;j++){if(line[i+j]===1)s++;else if(line[i+j]===0)e++;else{e=99;break;}}if(s===3&&e===2){if(line[i-1]===1||line[i+5]===1)continue;for(let j=0;j<5;j++){if(line[i+j]===0&&(line[i+j-1]===1||line[i+j+1]===1)){points.push({x:x+(i+j-5)*dx,y:y+(i+j-5)*dy});}}}}return points.length>0?points:null;}
    checkValidStraightFourNoAlloc(x,y,color){for(let d=0;d<4;d++){const dx=this.DIRS[d][0],dy=this.DIRS[d][1];for(let start=-4;start<=0;start++){const lK=start,rK=start+5;if(!this.isVal(x,y,dx,dy,lK,EMPTY))continue;if(!this.isVal(x,y,dx,dy,rK,EMPTY))continue;let match=true;for(let k=1;k<=4;k++){if(!this.isVal(x,y,dx,dy,start+k,color)){match=false;break;}}if(match&&this.canWinAt(x,y,dx,dy,lK,color)&&this.canWinAt(x,y,dx,dy,rK,color))return true;}}return false;}
    isVal(cx,cy,dx,dy,k,val){if(k===0)return true;const tx=cx+k*dx,ty=cy+k*dy;if(tx<0||tx>=15||ty<0||ty>=15)return false;return this.board[ty][tx]===val;}
    canWinAt(cx,cy,dx,dy,k,color){const tx=cx+k*dx,ty=cy+k*dy;if(tx<0||tx>=15||ty<0||ty>=15||this.board[ty][tx]!==EMPTY)return false;this.board[ty][tx]=color;const win=this.checkWin(tx,ty,color);this.board[ty][tx]=EMPTY;return win;}
    checkWin(x,y,color){let cnt=1;let tx=x+1;while(tx<15&&this.board[y][tx]===color){cnt++;tx++;}tx=x-1;while(tx>=0&&this.board[y][tx]===color){cnt++;tx--;}if(color===BLACK?cnt===5:cnt>=5)return true;cnt=1;let ty=y+1;while(ty<15&&this.board[ty][x]===color){cnt++;ty++;}ty=y-1;while(ty>=0&&this.board[ty][x]===color){cnt++;ty--;}if(color===BLACK?cnt===5:cnt>=5)return true;cnt=1;tx=x+1;ty=y+1;while(tx<15&&ty<15&&this.board[ty][tx]===color){cnt++;tx++;ty++;}tx=x-1;ty=y-1;while(tx>=0&&ty>=0&&this.board[ty][tx]===color){cnt++;tx--;ty--;}if(color===BLACK?cnt===5:cnt>=5)return true;cnt=1;tx=x+1;ty=y-1;while(tx<15&&ty>=0&&this.board[ty][tx]===color){cnt++;tx++;ty--;}tx=x-1;ty=y+1;while(tx>=0&&ty<15&&this.board[ty][tx]===color){cnt++;tx--;ty++;}if(color===BLACK?cnt===5:cnt>=5)return true;return false;}
}


