/**
 * 盤面（碁盤）および石の描画処理をカプセル化したキャンバス描画モジュール。
 * 
 * HTML5 Canvas API を利用し、罫線、星点、黒白の石、および直前の着手を示すハイライトマーカーをレンダリングする。
 * 端末の高解像度描画や、リサイズ時のスケーリング対応も行う。
 * 
 * 主な役割:
 * - 盤面と石のグラフィック描画と最適化
 * - クリックイベントから盤面座標へのピクセル変換
 */

export function installBoardRendererMethods(proto) {
    proto.toggleNumbers = function() { this.showNumbers = !this.showNumbers; this.drawBoard(); 
    };
}
