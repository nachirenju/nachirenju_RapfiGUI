/**
 * 設定パネル全体のデータバインディングおよび設定値の保存処理を担うモジュール。
 * 
 * 現在の設定を読み込んでフォームに反映し、変更された内容をまとめて保存するフローを制御する。
 * 
 * 主な役割:
 * - UI設定フォームと内部設定データの同期
 * - 設定永続化のトリガーおよび適用結果の通知
 */

import { setDebugMode } from '../../config/constants.js';

export function installSettingsMethods(proto) {
    proto.openEngineSettings = function() {
        this.engineModalEl.style.display = 'block';
        this.switchTab('engine');
    };

    proto.closeEngineSettings = function() {
        this.engineModalEl.style.display = 'none';
    };

    proto.setBoardColor = function(hexColor) {
        this.boardColor = hexColor;
        document.getElementById('renjuBoard').style.backgroundColor = hexColor;
        this.initBackground();
        this.drawBoard();
    };

    proto.setBoardColorPreset = function(hexColor) {
        document.getElementById('uiBoardColor').value = hexColor;
        this.setBoardColor(hexColor);
    };

    proto.applyUiSettings = function() {
        const moveSound = document.getElementById('uiMoveSound');
        const timeSound = document.getElementById('uiTimeSound');
        const boardCoords = document.getElementById('uiBoardCoords');
        const stoneShading = document.getElementById('uiStoneShading');
        const timerOnSide = document.getElementById('uiTimerOnSide');

        if (moveSound) this.enableMoveSound = moveSound.checked;
        if (timeSound) this.enableTimeSound = timeSound.checked;

        const nextBoardCoords = boardCoords ? boardCoords.checked : true;
        const nextStoneShading = stoneShading ? stoneShading.checked : true;
        const shouldRedrawBoard = this.showBoardCoordinates !== nextBoardCoords || this.useStoneShading !== nextStoneShading;

        this.showBoardCoordinates = nextBoardCoords;
        this.useStoneShading = nextStoneShading;
        this.updateTimerDisplayPosition(timerOnSide?.checked ?? false);

        if (shouldRedrawBoard) {
            this.initBackground();
            this.drawBoard();
        }
    };

    proto.updateTimerDisplayPosition = function(moveToSide) {
        const sideInfoGroup = document.getElementById('gameSideInfoGroup');
        const boardHome = document.getElementById('boardInfoHome');
        const sideHost = document.getElementById('sideBoardInfoHost');
        if (!sideInfoGroup || !boardHome || !sideHost) return;

        const useSide = moveToSide && window.matchMedia('(min-width: 920px)').matches;
        const destination = useSide ? sideHost : boardHome;
        if (sideInfoGroup.parentElement !== destination) {
            destination.appendChild(sideInfoGroup);
        }
    };

    proto.updateTimeRuleUi = function() {
        const mode = document.getElementById('timeRuleMode')?.value || 'normal';
        document.querySelectorAll('.time-normal-setting').forEach(el => {
            el.style.display = mode === 'perMove' ? 'none' : '';
        });
        document.querySelectorAll('.time-per-move-setting').forEach(el => {
            el.style.display = mode === 'perMove' ? '' : 'none';
        });
    };

    proto.saveEngineSettings = function() {
        this.saveConfig();
        this.closeEngineSettings();
    };

    proto.saveConfig = function() {
        if (!document.getElementById('saveSettings').checked) return;
        const config = {
            confReset: document.getElementById('confResetBoard').checked,
            pTimeMin: document.getElementById('playerTimeMin').value,
            pTimeSec: document.getElementById('playerTimeSec').value,
            pInc: document.getElementById('playerIncConfig').value,
            aTimeMin: document.getElementById('aiTimeMin').value,
            aTimeSec: document.getElementById('aiTimeSec').value,
            aInc: document.getElementById('aiIncConfig').value,
            timeRuleMode: document.getElementById('timeRuleMode').value,
            playerPerMoveSec: document.getElementById('playerPerMoveSec').value,
            aiPerMoveSec: document.getElementById('aiPerMoveSec').value,
            pColor: document.getElementById('playerColor').value,
            engMaxMoves: document.getElementById('engMaxMoves').value,
            engThreads: document.getElementById('engThreads').value,
            engMaxNodes: document.getElementById('engMaxNodes').value,
            engMaxDepth: document.getElementById('engMaxDepth').value,
            engHashSize: document.getElementById('engHashSize').value,
            engMultiPV: document.getElementById('engMultiPV').value,
            engTurnTimePercent: document.getElementById('engTurnTimePercent').value,
            engTurnTimeMarginMs: document.getElementById('engTurnTimeMarginMs').value,
            engBlunderThreshold: document.getElementById('engBlunderThreshold').value,
            engHumanStyle: document.getElementById('engHumanStyle').checked,
            engBlunderRate: document.getElementById('engBlunderRate').value,
            engMissMateRate: document.getElementById('engMissMateRate').value,
            anaStartMove: document.getElementById('analyzeStartMove').value,
            anaTime: document.getElementById('analyzeTime').value,
            anaNBest: document.getElementById('analyzeNBest').value,
            anaThreads: document.getElementById('analyzeThreads').value,
            anaHashSize: document.getElementById('analyzeHashSize').value,
            challengeSkipSolved: document.getElementById('challengeSkipSolved')?.checked ?? true,
            uiBoardColor: document.getElementById('uiBoardColor').value,
            uiMoveSound: document.getElementById('uiMoveSound').checked,
            uiTimeSound: document.getElementById('uiTimeSound').checked,
            uiBoardCoords: document.getElementById('uiBoardCoords').checked,
            uiStoneShading: document.getElementById('uiStoneShading').checked,
            uiTimerOnSide: document.getElementById('uiTimerOnSide')?.checked ?? false,
            debugMode: document.getElementById('debugModeToggle') ? document.getElementById('debugModeToggle').checked : false
        };
        localStorage.setItem('rapfi_web_config', JSON.stringify(config));
    };

    proto.loadConfig = function() {
        const saved = localStorage.getItem('rapfi_web_config');
        if (saved) {
            try {
                const c = JSON.parse(saved);
                if (c.confReset !== undefined) document.getElementById('confResetBoard').checked = c.confReset;
                if (c.pTimeMin !== undefined) document.getElementById('playerTimeMin').value = c.pTimeMin;
                if (c.pTimeSec !== undefined) document.getElementById('playerTimeSec').value = c.pTimeSec;
                if (c.pInc !== undefined) document.getElementById('playerIncConfig').value = c.pInc;
                if (c.aTimeMin !== undefined) document.getElementById('aiTimeMin').value = c.aTimeMin;
                if (c.aTimeSec !== undefined) document.getElementById('aiTimeSec').value = c.aTimeSec;
                if (c.aInc !== undefined) document.getElementById('aiIncConfig').value = c.aInc;
                if (c.timeRuleMode !== undefined) document.getElementById('timeRuleMode').value = c.timeRuleMode;
                if (c.playerPerMoveSec !== undefined) document.getElementById('playerPerMoveSec').value = c.playerPerMoveSec;
                if (c.aiPerMoveSec !== undefined) document.getElementById('aiPerMoveSec').value = c.aiPerMoveSec;
                if (c.pColor !== undefined) document.getElementById('playerColor').value = c.pColor;
                if (c.engMaxMoves !== undefined) document.getElementById('engMaxMoves').value = c.engMaxMoves;
                if (c.engThreads !== undefined) document.getElementById('engThreads').value = c.engThreads;
                if (c.engMaxNodes !== undefined) document.getElementById('engMaxNodes').value = c.engMaxNodes;
                if (c.engMaxDepth !== undefined) document.getElementById('engMaxDepth').value = c.engMaxDepth;
                if (c.engHashSize !== undefined) document.getElementById('engHashSize').value = c.engHashSize;
                if (c.engMultiPV !== undefined) document.getElementById('engMultiPV').value = c.engMultiPV;
                if (c.engTurnTimePercent !== undefined) document.getElementById('engTurnTimePercent').value = c.engTurnTimePercent;
                if (c.engTurnTimeMarginMs !== undefined) document.getElementById('engTurnTimeMarginMs').value = c.engTurnTimeMarginMs;
                if (c.engHumanStyle !== undefined) document.getElementById('engHumanStyle').checked = c.engHumanStyle;
                if (c.engBlunderThreshold !== undefined) document.getElementById('engBlunderThreshold').value = c.engBlunderThreshold;
                if (c.engBlunderRate !== undefined) document.getElementById('engBlunderRate').value = c.engBlunderRate;
                if (c.engMissMateRate !== undefined) document.getElementById('engMissMateRate').value = c.engMissMateRate;
                if (c.anaStartMove !== undefined) document.getElementById('analyzeStartMove').value = c.anaStartMove;
                if (c.anaTime !== undefined) document.getElementById('analyzeTime').value = c.anaTime;
                if (c.anaNBest !== undefined) document.getElementById('analyzeNBest').value = c.anaNBest;
                if (c.anaThreads !== undefined) document.getElementById('analyzeThreads').value = c.anaThreads;
                if (c.anaHashSize !== undefined) document.getElementById('analyzeHashSize').value = c.anaHashSize;
                if (c.challengeSkipSolved !== undefined) {
                    this.setChallengeHideSolved(c.challengeSkipSolved);
                }
                if (c.uiBoardColor !== undefined) {
                    let boardColor = c.uiBoardColor;
                    if (boardColor === "#F9EBCF") boardColor = "#F2E2BF";
                    document.getElementById('uiBoardColor').value = boardColor;
                    this.setBoardColor(boardColor);
                }
                if (c.uiMoveSound !== undefined) document.getElementById('uiMoveSound').checked = c.uiMoveSound;
                if (c.uiTimeSound !== undefined) document.getElementById('uiTimeSound').checked = c.uiTimeSound;
                if (c.uiBoardCoords !== undefined) document.getElementById('uiBoardCoords').checked = c.uiBoardCoords;
                if (c.uiStoneShading !== undefined) document.getElementById('uiStoneShading').checked = c.uiStoneShading;
                if (c.uiTimerOnSide !== undefined) document.getElementById('uiTimerOnSide').checked = c.uiTimerOnSide;
                if (c.debugMode !== undefined) {
                    const toggle = document.getElementById('debugModeToggle');
                    if (toggle) {
                        toggle.checked = c.debugMode;
                        setDebugMode(c.debugMode);
                    }
                }
                this.applyUiSettings();
                this.updateTimeRuleUi();
                this.applyIOSThreadLimit();
            } catch (e) {}
        }
    };
}
