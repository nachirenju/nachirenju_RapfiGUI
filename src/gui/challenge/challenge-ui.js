import * as backendCommands from '../ipc/backend-commands.js';

export function installChallengeMethods(proto) {
    proto.openChallengeModal = async function() {
        if (this.gameActive) {
            alert("対局中は開けません");
            return;
        }
        
        const modal = document.getElementById('challengeModal');
        const listEl = document.getElementById('challengeListDisplay');
        if (!modal || !listEl) return;
        
        modal.style.display = 'block';
        listEl.innerHTML = `<li style="padding:15px;">${this.translateUiText('読み込み中...')}</li>`;
        
        try {
            const url = (window.BASE_URL || './') + 'missingwin.json';
            const res = await fetch(url);
            if (!res.ok) throw new Error("JSON fetch failed");
            const data = await res.json();
            
            this.challengeMap = new Map();
            data.forEach((item, i) => {
                const challengeId = item.id ?? `game_${item.game_id}_ply_${item.ply}_${item.side}`;
                item.challengeId = challengeId;
                this.challengeMap.set(challengeId, item);
                
                // Parse notation
                const rawMoves = [];
                const tokenRegex = /[a-oA-O](?:1[0-5]|[1-9])/g;
                let match;
                let color = 1;
                let hasError = false;
                
                // Strip allowed delimiters (spaces, commas, newlines) and check for invalid chars
                const stripped = (item.notation || "").replace(/[\s,]+/g, '');
                const validTokens = stripped.match(tokenRegex) || [];
                if (validTokens.join('').length !== stripped.length) {
                    hasError = true;
                }
                
                const boardSet = new Set();
                while ((match = tokenRegex.exec(item.notation)) !== null) {
                    const m = match[0];
                    const x = "abcdefghijklmno".indexOf(m[0].toLowerCase());
                    const y = 15 - parseInt(m.substring(1));
                    
                    if (x < 0 || x >= 15 || y < 0 || y >= 15) {
                        hasError = true;
                        break;
                    }
                    const posKey = `${x},${y}`;
                    if (boardSet.has(posKey)) {
                        hasError = true;
                        break;
                    }
                    boardSet.add(posKey);
                    
                    rawMoves.push({ x, y, color });
                    color = (color === 1) ? 2 : 1;
                }
                
                item._parsedMoves = rawMoves;
                item._hasError = hasError;
                item._startColor = (rawMoves.length % 2 === 0) ? 1 : 2;
                item.originalIndex = i + 1;
            });
            
            this.challengeDataList = data;

            // --- Migration of old challenge IDs to new stable IDs ---
            try {
                const savedStr = localStorage.getItem('rapfi_solved_challenges');
                if (savedStr) {
                    let solved = JSON.parse(savedStr);
                    let needsSave = false;
                    Object.keys(solved).forEach(key => {
                        if (key.startsWith('challenge-') && solved[key]) {
                            const index = parseInt(key.replace('challenge-', ''), 10);
                            if (!isNaN(index) && index >= 0 && index < this.challengeDataList.length) {
                                const newId = this.challengeDataList[index].challengeId;
                                solved[newId] = true;
                                delete solved[key];
                                needsSave = true;
                            }
                        }
                    });
                    if (needsSave) {
                        localStorage.setItem('rapfi_solved_challenges', JSON.stringify(solved));
                    }
                }
            } catch(e) {}

            this.loadChallengeFilter();
            this.renderChallengeList();
            
        } catch (e) {
            console.error(e);
            listEl.innerHTML = `<li style="padding:15px; color:#FF5C7A;">${this.translateUiText('読み込みに失敗しました')}</li>`;
        }
    };

    proto.renderChallengeList = function() {
        const listEl = document.getElementById('challengeListDisplay');
        const filterColor = document.getElementById('challengeFilterColor')?.value || 'all';
        const minVal = document.getElementById('challengeFilterMMin')?.value;
        const maxVal = document.getElementById('challengeFilterMMax')?.value;
        const filterMMin = minVal ? parseInt(minVal) : NaN;
        const filterMMax = maxVal ? parseInt(maxVal) : NaN;
        
        if (!listEl) return;
        
        listEl.innerHTML = '';
        if (!this.challengeDataList) return;
        
        let filteredData = this.challengeDataList.filter(item => {
            if (filterColor !== 'all' && item._startColor.toString() !== filterColor) return false;
            
            const m = parseInt(item.m_value) || 0;
            if (!isNaN(filterMMin) && m < filterMMin) return false;
            if (!isNaN(filterMMax) && m > filterMMax) return false;
            
            return true;
        });
        
        if (filteredData.length === 0) {
            listEl.innerHTML = `<li style="padding:15px; color:var(--text-muted);">${this.translateUiText('条件に一致する局面がありません')}</li>`;
            return;
        }
        
        filteredData.forEach(item => {
            const challengeId = item.challengeId;
            const li = document.createElement('li');
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            li.style.padding = "10px 15px";
            li.dataset.challengeId = challengeId;
            
            const textContainer = document.createElement('div');
            textContainer.className = 'list-text';
            textContainer.style.flex = "1";
            
            const startColorStr = item._startColor === 1 ? this.translateUiText('黒') : this.translateUiText('白');
            const indexStr = `<span style="font-size:18px; font-weight:bold; color:var(--text-main); margin-right:12px; min-width: 30px;">#${item.originalIndex}</span>`;
            const isSolved = this.isChallengeSolved(challengeId);
            const badgeStr = isSolved ? `<span style="background:#28a745; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px; margin-left:8px; vertical-align:middle;">Clear!</span>` : '';
            const titleStr = `${item.tournament_name || 'Unknown'} - <span style="color:#FF5C7A; font-weight:bold;">M${item.m_value}</span> (${this.translateUiText('手番')}: ${startColorStr})${badgeStr}`;
            const playerStr = `${item.black_name || '?'} vs ${item.white_name || '?'}`;
            
            textContainer.innerHTML = `
                <div style="display:flex; align-items:center; margin-bottom:8px;">
                    ${indexStr}
                    <div style="color:var(--text-main); font-weight:normal;">${titleStr}</div>
                </div>
                <div style="font-size:13px; color:var(--text-muted);">${playerStr}</div>
            `;
            
            const canvas = document.createElement('canvas');
            canvas.className = 'list-thumb';
            canvas.width = 100;
            canvas.height = 100;
            canvas.style.backgroundColor = '#F2E2BF';
            canvas.dataset.challengeId = challengeId;
            
            li.appendChild(textContainer);
            li.appendChild(canvas);
            
            if (item._hasError) {
                li.style.opacity = "0.5";
                textContainer.innerHTML += `<div style="color:#FF5C7A; font-size:12px; margin-top:4px;">${this.translateUiText('読み込み失敗 (不正な棋譜)')}</div>`;
            } else {
                li.style.cursor = "pointer";
                li.onclick = () => this.startChallenge(challengeId);
            }
            
            listEl.appendChild(li);
        });
        
        if (this._challengeObserver) {
            this._challengeObserver.disconnect();
        }
        const modal = document.getElementById('challengeModal');
        this._challengeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const canvas = entry.target;
                    const cId = canvas.dataset.challengeId;
                    const cItem = this.challengeMap.get(cId);
                    if (cItem && !cItem._hasError && cItem._parsedMoves) {
                        this.drawThumbnail(canvas, cItem._parsedMoves, cItem._parsedMoves.length);
                    }
                    this._challengeObserver.unobserve(canvas);
                }
            });
        }, { root: modal, rootMargin: '100px' });
        
        const canvases = listEl.querySelectorAll('canvas.list-thumb');
        canvases.forEach(c => this._challengeObserver.observe(c));
    };

    proto.closeChallengeModal = function() {
        const modal = document.getElementById('challengeModal');
        if (modal) modal.style.display = 'none';
        if (this._challengeObserver) {
            this._challengeObserver.disconnect();
            this._challengeObserver = null;
        }
    };

    proto.saveChallengeFilter = function() {
        const filters = {
            color: document.getElementById('challengeFilterColor')?.value || 'all',
            mMin: document.getElementById('challengeFilterMMin')?.value || '',
            mMax: document.getElementById('challengeFilterMMax')?.value || ''
        };
        localStorage.setItem('rapfi_challenge_filters', JSON.stringify(filters));
    };

    proto.loadChallengeFilter = function() {
        try {
            const saved = localStorage.getItem('rapfi_challenge_filters');
            if (saved) {
                const filters = JSON.parse(saved);
                if (filters.color) {
                    const el = document.getElementById('challengeFilterColor');
                    if (el) el.value = filters.color;
                }
                if (filters.mMin) {
                    const el = document.getElementById('challengeFilterMMin');
                    if (el) el.value = filters.mMin;
                }
                if (filters.mMax) {
                    const el = document.getElementById('challengeFilterMMax');
                    if (el) el.value = filters.mMax;
                }
            }
        } catch(e) {
            console.error(e);
        }
    };

    proto.markChallengeSolved = function(challengeId) {
        try {
            const saved = localStorage.getItem('rapfi_solved_challenges');
            const solved = saved ? JSON.parse(saved) : {};
            solved[challengeId] = true;
            localStorage.setItem('rapfi_solved_challenges', JSON.stringify(solved));
        } catch(e) {}
    };

    proto.isChallengeSolved = function(challengeId) {
        try {
            const saved = localStorage.getItem('rapfi_solved_challenges');
            if (saved) {
                const solved = JSON.parse(saved);
                return !!solved[challengeId];
            }
        } catch(e) {}
        return false;
    };

    proto.startChallenge = async function(challengeId) {
        if (!this.challengeMap) return;
        const item = this.challengeMap.get(challengeId);
        if (!item || item._hasError || !item._parsedMoves) return;

        this.closeChallengeModal();
        this.inputLocked = true;

        try {
            // 1. 安全に停止・非同期破棄
            await backendCommands.stopAllActiveModesForChallenge();

            // 2. 配列のディープコピーと専用状態のセット
            const moves = item._parsedMoves;
            this.moveHistory = moves.map(m => ({ ...m }));
            this.fullGameHistory = moves.map(m => ({ ...m }));
            this.challengeMode = true;
            this.currentChallenge = item;
            this.challengeStartPly = moves.length;

            // 3. UI盤面の再現と同期
            this.resetBoardTo(this.moveHistory);
            this.updateNotationText();

            // 4. 手番とユーザー色の厳密な確定
            const nextTurn = (this.moveHistory.length % 2 === 0) ? 1 : 2;
            this.currentTurn = nextTurn;
            this.playerColor = nextTurn;
            this.isPlayerTurn = (this.currentTurn === this.playerColor);

            // 5. UI設定（DOM）の同期
            const playerColorSelect = document.getElementById('playerColor');
            if (playerColorSelect) {
                playerColorSelect.value = this.playerColor;
            }

            // 6. バックエンドへの専用開始コマンド発行
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

            const timeRule = document.getElementById('timeRuleMode')?.value || 'normal';
            
            const pMin = parseInt(document.getElementById('playerTimeMin').value) || 0;
            const pSec = parseInt(document.getElementById('playerTimeSec').value) || 0;
            const pTime = (pMin * 60) + pSec; 
            
            const aMin = parseInt(document.getElementById('aiTimeMin').value) || 0;
            const aSec = parseInt(document.getElementById('aiTimeSec').value) || 0;
            const aTime = (aMin * 60) + aSec; 

            const pInc = parseInt(document.getElementById('playerIncConfig').value) || 0;
            const aInc = parseInt(document.getElementById('aiIncConfig').value) || 0;
            const playerPerMoveSec = parseInt(document.getElementById('playerPerMoveSec').value) || 10;
            const aiPerMoveSec = parseInt(document.getElementById('aiPerMoveSec').value) || 10;
            
            const turnTimePercentInput = parseFloat(document.getElementById('engTurnTimePercent').value);
            const turnTimeMarginInput = parseInt(document.getElementById('engTurnTimeMarginMs').value);
            const turnTimePercent = Number.isFinite(turnTimePercentInput) ? turnTimePercentInput : 20;
            const turnTimeMarginMs = Number.isFinite(turnTimeMarginInput) ? turnTimeMarginInput : 500;

            const effectivePlayerTime = timeRule === 'perMove' ? playerPerMoveSec : pTime;
            const effectiveAiTime = timeRule === 'perMove' ? aiPerMoveSec : aTime;
            const effectivePlayerInc = timeRule === 'perMove' ? 0 : pInc;
            const effectiveAiInc = timeRule === 'perMove' ? 0 : aInc;

            this.timeIncrements = { player: effectivePlayerInc * 1000, rapfi: effectiveAiInc * 1000 };
            this.currentMaxMoves = parseInt(engineSettings.maxMoves);
            this.timers.player = effectivePlayerTime * 1000;
            this.timers.rapfi = effectiveAiTime * 1000;
            
            await backendCommands.startChallengeGame({
                initialStones: this.moveHistory,
                engineSettings,
                playerTime: effectivePlayerTime, playerIncrement: effectivePlayerInc,
                aiTime: effectiveAiTime, aiIncrement: effectiveAiInc,
                timeRule, playerPerMove: playerPerMoveSec, aiPerMove: aiPerMoveSec,
                turnTimePercent, turnTimeMarginMs,
                playerColor: this.playerColor
            });

            // 7. 入力ロック解除
            this.inputLocked = false;

            const challengeLabel = document.getElementById('challengeLabel');
            if (challengeLabel) {
                challengeLabel.textContent = `Problem #${item.originalIndex}`;
                challengeLabel.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            this.challengeMode = false;
            this.currentChallenge = null;
            this.isPlayerTurn = false;
            this.inputLocked = true;
            const challengeLabel = document.getElementById('challengeLabel');
            if (challengeLabel) challengeLabel.style.display = 'none';
            alert('挑戦対局の開始に失敗しました。盤面をリセットするか、別の問題を選んでください。');
        }
    };

    proto.retryChallenge = function() {
        if (!this.challengeMode || !this.currentChallenge) return;
        this.startChallenge(this.currentChallenge.challengeId);
    };

    proto.nextChallenge = function() {
        if (!this.challengeMode || !this.currentChallenge || !this.challengeDataList) return;
        const list = this.challengeDataList;
        const currentIndex = list.findIndex(c => c.challengeId === this.currentChallenge.challengeId);
        
        if (currentIndex !== -1 && currentIndex < list.length - 1) {
            let nextIndex = currentIndex + 1;
            while(nextIndex < list.length && list[nextIndex]._hasError) {
                nextIndex++;
            }
            if (nextIndex < list.length) {
                this.startChallenge(list[nextIndex].challengeId);
            } else {
                alert(this.translateUiText('最後の問題です。'));
            }
        } else {
            alert(this.translateUiText('最後の問題です。'));
        }
    };
}
