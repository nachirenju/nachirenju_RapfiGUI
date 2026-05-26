/**
 * アプリケーション内の効果音（着手音、エラー音など）の再生制御を行うモジュール。
 * 
 * 複数の音源を非同期で再生管理し、ユーザーのボリューム設定やサウンドON/OFF状態もハンドリングする。
 * 
 * 主な役割:
 * - アセットのプリロードおよび再生タイミングの制御
 * - 環境依存の自動再生ブロック等の回避
 */

export function installAudioMethods(proto) {
    proto.playSound = function(key) {
            if (!this.audioCtx) return;
            if (key === 'move' && this.enableMoveSound === false) return;
            if ((key === 'time' || key === 'timeout') && this.enableTimeSound === false) return;
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            
            const t = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            if (key === 'move') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
                osc.start(t);
                osc.stop(t + 0.05);
            } else if (key === 'time') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
            } else if (key === 'timeout') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
                osc.start(t);
                osc.stop(t + 0.5);
            }
        
    };
}
