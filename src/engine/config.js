/**
 * WASMエンジンの基本設定や初期化オプションを管理するモジュール。
 * 
 * エンジン起動時に渡すコマンドライン引数や、メモリ割り当てサイズ、利用するプロトコルの種類（Yixin-Boardプロトコル等）などを定義する。
 * ユーザーからの設定変更を受け付ける際のバリデーション基準としても利用される。
 * 
 * 主な役割:
 * - エンジン初期化時の環境・オプション設定
 * - エンジン互換性に関する設定の切り替え
 */

export function createGameConfigCommands(settings, threadCount) {
    const es = settings || {};
    const commands = [
        `INFO STRENGTH ${es.strength || 100}`,
        `INFO THREAD_NUM ${threadCount}`,
        `INFO MAX_NODE ${es.maxNodes ? es.maxNodes * 1000 : 0}`,
        `INFO MAX_DEPTH ${es.maxDepth !== undefined ? es.maxDepth : 50}`,
        `INFO HASH_SIZE ${es.hashSize || 1024}`
    ];

    if (es.maxMoves) commands.push(`INFO MAX_MOVES ${es.maxMoves}`);
    commands.push('INFO RULE 2');
    return commands;
}

export function createResearchConfigCommands(settings, { threadCount, hashSize }) {
    const es = settings || {};
    const commands = [
        `INFO THREAD_NUM ${threadCount}`,
        'INFO MAX_NODE 0',
        `INFO HASH_SIZE ${hashSize || es.hashSize || 1024}`
    ];

    if (es.maxMoves) commands.push(`INFO MAX_MOVES ${es.maxMoves}`);
    commands.push('INFO RULE 2');
    return commands;
}
