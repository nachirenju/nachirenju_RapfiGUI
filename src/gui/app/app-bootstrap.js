/**
 * フロントエンドアプリケーションの初期化シーケンスを管理するモジュール。
 * 
 * DOMツリーの構築完了を待ち、設定の読み込み、多言語対応の適用、キャンバスの初期化、各種マネージャーのインスタンス化を実行する。
 * 
 * 主な役割:
 * - アプリ起動時の安全かつ確実な初期化フローの保証
 * - モジュール間の依存関係に応じたロード順序の制御
 */

import * as backendCommands from '../ipc/backend-commands.js';
import { registerIpcEvents } from '../ipc/renderer-events.js';
import { setDebugMode } from '../../config/constants.js';

export function initializeAppBootstrap(app) {
    const portalUrlInput = document.getElementById('portalUrlInput');
    portalUrlInput.addEventListener('input', (e) => {
        if (app.gameActive) return;
        app.parseRenjuPortalUrl(e.target.value);
    });

    const notationArea = document.getElementById('notationDisplay');
    notationArea.addEventListener('input', (e) => {
        if (app.gameActive) return;
        app.parseAndSyncBoard(e.target.value);
    });

    const sgfInput = document.getElementById('sgfText');
    sgfInput.addEventListener('input', (e) => {
        if (app.gameActive) return;
        app.parseAndSyncBoard(e.target.value);
    });

    app.loadConfig();
    app.applyIOSThreadLimit();
    window.addEventListener('resize', () => {
        app.updateTimerDisplayPosition(document.getElementById('uiTimerOnSide')?.checked ?? false);
    });

    registerIpcEvents(app);

    if (backendCommands.hasBackendApi()) {
        backendCommands.requestInitialData();
    } else {
        console.warn("Electron API is not available.");
    }

    requestAnimationFrame(() => app.tick());

    const multiPvInput = document.getElementById('engMultiPV');
    multiPvInput.addEventListener('input', (e) => {
        const newVal = parseInt(e.target.value, 10);

        if (backendCommands.hasBackendApi()) {
            backendCommands.sendUpdateEngineSetting({
                name: 'MultiPV',
                value: newVal
            });
        }

        if (app.isResearchMode) {
            app.researchCandidates = {};
            app.currentResearchDepth = 0;
            app.drawBoard();
        }
    });

    const debugModeToggle = document.getElementById('debugModeToggle');
    if (debugModeToggle) {
        setDebugMode(debugModeToggle.checked);
        debugModeToggle.addEventListener('change', (e) => {
            setDebugMode(e.target.checked);
            app.saveConfig();
        });
    }
}
