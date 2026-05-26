/**
 * フロントエンド（UI・レンダラー）側のメインエントリーポイント。
 * 
 * Webページ読み込み時に実行され、UIコンポーネントの初期化、イベントリスナーの登録、バックエンドとの通信パイプラインの確立を行う。
 * SPA（Single Page Application）としての初期描画をトリガーする。
 * 
 * 主な役割:
 * - フロントエンド全体のブートストラップ処理
 * - グローバルなUIオブジェクトの設定と公開
 */

// Frontend application entry extracted from index.html.
// Keep behavior-compatible with before_frontend.js while moving code into modules.
import { RapfiApp } from './app/rapfi-app.js';
import { initializeFloatingWindows } from './ui/windows.js';
import { installDefaultEngineSettings } from './ui/default-settings.js';
import { mountDetachedSettingsPanels } from './ui/settings-layout.js';

window.app = new RapfiApp();

mountDetachedSettingsPanels();

initializeFloatingWindows();

installDefaultEngineSettings(window.app);
