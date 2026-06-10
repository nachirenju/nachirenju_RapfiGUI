// preload_shim.js
// Electronの contextBridge / ipcRenderer を模倣するシム
// window.electronAPI_callbacks にコールバックを登録し、
// バックエンドから sendToRenderer() が呼ばれるとそのコールバックを呼び出す

window.electronAPI_callbacks = {};

function _on(channel, callback) {
    if (!window.electronAPI_callbacks[channel]) {
        window.electronAPI_callbacks[channel] = [];
    }
    window.electronAPI_callbacks[channel].push(callback);
}

function _send(name, ...args) {
    const fn = window['backendAPI_' + name];
    if (typeof fn === 'function') {
        fn(...args);
    } else {
        console.warn('[preload_shim] Missing handler: backendAPI_' + name, args);
    }
}

window.electronAPI = {
    // --- 受信 (Backend -> Renderer) ---
    onEngineReady:      (cb) => _on('engine_ready', cb),
    onGameStarted:      (cb) => _on('game_started', cb),
    onMove:             (cb) => _on('move', cb),
    onUndoResult:       (cb) => _on('undo_result', cb),
    onAiLog:            (cb) => _on('ai_log', cb),
    onGameOver:         (cb) => _on('game_over', cb),
    onShowGraph:        (cb) => _on('show_graph', cb),
    onHistoryList:      (cb) => _on('history_list', cb),
    onLoadRecordData:   (cb) => _on('load_record_data', cb),
    onAnalysisProgress: (cb) => _on('analysis_progress', cb),
    onQuizListData:     (cb) => _on('quiz_list_data', cb),
    onAnalysisComplete: (cb) => _on('analysis_complete', cb),
    onResearchUpdate:   (cb) => _on('research_update', cb),

    // --- 送信 (Renderer -> Backend) ---
    requestHistory:          ()       => _send('request_history'),
    requestQuizList:         ()       => _send('request_quiz_list'),
    startGame:               (data)   => _send('start_game', data),
    startChallengeGame:      (data)   => _send('start_challenge_game', data),
    stopAllActiveModesForChallenge: () => _send('stop_all_active_modes_for_challenge'),
    playerMove:              (data)   => _send('player_move', data),
    undoMove:                ()       => _send('undo_move'),
    takebackMove:            ()       => _send('takeback_move'),
    finishGame:              ()       => _send('finish_game'),
    loadGameRecord:          (id)     => _send('load_game_record', id),
    deleteGameRecord:        (id)     => _send('delete_game_record', id),
    analyzeGame:             (data)   => _send('analyze_game', data),
    saveAnalysisResult:      (data)   => _send('save_analysis_result', data),
    saveQuizList:            (list)   => _send('save_quiz_list', list),
    toggleResearch:          (en, nb, th, hs) => _send('toggle_research', en, nb, th, hs),
    researchSync:            (hist, nb, th, hs) => _send('research_sync', hist, nb, th, hs),
    researchClick:           (move)   => _send('research_click', move),
    sendUpdateEngineSetting: (data)   => _send('update_engine_setting', data),
};
