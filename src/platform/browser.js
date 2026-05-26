/**
 * ブラウザ環境固有のAPI（DOM、Window等）へのアクセスを抽象化するラッパーモジュール。
 * 
 * 環境依存の機能を分離することで、異なる実行環境での動作互換性を保ちやすくする。
 * 
 * 主な役割:
 * - 環境依存コードの隔離
 * - グローバルオブジェクトへの安全なアクセス
 */

export function isIOSBrowser() {
    return (
        (/iPad|iPhone|iPod/.test(navigator.platform) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
        !window.MSStream
    );
}
