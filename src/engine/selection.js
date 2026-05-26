/**
 * エンジンから提案された候補手リスト（MultiPV）から、適切な最終手を選択するモジュール。
 * 
 * 評価値が近接する複数の手がある場合に、特定の設定に基づいて手を選別・フィルタリングする。
 * ai/moves.jsの下請けとして、純粋なデータリスト操作と優先度付けのアルゴリズムを提供する。
 * 
 * 主な役割:
 * - 候補手リストのソートおよび無効な手のフィルタリング
 * - 探索結果に基づく最適手の決定アルゴリズム
 */

import { threads, simd, relaxedSimd } from 'wasm-feature-detect';
import { assetURL } from '../config/paths.js';

const WASM_PAGE_SIZE = 65536;
const MB_IN_BYTES = 1024 * 1024;

function memoryPages(megabytes) {
    return megabytes * (MB_IN_BYTES / WASM_PAGE_SIZE);
}

export async function detectEngineCapabilities(iosBrowser) {
    const detectedThreads = await threads();
    const supportThreads =
        !iosBrowser &&
        detectedThreads &&
        typeof SharedArrayBuffer !== 'undefined' &&
        window.crossOriginIsolated === true;
    const supportSIMD = await simd();
    const supportRelaxedSIMD = supportThreads && (await relaxedSimd());

    return {
        detectedThreads,
        supportThreads,
        supportSIMD,
        supportRelaxedSIMD
    };
}

export function selectEngineURL({ supportThreads, supportSIMD, supportRelaxedSIMD }) {
    if (supportRelaxedSIMD) return assetURL('engine/rapfi-multi-simd128-relaxed.js');
    if (supportThreads && supportSIMD) return assetURL('engine/rapfi-multi-simd128.js');
    if (supportThreads) return assetURL('engine/rapfi-multi.js');
    return assetURL('engine/rapfi-single.js');
}

export function createEngineMemoryArgs({ supportThreads, iosBrowser }) {
    const singleThreadMaximumMemoryMb = iosBrowser ? 512 : 2048;
    return supportThreads ? {
        initial: memoryPages(64),
        maximum: memoryPages(2048),
        shared: true
    } : {
        initial: memoryPages(64),
        maximum: memoryPages(singleThreadMaximumMemoryMb),
        shared: false
    };
}

export function locateEngineFile(url, engineDirURL, engineURL) {
    if (/^rapfi-single.*\.data$/.test(url) || /rapfi-single.*\.js$/.test(engineURL)) {
        if (/^rapfi.*\.data$/.test(url)) url = 'rapfi-single.data';
    } else if (/^rapfi.*\.data$/.test(url)) {
        url = 'rapfi.data';
    }
    return engineDirURL + url;
}
