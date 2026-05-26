/**
 * カスタムイベントバスのディスパッチ・購読管理モジュール。
 * 
 * コンポーネント間の疎結合を保つため、Pub/Subパターンの仕組みを提供する。
 * 
 * 主な役割:
 * - 非同期メッセージングパイプライン
 * - イベントハンドラーの管理
 */

const REGEX_ANSI = /\x1b\[[0-9;]*m/g;

let logBuffer = [];
let logFlushTimer = null;

export function sendToRenderer(channel, data) {
    const cbs = window.electronAPI_callbacks && window.electronAPI_callbacks[channel];
    if (cbs) cbs.forEach(cb => { try { cb(data); } catch(e) { console.error('[sendToRenderer]', e); } });
}

export function broadcastLog(msg) {
    const cleanMsg = msg.replace(REGEX_ANSI, '');
    logBuffer.push(cleanMsg);

    if (!logFlushTimer) {
        logFlushTimer = setTimeout(() => {
            let dataToSend = logBuffer;
            if (logBuffer.length > 30) {
                dataToSend = logBuffer.slice(-30);
            }
            sendToRenderer('ai_log', dataToSend);
            logBuffer = [];
            logFlushTimer = null;
        }, 100);
    }
}
