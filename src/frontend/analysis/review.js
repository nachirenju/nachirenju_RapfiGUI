/**
 * 解析結果のレビュー（振り返り）画面および詳細な集計データを表示するUIモジュール。
 * 
 * 悪手・疑問手・最善手の割合や、勝率を落とした「敗着」などの統計情報を集計しレンダリングする。
 * また、特定の手にフォーカスして「読み筋プレビュー」を行うためのUI更新も担う。
 * 
 * 主な役割:
 * - 解析結果データに基づく統計値の計算とHTML生成
 * - 振り返りモード時のUI（モーダルや専用パネル）の制御
 */

import { BLACK } from '../board/renju-engine.js';
import * as backendCommands from '../ipc/backend-commands.js';
import { DEBUG_MODE } from '../../config/constants.js';

export function installReviewMethods(proto) {
    proto.calculateAndShowStats = function(results) {
            if (DEBUG_MODE) console.log("解析結果データ:", results);
            const stats = {
                // badHigh: 悪手(勝率75%以上), badLow: 悪手(勝率75%未満)
                black: { total:0, best:0, nextbest:0, normal:0, questionable:0, bad:0, badHigh:0, badLow:0, lostHigh:0, lostLow:0, missedHigh:0, missedLow:0, lostHighScores:[], lostLowScores:[], missedHighScores:[], missedLowScores:[], badHighScores:[], badLowScores:[] },
                white: { total:0, best:0, nextbest:0, normal:0, questionable:0, bad:0, badHigh:0, badLow:0, lostHigh:0, lostLow:0, missedHigh:0, missedLow:0, lostHighScores:[], lostLowScores:[], missedHighScores:[], missedLowScores:[], badHighScores:[], badLowScores:[] }
            };
            let detailHtml = "";
            const resultMap = {};
            results.forEach(r => resultMap[r.move] = r);
            const MATE_SCORE = 20000;
            this.quizList = [];

            // 勝率計算ヘルパー
            const getWinRate = (score, turnColor) => {
                let s = score;
                if (s >= 20000) s = 30000;
                else if (s <= -20000) s = -30000;
                const viewScore = (turnColor === 1) ? s : -s;
                const K = 200; 
                return 1 / (1 + Math.exp(-viewScore / K));
            };

            this.moveHistory.forEach((move, i) => {
                const moveNum = i + 1;
                const turnColor = move.color;
                const statObj = (turnColor === BLACK) ? stats.black : stats.white;
                const prevResult = resultMap[i];    
                const currentResult = resultMap[i+1]; 

                if (prevResult || currentResult) {
                    statObj.total++;
                    let isExactMatch = false;
                    let recommendation = "";
                    if (prevResult && prevResult.bestMove) {
                        if (prevResult.bestMove.x === move.x && prevResult.bestMove.y === move.y) {
                            isExactMatch = true;
                        } else {
                            recommendation = this.getNotation(prevResult.bestMove.x, prevResult.bestMove.y);
                        }
                    }
                    const currentScore = currentResult ? currentResult.score : null;
                    const prevScore = prevResult ? prevResult.score : null;
                    let judgment = "";
                    let judgeClass = "";
                    let type = null;
                    let missedInfo = ""; 

                    let timeStr = "-";
                    if (prevResult && prevResult.timeMs !== undefined) {
                        timeStr = (prevResult.timeMs / 1000).toFixed(1) + "s";
                    }

                    if (currentScore !== null && prevScore !== null) {
                        let drop = 0;
                        if (turnColor === BLACK) drop = prevScore - currentScore;
                        else drop = currentScore - prevScore;
                        let isLosingMove = false;
                        let isMissedWin = false;
                        if (turnColor === BLACK) {
                            if (prevScore > -MATE_SCORE && currentScore <= -MATE_SCORE) isLosingMove = true;
                            else if (prevScore >= MATE_SCORE && currentScore < MATE_SCORE) isMissedWin = true;
                        } else {
                            if (prevScore < MATE_SCORE && currentScore >= MATE_SCORE) isLosingMove = true;
                            else if (prevScore <= -MATE_SCORE && currentScore > -MATE_SCORE) isMissedWin = true;
                        }
                        
                        if (isLosingMove) { 
                            statObj.lost++; 
                            const absCurrent = Math.abs(currentScore);
                            const mateNum = 30000 - absCurrent;
                            const mateStr = "M" + mateNum;
                            
                            if (mateNum >= 30) {
                                statObj.lostHigh++;
                                statObj.lostHighScores.push(mateStr);
                                judgment = "敗着(M30以上)";
                            } else {
                                statObj.lostLow++;
                                statObj.lostLowScores.push(mateStr);
                                judgment = "敗着(M30未満)";
                            }

                            judgeClass = "mark-lost"; 
                            type = "敗着";
                            
                            const signStr = (currentScore > 0) ? "" : "-";
                            missedInfo = `<br><span style="font-size:9px; color:#999; font-weight:normal;">(負:${signStr}M${mateNum})</span>`;
                        }
                        else if (isMissedWin) { 
                            statObj.missed++;
                            const winRate = getWinRate(currentScore, turnColor);
                            const absPrev = Math.abs(prevScore);
                            const mateNum = 30000 - absPrev;
                            const mateStr = "M" + mateNum;

                            if (winRate >= 0.75) {
                                statObj.missedHigh++;
                                statObj.missedHighScores.push(mateStr);
                                judgment = "勝ち逃し(優勢維持)"; 
                            } else {
                                statObj.missedLow++;
                                statObj.missedLowScores.push(mateStr);
                                judgment = "勝ち逃し(優勢喪失)";
                            }

                            judgeClass = "mark-bad"; 
                            type = "勝ち逃し"; 
                            
                            const signStr = (prevScore > 0) ? "" : "-";
                            missedInfo = `<br><span style="font-size:9px; color:#999; font-weight:normal;">(逃:${signStr}M${mateNum})</span>`;
                        }
                        else if (isExactMatch) { statObj.best++; judgment = "最善手"; judgeClass = "mark-best"; }
                        else if (drop <= 10) { statObj.best++; judgment = "最善手級"; judgeClass = "mark-best"; recommendation = "(ほぼ同等)"; }
                        else if (drop <= 50) { statObj.nextbest++; judgment = "次善手級"; judgeClass = "mark-sec"; }
                        else if (drop <= 100) { statObj.normal++; judgment = "普通手"; judgeClass = ""; }
                        else if (drop <= 300) { statObj.questionable++; judgment = "疑問手"; judgeClass = "mark-que"; type = "疑問手"; }
                        else { 
                            // 悪手
                            statObj.bad++; 
                            const winRate = getWinRate(currentScore, turnColor);
                            
                            if (winRate >= 0.75) {
                                statObj.badHigh++;
                                // 悪手の詳細スコア（評価値差など）が必要ならここにpushする
                                judgment = "悪手(優勢維持)";
                            } else {
                                statObj.badLow++;
                                judgment = "悪手";
                            }

                            judgeClass = "mark-bad"; 
                            type = "悪手"; 
                        }
                    }
                    if (type && !isExactMatch && prevResult && prevResult.bestMove) {
                        let targetLine = [];
                        if (prevResult.candidates && prevResult.candidates.length > 0) {
                            targetLine = prevResult.candidates[0].pv || [];
                        } else if (prevResult.bestLine) {
                            targetLine = prevResult.bestLine;
                        }
                        this.quizList.push({
                            id: this.quizList.length + 1,
                            moveNum: moveNum,
                            type: type,
                            turn: turnColor,
                            historyBefore: this.fullGameHistory.slice(0, i),
                            badMove: move,
                            bestMove: prevResult.bestMove,
                            candidates: prevResult.candidates || [],
                            bestLine: targetLine, 
                            scoreBest: prevScore,
                            scoreBad: currentScore
                        });
                    }
                    
                    detailHtml += `
                        <tr onclick="window.app.jumpToMove(${moveNum})">
                            <td class="move-num">${moveNum}</td>
                            <td class="move-pos">${this.getNotation(move.x, move.y)}</td>
                            <td class="eval-val" style="color:${currentScore>0?'blue':'red'}">
                                ${currentScore !== null ? currentScore : '-'}${missedInfo}
                            </td>
                            <td style="font-size:10px; color:#666; text-align:center;">${timeStr}</td>
                            <td>
                                <span class="${judgeClass}" style="${judgment==='普通手'?'color:#555;':''}">${judgment}</span>
                                ${recommendation && recommendation !=='(ほぼ同等)' ? `<span class="ai-rec">(推奨:${recommendation})</span>` : ''}
                            </td>
                        </tr>
                    `;
                }
            });
            const fmt = (val, total) => total === 0 ? "0" : `${Math.round((val/total)*100)}% (${val})`;
            const fmtDetail = (val, total, scores) => {
                if (total === 0 || val === 0) return "0";
                const base = `${Math.round((val/total)*100)}% (${val})`;
                if (scores && scores.length > 0) {
                    return `${base}<br><span style="font-size:9px; font-weight:normal;">(${scores.join(',')})</span>`;
                }
                return base;
            };

            const html = `
                <tr><td>最善手(級)</td><td class="stat-good">${fmt(stats.black.best, stats.black.total)}</td><td class="stat-good">${fmt(stats.white.best, stats.white.total)}</td></tr>
                <tr><td>次善手級</td><td>${fmt(stats.black.nextbest, stats.black.total)}</td><td>${fmt(stats.white.nextbest, stats.white.total)}</td></tr>
                <tr><td>普通手</td><td style="color:#555;">${fmt(stats.black.normal, stats.black.total)}</td><td style="color:#555;">${fmt(stats.white.normal, stats.white.total)}</td></tr>
                <tr><td>疑問手</td><td class="stat-q">${fmt(stats.black.questionable, stats.black.total)}</td><td class="stat-q">${fmt(stats.white.questionable, stats.white.total)}</td></tr>
                <tr><td style="font-size:11px;">悪手(勝率75%以上を維持)</td>
                    <td class="stat-bad">${fmtDetail(stats.black.badHigh, stats.black.total, stats.black.badHighScores)}</td>
                    <td class="stat-bad">${fmtDetail(stats.white.badHigh, stats.white.total, stats.white.badHighScores)}</td>
                </tr>
                <tr><td style="font-size:11px;">悪手(それ以外)</td>
                    <td class="stat-bad">${fmtDetail(stats.black.badLow, stats.black.total, stats.black.badLowScores)}</td>
                    <td class="stat-bad">${fmtDetail(stats.white.badLow, stats.white.total, stats.white.badLowScores)}</td>
                </tr>
                <tr><td style="font-size:11px;">勝ち逃し(75%以上)</td>
                    <td style="color:#d00; font-weight:bold;">${fmtDetail(stats.black.missedHigh, stats.black.total, stats.black.missedHighScores)}</td>
                    <td style="color:#d00; font-weight:bold;">${fmtDetail(stats.white.missedHigh, stats.white.total, stats.white.missedHighScores)}</td>
                </tr>
                <tr><td style="font-size:11px;">勝ち逃し(75%未満)</td>
                    <td style="color:#d00; font-weight:bold;">${fmtDetail(stats.black.missedLow, stats.black.total, stats.black.missedLowScores)}</td>
                    <td style="color:#d00; font-weight:bold;">${fmtDetail(stats.white.missedLow, stats.white.total, stats.white.missedLowScores)}</td>
                </tr>
                <tr><td style="font-size:11px;">敗着(M30以上)</td>
                    <td style="color:white; background-color:#dc3545; font-weight:bold;">${fmtDetail(stats.black.lostHigh, stats.black.total, stats.black.lostHighScores)}</td>
                    <td style="color:white; background-color:#dc3545; font-weight:bold;">${fmtDetail(stats.white.lostHigh, stats.white.total, stats.white.lostHighScores)}</td>
                </tr>
                <tr><td style="font-size:11px;">敗着(M30未満)</td>
                    <td style="color:white; background-color:#dc3545; font-weight:bold;">${fmtDetail(stats.black.lostLow, stats.black.total, stats.black.lostLowScores)}</td>
                    <td style="color:white; background-color:#dc3545; font-weight:bold;">${fmtDetail(stats.white.lostLow, stats.white.total, stats.white.lostLowScores)}</td>
                </tr>
            `;
            document.getElementById('statsSummaryBody').innerHTML = html;
            document.getElementById('statsDetailBody').innerHTML = detailHtml;
            this.statsContainer.style.display = 'block';
            if (this.quizList.length > 0) { backendCommands.saveQuizList(this.quizList); }
        
    };

    proto.closeStats = function() { document.getElementById('stats-container').style.display = 'none'; 
    };

    proto.toggleStatsMin = function() {
            const win = document.getElementById('stats-container');
            if (win.style.height === '30px') { win.style.height = this._prevHeight || '450px'; win.style.resize = 'both'; } 
            else { this._prevHeight = win.style.height; win.style.height = '30px'; win.style.resize = 'none'; }
        
    };

    proto.toggleStatsMax = function() {
            const win = document.getElementById('stats-container');
            if (win.dataset.maximized === 'true') {
                win.style.top = this._prevPos.top; win.style.left = this._prevPos.left;
                win.style.width = this._prevPos.width; win.style.height = this._prevPos.height;
                win.dataset.maximized = 'false';
            } else {
                this._prevPos = { top: win.style.top, left: win.style.left, width: win.style.width, height: win.style.height };
                win.style.top = '0'; win.style.left = '0'; win.style.width = '100vw'; win.style.height = '100vh'; win.dataset.maximized = 'true';
            }
        
    };
}
