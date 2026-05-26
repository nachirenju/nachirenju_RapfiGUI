/**
 * レンダラー（UI）プロセスにおける高度なデバッグログ機能を提供するユーティリティモジュール。
 * 
 * タイムスタンプ付与、ログレベル分類、カラー出力機能を実装する。
 * 
 * 主な役割:
 * - フォーマットされた開発用デバッグログの出力
 * - ログレベルに応じたフィルタリング
 */

export function createTrace(debugMode, startTimeProvider = () => performance.now()) {
    const startTime = startTimeProvider();

    return function trace(cat, pid, msg) {
        if (!debugMode) return;
        const time = (performance.now() - startTime).toFixed(0).padStart(6, ' ');
        const pidStr = pid ? `[PID:${pid}]` : '[System]   ';
        let color = '\x1b[0m';
        if (cat === 'SPAWN') color = '\x1b[32m';
        if (cat === 'KILL' || cat === 'EXIT') color = '\x1b[31m';
        if (cat === 'OUT') color = '\x1b[36m';
        if (cat === 'CMD') color = '\x1b[35m';
        console.log(`${color}${time}ms ${pidStr} ${cat.padEnd(6)} : ${msg}\x1b[0m`);
    };
}
