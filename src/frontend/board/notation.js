/**
 * 棋譜データ（SGFフォーマット等）のパース、生成、および入出力処理を担うモジュール。
 * 
 * 現在の盤面状態と履歴から棋譜文字列を組み立てたり、ユーザーがペーストした文字列を盤面履歴に変換する。
 * 
 * 主な役割:
 * - アプリ内部データと外部棋譜フォーマットの相互変換処理
 * - 不正な棋譜データ入力時のエラーハンドリング
 */

import * as backendCommands from '../ipc/backend-commands.js';

function syncResearchIfNeeded(app) {
    if (!app.isResearchMode || !backendCommands.hasBackendApi()) return;
    app.researchCandidates = {};
    app.currentResearchDepth = 0;
    app.requestUpdateGraph();
    backendCommands.researchSync(
        app.moveHistory,
        app.getMultiPVSetting(),
        app.getThreadSetting(),
        app.getHashSetting()
    );
}

export function installNotationMethods(proto) {
    proto.numToSgfChar = function(n) {
        return String.fromCharCode(97 + n);
    };

    proto.posToSgf = function(x, y) {
        return `[${this.numToSgfChar(x)}${this.numToSgfChar(y)}]`;
    };

    proto.sgfCharToNum = function(char) {
        return char.toLowerCase().charCodeAt(0) - 97;
    };

    proto.exportRenjuPortalUrl = function() {
        if (!this.moveHistory || this.moveHistory.length === 0) {
            alert("手数がありません。");
            return;
        }
        try {
            const hexString = this.moveHistory.map(m => {
                const xHex = m.x.toString(16);
                const yHex = m.y.toString(16);
                return xHex + yHex;
            }).join('');
            const v1Base = "https://v1.renjuportal.com/board/?mv=";
            const v2Base = "https://renjuportal.com/board?mvs=";
            document.getElementById('portalUrlV1').value = v1Base + hexString;
            document.getElementById('portalUrlV2').value = v2Base + hexString;
            document.getElementById('portalExportModal').style.display = 'flex';
        } catch (e) {
            console.error("Export Error:", e);
            alert("URLの生成に失敗しました。");
        }
    };

    proto.parseRenjuPortalUrl = function(urlText) {
        try {
            const url = new URL(urlText);
            const mvStr = url.searchParams.get('mvs') || url.searchParams.get('mv');
            if (!mvStr) return;
            const moves = [];
            let color = 1;
            for (let i = 0; i < mvStr.length; i += 2) {
                const x = parseInt(mvStr[i], 16);
                const y = parseInt(mvStr[i + 1], 16);
                if (x >= 0 && x < 15 && y >= 0 && y < 15) {
                    moves.push({ x, y, color });
                    color = (color === 1) ? 2 : 1;
                }
            }
            if (moves.length > 0) {
                this.moveHistory = moves;
                this.fullGameHistory = [...moves];
                this.resetBoardTo(moves);
                this.updateNotationText();
            }
            syncResearchIfNeeded(this);
        } catch (e) {
            console.error("URL Parse Error:", e);
        }
    };

    proto.parseAndSyncBoard = function(text) {
        const newHistory = [];
        if (text.includes(";") && text.includes("[")) {
            const sgfRegex = /([BW])\[([a-o])([a-o])\]/gi;
            let match;
            while ((match = sgfRegex.exec(text)) !== null) {
                const color = (match[1].toUpperCase() === 'B') ? 1 : 2;
                const x = match[2].toLowerCase().charCodeAt(0) - 97;
                const y = match[3].toLowerCase().charCodeAt(0) - 97;
                if (x >= 0 && x < 15 && y >= 0 && y < 15) newHistory.push({ x, y, color });
            }
        } else {
            const matches = text.match(/[a-oA-O]\d{1,2}/g);
            if (matches) {
                const letters = "abcdefghijklmno";
                let color = 1;
                matches.forEach(m => {
                    const x = letters.indexOf(m[0].toLowerCase());
                    const y = 15 - parseInt(m.substring(1));
                    if (x >= 0 && x < 15 && y >= 0 && y < 15) {
                        newHistory.push({ x, y, color });
                        color = (color === 1) ? 2 : 1;
                    }
                });
            }
        }
        if (newHistory.length > 0 || text.trim() === "") {
            this.moveHistory = newHistory;
            this.fullGameHistory = [...newHistory];
            this.resetBoardTo(newHistory);
            this.updateNotationText();
        }
        syncResearchIfNeeded(this);
    };

    proto.getNotation = function(x, y) {
        const letters = "ABCDEFGHIJKLMNO";
        return `${letters[x]}${15 - y}`;
    };
}
