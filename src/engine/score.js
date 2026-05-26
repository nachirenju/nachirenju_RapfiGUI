/**
 * エンジンから返される評価値（スコア）の計算・正規化・フォーマットを行うモジュール。
 * 
 * 内部スコア（絶対値）から、現在の持ち手に応じた相対スコアや勝率への変換、あるいは詰み（Mate）までの手数の表現（M+ / M-）を計算する。
 * グラフ表示やUI表示用に適したデータ構造を提供する。
 * 
 * 主な役割:
 * - スコアの人間可読な文字列（例: +M5, +300）へのフォーマット
 * - 評価値から勝率への非線形変換ロジック
 */

const REGEX_NON_DIGIT_G = /[^0-9]/g;

export function parseRapfiScore(scoreText) {
    const normalized = String(scoreText || '').toUpperCase();
    if (normalized.includes('M')) {
        const sign = normalized.startsWith('-') ? -1 : 1;
        const mateDist = parseInt(normalized.replace(REGEX_NON_DIGIT_G, ''), 10) || 0;
        return sign * (30000 - mateDist);
    }
    return parseInt(normalized, 10);
}
