/**
 * エンジンの探索に影響を与えるパラメータ群（スレッド数、ハッシュサイズ、MultiPV数など）を管理するモジュール。
 * 
 * ユーザーがUIから変更した設定値を受け取り、エンジンに渡すためのコマンドフォーマットに変換する。
 * 設定値の永続化や、エンジンの再起動が必要な設定変更のハンドリングも担当する。
 * 
 * 主な役割:
 * - 実行時パラメータの状態保持とバリデーション
 * - エンジンへの設定反映コマンドの発行
 */

export function getEngineThreadCount(requestedThreads, supportsThreads) {
    if (!supportsThreads) return 1;
    const parsed = parseInt(requestedThreads, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
