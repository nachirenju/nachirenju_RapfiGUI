/**
 * 対局時計（残り時間のUI表示）のカウントダウン・更新処理モジュール。
 * 
 * 残り時間を受け取り、UI上の秒数・時間を滑らかに更新・表示する。警告表示のトリガーも行う。
 * 
 * 主な役割:
 * - UIタイマーの駆動および表示フォーマットの変換
 * - クライアント側での軽量なカウントダウン処理
 */

export function installTimerMethods(proto) {
    proto.tick = function() {
            if (this.gameActive && this.activeSide) {
                const now = performance.now();
                const delta = now - this.lastTick;
                this.lastTick = now;
                this.timers[this.activeSide] = Math.max(0, this.timers[this.activeSide] - delta);
                const currentSec = Math.ceil(this.timers[this.activeSide] / 1000);
                if (currentSec !== this.lastCountdownSec) {
                    if ([30, 10, 5, 4, 3, 2, 1].includes(currentSec)) this.playSound('time');
                    this.lastCountdownSec = currentSec;
                }
            }
            this.updateTimerUI()
            requestAnimationFrame(() => this.tick());
        
    };

    proto.updateTimerUI = function() {
            const fmt = (ms) => {
                if (ms < 0) ms = 0;
                const secondsFloat = ms / 1000;
                const fixedStr = secondsFloat.toFixed(1);
                const totalSeconds = parseFloat(fixedStr);
                const m = Math.floor(totalSeconds / 60);
                const s = Math.floor(totalSeconds % 60);
                const d = fixedStr.split('.')[1];
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`;
            };
            
            const playerStr = fmt(this.timers.player);
            const rapfiStr = fmt(this.timers.rapfi);

            // ★変更: 文字列が変化した時だけHTML(DOM)を書き換える
            if (this._lastPlayerTimeStr !== playerStr) {
                this.timerEl.player.textContent = playerStr;
                this._lastPlayerTimeStr = playerStr;
            }
            if (this._lastRapfiTimeStr !== rapfiStr) {
                this.timerEl.rapfi.textContent = rapfiStr;
                this._lastRapfiTimeStr = rapfiStr;
            }

            // タイマー枠の色付け（これも本来は状態が変わった時だけで良いですが、クラス切り替えは比較的軽いのでそのままにします）
            document.getElementById('playerTimerBox').classList.toggle('active', this.activeSide === 'player');
            document.getElementById('rapfiTimerBox').classList.toggle('active', this.activeSide === 'rapfi');
        
    };
}
