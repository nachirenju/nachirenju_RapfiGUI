/**
 * 対局ルールに関する設定（持ち時間、先手後手、エンジンのレベル等）を管理するモジュール。
 * 
 * ルールパラメータをカプセル化し、ゲームロジックやタイマーへ設定値を提供する。
 * 
 * 主な役割:
 * - 実行中のゲームルールのコンテキスト保持
 * - ゲーム設定のバリデーション
 */

export function parseGameTuningSettings(engineSettings) {
    const settings = engineSettings || {};
    const humanStyle = Boolean(settings.humanStyle);
    const inputThreshold = settings.blunderThreshold;
    const defaultBlunderRate = humanStyle ? 2 : 0;
    const defaultMissMateRate = humanStyle ? 20000 : 0;

    return {
        isHumanStyle: humanStyle,
        currentNBest: humanStyle ? 7 : (settings.nbest ? parseInt(settings.nbest, 10) : 3),
        currentBlunderRate: settings.blunderRate ? parseInt(settings.blunderRate, 10) : defaultBlunderRate,
        currentMissMateRate: settings.missMateRate ? parseInt(settings.missMateRate, 10) : defaultMissMateRate,
        currentBlunderThreshold: (inputThreshold !== '' && inputThreshold !== null && inputThreshold !== undefined)
            ? parseInt(inputThreshold, 10)
            : -Number.MAX_SAFE_INTEGER,
        currentMaxMoves: settings.maxMoves ? parseInt(settings.maxMoves, 10) : 120,
        forceStrength100: humanStyle
    };
}

export function resolvePlayerColorSettings(playerColorValue) {
    const playerColor = parseInt(playerColorValue, 10);
    const isAiVsAi = playerColor === 0;
    return {
        playerColor,
        isAiVsAi,
        aiColor: isAiVsAi ? 1 : (playerColor === 1 ? 2 : 1)
    };
}
