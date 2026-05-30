/**
 * フロントエンド側の主要な状態と処理を束ねるメインアプリケーションクラスの定義モジュール。
 * 
 * 各機能モジュールのインスタンスを保持し、機能間の連携を提供する。
 * グローバル変数 window.app として公開され、他のスクリプトからAPI的に利用される基盤となる。
 * 
 * 主な役割:
 * - システム全体の主要オブジェクトの保持
 * - フロントエンドAPIのエントリーポイント提供
 */

import { RenjuEngine } from '../board/renju-engine.js';
import { installBoardRendererMethods } from '../board/board-renderer.js';
import { installNotationMethods } from '../board/notation.js';
import { installAnalysisRunnerMethods } from '../analysis/analysis-runner.js';
import { installGraphMethods } from '../analysis/graph.js';
import { installReviewMethods } from '../analysis/review.js';
import { installDeviceMethods } from '../platform/device.js';
import { installResearchMethods } from '../research/research-ui.js';
import { installAudioMethods } from '../ui/audio.js';
import { installClipboardMethods } from '../ui/clipboard.js';
import { installLanguageMethods } from '../ui/language.js';
import { installModalMethods } from '../ui/modals.js';
import { installSettingsExtraMethods } from '../ui/settings-extra.js';
import { installSettingsMethods } from '../ui/settings-panel.js';
import { installTimerMethods } from '../ui/timers.js';
import { installQuizListMethods } from '../quiz/quiz-list.js';
import { installQuizPdfMethods } from '../quiz/quiz-pdf.js';
import { initializeAppBootstrap } from './app-bootstrap.js';
import { initializeAppState } from './app-state.js';
import { installGameControlMethods } from './game-controls.js';
import { installReviewNavigationMethods } from './review-navigation.js';

export class RapfiApp extends RenjuEngine {
    constructor() {
        super('renjuBoard');
        initializeAppState(this);
        initializeAppBootstrap(this);
    }
}

installNotationMethods(RapfiApp.prototype);
installBoardRendererMethods(RapfiApp.prototype);
installGameControlMethods(RapfiApp.prototype);
installReviewNavigationMethods(RapfiApp.prototype);
installAudioMethods(RapfiApp.prototype);
installClipboardMethods(RapfiApp.prototype);
installLanguageMethods(RapfiApp.prototype);
installDeviceMethods(RapfiApp.prototype);
installTimerMethods(RapfiApp.prototype);
installSettingsMethods(RapfiApp.prototype);
installSettingsExtraMethods(RapfiApp.prototype);
installModalMethods(RapfiApp.prototype);
installAnalysisRunnerMethods(RapfiApp.prototype);
installGraphMethods(RapfiApp.prototype);
installReviewMethods(RapfiApp.prototype);
installResearchMethods(RapfiApp.prototype);
installQuizListMethods(RapfiApp.prototype);
installQuizPdfMethods(RapfiApp.prototype);
