/**
 * WASMエンジンとバックエンド間の通信プロトコル（コマンド送受信）をラップするモジュール。
 * 
 * Yixin-Boardプロトコルなどに基づいてコマンドを組み立て、エンジン標準入力へ送信する。
 * コマンドのキューイングや、エンジンがビジー時の送信待機、デバッグモード時のログ出力機能も備える。
 * 
 * 主な役割:
 * - エンジンへ送る生コマンドの生成と安全な送信処理
 * - コマンド送受信のトレーサビリティの確保
 */

import { DEBUG_MODE } from '../config/constants.js';

export function sendEngineCommand(processLike, cmd, options = {}) {
    if (!processLike || !cmd) return null;

    const trimmedCmd = cmd.trim();
    if (trimmedCmd === "") return null;

    const {
        debugMode = false,
        isAnalyzing = false,
        logCommand = true,
        onCommand = null
    } = options;

    if (logCommand) {
        if (debugMode && !isAnalyzing) {
            console.log(`\x1b[35m[To AI]\x1b[0m ${trimmedCmd}`);
        } else {
            if (DEBUG_MODE) console.log(`[AppCore DEBUG] sendToRapfi: "${trimmedCmd}"`);
        }
    }

    try {
        if (processLike.stdin && processLike.stdin.write) {
            processLike.stdin.write(trimmedCmd + '\n');
        }
        if (onCommand) onCommand(trimmedCmd);
    } catch(e) {
        console.error("AI送信エラー", e);
    }

    return trimmedCmd;
}
