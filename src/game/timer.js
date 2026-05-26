/**
 * 対局時計の計測ロジックおよびタイムアウト監視モジュール。
 * 
 * 時間を正確にトラッキングし、時間切れが発生した際にセッション状態を終了へ遷移させる。
 * 
 * 主な役割:
 * - 正確な経過時間計測と残り時間のステート更新
 * - 時間切れ判定および関連イベントのトリガー
 */

export class TimeManager {
    constructor(initialSec, incrementSec, onTimeout, mode = 'normal') {
        this.initialMs = initialSec * 1000;
        this.remainingMs = this.initialMs;
        this.incrementMs = incrementSec * 1000;
        this.mode = mode;
        this.startTime = 0;
        this.isRunning = false;
        this.onTimeout = onTimeout;
        this.timeoutId = null;
    }

    start() {
        if (this.mode === 'perMove') {
            this.remainingMs = this.initialMs;
        }
        this.startTime = performance.now();
        this.isRunning = true;
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.isRunning = false;
            if (this.onTimeout) this.onTimeout();
        }, this.remainingMs);
    }

    stop() {
        if (!this.isRunning) return true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        const elapsed = performance.now() - this.startTime;
        const nextRemaining = Math.max(0, this.remainingMs - elapsed);
        this.remainingMs = this.mode === 'perMove' ? this.initialMs : nextRemaining + this.incrementMs;
        this.isRunning = false;
        return nextRemaining > 0;
    }

    getCurrentRemaining() {
        if (!this.isRunning) return this.remainingMs;
        const elapsed = performance.now() - this.startTime;
        return Math.max(0, this.remainingMs - elapsed);
    }

    checkTimeout() {
        if (this.isRunning && this.getCurrentRemaining() <= 0) {
            this.isRunning = false;
            if (this.onTimeout) this.onTimeout();
            return true;
        }
        return false;
    }
}
