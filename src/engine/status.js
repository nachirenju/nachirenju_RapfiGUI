/**
 * エンジンの現在の動作状態（ビジー、アイドル、エラー、終了など）を一元管理するモジュール。
 * 
 * バックエンド各層からエンジンの状態をポーリングなしで安全に参照・更新できるようにし、状態遷移イベントを発行する。
 * 探索開始時や終了時の内部フラグ管理をカプセル化する。
 * 
 * 主な役割:
 * - エンジン状態のステートマシン管理
 * - 各種状態異常時（クラッシュ等）のエラー状態への遷移と通知
 */

export function parseEngineDownloadStatus(status) {
    const match = typeof status === 'string'
        ? status.match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/)
        : null;
    if (!match) return null;

    const loaded = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    const pct = total > 0 ? Math.floor((loaded / total) * 10) * 10 : 0;
    return { loaded, total, pct };
}

export function shouldResetDownloadProgress(status) {
    return typeof status === 'string' && !status.includes('Downloading data');
}
