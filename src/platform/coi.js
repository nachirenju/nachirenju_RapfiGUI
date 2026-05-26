/**
 * COI環境の検知および、WebAssemblyにおけるSharedArrayBufferの有効化判定モジュール。
 * 
 * 高パフォーマンスなマルチスレッド探索が利用可能かどうかを決定する。
 * 
 * 主な役割:
 * - COI環境の要件チェック
 * - マルチスレッド実行の可否判定ロジック
 */

import { assetURL } from '../config/paths.js';
import { delay } from '../utils/async.js';

export async function reloadForCrossOriginIsolationIfNeeded(iosBrowser) {
    if (iosBrowser || window.crossOriginIsolated === true) return false;
    if (!("serviceWorker" in navigator)) return false;

    const reloadKey = `rapfiBackendCoiReload:${assetURL('coi-serviceworker.js')}`;
    const count = parseInt(sessionStorage.getItem(reloadKey) || "0", 10);
    if (count >= 4) {
        console.warn("[COI] Cross-origin isolation still unavailable after backend retries. Falling back to single-thread engine.");
        return false;
    }

    sessionStorage.setItem(reloadKey, String(count + 1));
    console.warn("[COI] Waiting for Service Worker control before starting the threaded engine.");

    try {
        await Promise.race([
            navigator.serviceWorker.ready,
            delay(1500)
        ]);
    } catch (e) {}

    setTimeout(() => window.location.reload(), 50);
    return true;
}
