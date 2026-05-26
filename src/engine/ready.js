/**
 * エンジンの準備状態（初期化完了・アイドル状態）を確認・待機するためのユーティリティモジュール。
 * 
 * 新しいコマンドを送る前に、以前の探索が確実に停止しているか、またはエンジンが正常にロードされているかを待機する。
 * 一定時間応答がない場合はエンジンプロセスを再起動するフォールバックも行う。
 * 
 * 主な役割:
 * - エンジン状態の同期確認および安全なコマンド送信の保証
 * - デッドロックや無応答状態からの復帰処理
 */

export function createReadyWaiters() {
    let waiters = [];

    return {
        wait(timeoutMs = 30000) {
            return new Promise((resolve) => {
                const waiter = { resolve, timeoutId: null };
                waiter.timeoutId = setTimeout(() => {
                    waiters = waiters.filter(w => w !== waiter);
                    resolve(false);
                }, timeoutMs);
                waiters.push(waiter);
            });
        },

        resolveAll(value = true) {
            const currentWaiters = waiters;
            waiters = [];
            currentWaiters.forEach(waiter => {
                if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
                waiter.resolve(value);
            });
        }
    };
}
