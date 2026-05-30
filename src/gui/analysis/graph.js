/**
 * 探索結果や一括解析に基づく評価値推移グラフを描画・更新するモジュール。
 * 
 * Chart.js などのライブラリを用いて、対局ごとのスコア変動を視覚的に表現する。
 * ユーザーがグラフ上の点をクリックした際に、該当手番の盤面へジャンプする連携機能も提供する。
 * 
 * 主な役割:
 * - 評価値データ配列からチャート用データセットへの変換
 * - グラフの描画、リサイズ対応、クリックイベントのハンドリング
 */

export function installGraphMethods(proto) {
    proto.updateRealtimeEval = function(rawScoreStr) {
            // 表示パネルが存在しない場合は何もしない
            const scoreEl = document.getElementById('rtEvalScore');
            const rateEl = document.getElementById('rtWinRate');
            if (!scoreEl || !rateEl) return;

            // 1. エンジンの数値をそのままテキストとして採用
            // (Eval 452 なら "+452", Eval -100 なら "-100" と表示)
            let scoreDisplay = rawScoreStr;
            if (!scoreDisplay.startsWith('-') && !scoreDisplay.startsWith('+') && !scoreDisplay.includes('M')) {
                scoreDisplay = "+" + scoreDisplay;
            }

            // 2. 勝率計算用の数値変換 (Mは極端な値にする)
            let scoreVal = 0;
            if (rawScoreStr.toUpperCase().includes('M')) {
                const sign = rawScoreStr.startsWith('-') ? -1 : 1;
                scoreVal = sign * 30000;
            } else {
                scoreVal = parseInt(rawScoreStr, 10);
            }

            // 3. 勝率計算 (現在の思考側から見た勝率)
            const K = 200;
            const winRate = 1 / (1 + Math.exp(-scoreVal / K));
            const winRatePct = Math.round(winRate * 100);

            // 4. 表示の反映
            scoreEl.textContent = scoreDisplay;
            rateEl.textContent = winRatePct + "%";
            
            // 色分け：黒有利：#2F80FF、白有利：#FF5C7A、互角：#B8C0CC
            const isBlackTurn = (this.moveHistory ? this.moveHistory.length : 0) % 2 === 0;
            let color = '#B8C0CC'; // 互角
            
            let isBlackAdv = false;
            let isWhiteAdv = false;
            
            if (isBlackTurn) {
                if (scoreVal > 50) isBlackAdv = true;
                else if (scoreVal < -50) isWhiteAdv = true;
            } else {
                if (scoreVal > 50) isWhiteAdv = true;
                else if (scoreVal < -50) isBlackAdv = true;
            }
            
            if (isBlackAdv) {
                color = '#2F80FF';
            } else if (isWhiteAdv) {
                color = '#FF5C7A';
            }
            
            scoreEl.style.color = color;
            rateEl.style.color = color;
        
    };

    proto.clearRealtimeEval = function() {
            const scoreEl = document.getElementById('rtEvalScore');
            const rateEl = document.getElementById('rtWinRate');
            if (scoreEl && rateEl) {
                scoreEl.textContent = "--";
                scoreEl.style.color = "#B8C0CC";
                rateEl.textContent = "--%";
                rateEl.style.color = "#B8C0CC";
            }
        
    };

    proto.setGraphVisibility = function(visible) {
            const container = document.getElementById('graph-container');
            if (container) {
                container.style.display = visible ? 'block' : 'none';
            }
        
    };

    proto.drawGraph = function(data) {
            const ctx = document.getElementById('evalChart').getContext('2d');
            const self = this;
            
            if (this.evalChart) this.evalChart.destroy();

            const winRateData = data.map(d => {
                let evalScore = d.score;
                if (evalScore >= 20000) evalScore = 30000;
                else if (evalScore <= -20000) evalScore = -30000;

                const K = 200; 
                const winRate = 1 / (1 + Math.exp(-evalScore / K));
                return winRate * 100;
            });

            // 文字描画プラグイン
           // 翻訳用のヘルパー関数を定義（日本語モードで lang.js がスキップされた場合はそのまま文字列を返す）
const t = window.rapfiTranslate || (str => str);

const labelPlugin = {
    id: 'customLabels',
    afterDraw: (chart) => {
        const { ctx, chartArea: { top, bottom, right } } = chart;
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#666'; 
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        // t() で囲んで翻訳を適用
        ctx.fillText(t('黒有利 ▲'), right - 10, top + 10);
        ctx.textBaseline = 'bottom';
        // t() で囲んで翻訳を適用
        ctx.fillText(t('白有利 △'), right - 10, bottom - 10);
        ctx.restore();
    }
};

this.evalChart = new Chart(ctx, {
    type: 'line',
    data: {
        // "手" は辞書に登録するか、以下のようにもともとある "着手" を使うなど工夫できます
        // 例: labels: data.map(d => d.move + t('手')), 
        labels: data.map(d => d.move + "手"), // ← ここも翻訳したい場合は辞書に "手": "th move" などを追加して t("手") にします
        datasets: [{
            // 辞書に登録されている 'Rapfi評価値' だけを抽出して翻訳
            label: t('Rapfi評価値') + ' (%)', 
            data: winRateData,
            borderColor: '#007bff',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            pointHitRadius: 10
        }]
    },

                
                // プラグインの登録
                plugins: [labelPlugin],

                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    
                    //  ダブルクリックでズームリセット
                    onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                            // 点をクリックしたらその局面にジャンプ
                            const index = elements[0].index;
                            self.jumpToMove(data[index].move);
                        } else {
                            // 何もないところをダブルクリックっぽく連打したらリセット(簡易実装)
                            // Chart.jsには標準のダブルクリックがないため、必要ならボタンを作るのが確実ですが
                            // ここでは zoomプラグインの機能でリセットボタン不要のUIにします
                            chart.resetZoom();
                        }
                    },

                    scales: {
                        x: {
                            //  ズームしたときにX軸の範囲を制限（データがない場所までスクロールしないように）
                            min: 0,
                            max: data.length - 1
                        },
                        y: {
                            min: 0, max: 100,
                            ticks: { stepSize: 25, callback: v => v + "%" },
                            grid: {
                                color: (ctx) => (ctx.tick.value === 50 ? '#666' : '#ddd'),
                                lineWidth: (ctx) => (ctx.tick.value === 50 ? 1 : 0.5)
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const index = context.dataIndex;
                                    const rawVal = data[index].score;
                                    let scoreText = rawVal;
                                    if (rawVal >= 20000) scoreText = "M (Win)";
                                    else if (rawVal <= -20000) scoreText = "M (Lose)";
                                    else if (rawVal > 0) scoreText = "+" + rawVal;
                                    return `Rapfi評価: ${context.parsed.y.toFixed(1)}% (Score: ${scoreText})`;
                                }
                            }
                        },
                        // ズーム機能の設定
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: 'x', // 横方向のみスクロール可能にする（縦は0-100%固定が見やすいため）
                                modifierKey: null, // キーを押さなくてもドラッグで動く
                            },
                            zoom: {
                                wheel: {
                                    enabled: true, // マウスホイールで拡大縮小
                                },
                                pinch: {
                                    enabled: true // スマホ等のピンチ操作
                                },
                                mode: 'x', // 横方向のみ拡大縮小
                            }
                        }
                    }
                }
            });
        
    };

    proto.closeGraph = function() {
    this.setGraphVisibility(false);

    };

    proto.requestUpdateGraph = function() {
            if (!this.graphUpdatePending) {
                this.graphUpdatePending = true;
                requestAnimationFrame(() => {
                    this.updateResearchGraph();
                    this.graphUpdatePending = false;
                });
            }
        
    };

    proto.updateResearchGraph = function() {
            if (!this.isResearchMode) return;
            
            const graphData = [];
            // 0手目(初期盤面)から現在手数までデータを生成
            for (let i = 0; i <= this.moveHistory.length; i++) {
                let s = 0;
                // 最新のAI評価値があればそれを使い、無ければ過去の解析結果などを流用
                if (this.researchEvals[i] !== undefined) {
                    s = this.researchEvals[i];
                } else if (this.lastAnalysisResults) {
                    const past = this.lastAnalysisResults.find(r => r.move === i);
                    if (past) s = past.score;
                }
                graphData.push({ move: i, score: s });
            }

            // グラフがまだ画面に無ければ新規作成
            if (!this.evalChart) {
                this.setGraphVisibility(true);
                this.drawGraph(graphData);
            } else {
                // 既にグラフがある場合は、中身のデータだけを差し替えて超高速で再描画する
                const K = 200;
                const winRateData = graphData.map(d => {
                    let evalScore = d.score;
                    if (evalScore >= 20000) evalScore = 30000;
                    else if (evalScore <= -20000) evalScore = -30000;
                    return (1 / (1 + Math.exp(-evalScore / K))) * 100;
                });

                this.evalChart.data.labels = graphData.map(d => d.move + "手");
                this.evalChart.data.datasets[0].data = winRateData;
                this.evalChart.options.scales.x.max = graphData.length - 1;
                this.evalChart.update('none'); // 'none' でアニメーションを切り、負荷をゼロにする
            }
        
    };
}
