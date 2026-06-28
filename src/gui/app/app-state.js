/**
 * フロントエンドにおける全体のUIステートを一元管理するモジュール。
 * 
 * 現在が「対局中」「検討中」「研究モード」などのどの状態にあるかを保持し、状態変更時にUIをリアクティブに更新するための管理を担う。
 * 
 * 主な役割:
 * - アプリケーションモード（状態）の保持と遷移管理
 * - 状態変更に対するUIコンポーネントへのブロードキャスト通知
 */

export function initializeAppState(app) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    app.audioCtx = new AudioContext();

    app.timerEl = { player: document.getElementById('playerTime'), rapfi: document.getElementById('rapfiTime') };
    app.statusEl = document.getElementById('status');
    app.gameControlBtn = document.getElementById('btnStart');
    app.takebackBtn = document.getElementById('btnTakeback');
    app.graphContainer = document.getElementById('graph-container');
    app.statsContainer = document.getElementById('stats-container');
    app.evalChart = null;
    app.lastAnalysisResults = null;
    app.engineReady = false;
    app.isIOSDevice = app.detectIOSDevice();
    app.hasPlayedOnce = false;
    app.isResearchMode = false;
    app.analysisModeActive = false;
    app.researchCandidates = {};
    app.currentResearchDepth = 0;
    app.researchSyncSeq = 0;
    app.researchSyncTimer = null;
    app.researchBoardKey = "";

    app.thumbCanvas = document.createElement('canvas');
    app.thumbCanvas.width = 100;
    app.thumbCanvas.height = 100;

    app.gameActive = false;
    app.reviewMode = true;
    app.isPlayerTurn = false;
    app.takebackPending = false;
    app.takebackPendingTimer = null;
    app.activeSide = null;
    app.timers = { player: 0, rapfi: 0 };

    app.fullGameHistory = [];
    app.lastTick = performance.now();
    app.lastCountdownSec = -1;

    app.researchEvals = [];
    app.graphUpdatePending = false;

    app.modalEl = document.getElementById('loadModal');
    app.modalListEl = document.getElementById('modalList');
    app.selectedRecordId = null;
    app.recordList = [];
    app.currentRecordId = null;
    app.engineModalEl = document.getElementById('engineModal');

    app.quizList = [];
    app.quizMode = false;
    app.currentQuiz = null;
    app.quizOverlay = document.getElementById('quiz-overlay');
    app.quizModal = document.getElementById('quizModal');
}
