# ビルド手順

本プロジェクトをビルドして実行するための手順です。

## 1. エンジンバイナリの配置

本リポジトリには大容量のエンジンバイナリや学習データが含まれていません。
ビルドおよび実行の前に、以下のファイルを `public/engine/` ディレクトリ配下に配置してください。

* **配置先**: `public/engine/`
* **必要なファイル一式**:
  * `config.toml`
  * 各種モデル・ウェイトファイル（例: `*.bin.lz4`, `*.data`, `*.wasm`）
  * 各種WebAssemblyエンジンファイル（例: `rapfi-single.js`, `rapfi-multi.js` 等）

エンジンのビルド方法や詳細については、以下の公式リポジトリをご参照ください：
* [dhbloo/rapfi](https://github.com/dhbloo/rapfi)
* [dhbloo/gomoku-calculator](https://github.com/dhbloo/gomoku-calculator)

---

## 2. 依存関係のインストール

プロジェクトのルートディレクトリ（`package.json` がある場所）で以下を実行します。

```bash
npm install
```

---

## 3. 開発サーバーの起動

ローカルでの開発・デバッグ用に開発サーバーを起動します。

```bash
npm run dev
```

---

## 4. プロダクションビルドの作成

本番環境用の静的ファイルをビルドします。成果物は `dist/` ディレクトリに出力されます。

```bash
npm run build
```
