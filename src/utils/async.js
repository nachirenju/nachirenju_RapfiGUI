/**
 * 非同期処理を扱うための汎用的なユーティリティモジュール。
 * 
 * タイムアウト付きのPromiseや待機ロジックなど、再利用される非同期パターンを実装する。
 * 
 * 主な役割:
 * - 非同期フロー制御の汎用化
 * - Promiseベースのユーティリティ提供
 */

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
