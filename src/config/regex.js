/**
 * WASMエンジンからの標準出力（stdout）をパースするための正規表現を定義するモジュール。
 * 
 * 「INFO」行から探索深度、評価値、ノード数、PV（読み筋）などを抽出したり、特定のコマンド完了文字列（BESTMOVEなど）を検知するためのパターンを一元管理する。
 * エンジンのバージョンアップ等で出力形式が変更された際、ここを修正するだけで対応可能にする。
 * 
 * 主な役割:
 * - エンジン出力解析用正規表現の一元管理と最適化
 */

export const REGEX_DEPTH_TEXT  = /Depth\s+(\d+)/i;
export const REGEX_DEPTH       = /\|\s*(\d+)-/;
export const REGEX_MOVE_CMD    = /^(\d+),(\d+)$/;
export const REGEX_MULTI_PV    = /\((\d+)\)/;
export const REGEX_SCORE_PV    = /(?:Eval|score|val|(?:\(\d+\)))\s+([+-]?M?\d+|[+-]?\d+)/i;
export const REGEX_WHITESPACE  = /\s+/;
export const REGEX_MESSAGE_PV  = /(?:MESSAGE\s+)?\(\d+\)/;
export const REGEX_SCORE_EVAL  = /(?:Eval|val|score)[:\s]+([+-]?M?\d+)/i;
