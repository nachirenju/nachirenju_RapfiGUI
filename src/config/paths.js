/**
 * アプリケーション内で利用するファイルパスやURL、リソースエンドポイントを定義するモジュール。
 * 
 * WASMエンジン本体や、Web Worker用スクリプト、画像や音声アセットへの相対・絶対パスを管理し、ビルド環境（開発・本番）による差異を吸収する。
 * Viteなどのバンドラ設定に依存するパスの解決もここで行う場合がある。
 * 
 * 主な役割:
 * - 各種リソースパスのハードコード排除
 * - 環境ごとの正しいエンドポイントの提供
 */

export const BASE_URL = import.meta.env.BASE_URL || '/';

export function assetURL(path) {
    return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}
