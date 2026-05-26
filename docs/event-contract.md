# Backend / Renderer Event Contract

このファイルは `src/backend.js` と `index.html` の間で使うイベント契約です。
リファクタリング時は、ここに書かれたイベント名・payload を互換性なしに変更しないでください。

## ルール

- Backend -> Renderer は `sendToRenderer(channel, payload)` で送る。
- Renderer 側の購読口は `public/preload_shim.js` の `window.electronAPI.onXxx`。
- イベント名を変える場合は、`src/backend.js`、`public/preload_shim.js`、`index.html` を同時に更新する。
- payload のキー名を削除・改名しない。追加は原則安全だが、既存キーの意味を変えない。
- 対局・研究・解析のリファクタリングでは、このファイルとの差分を確認してからビルドする。

## Backend -> Renderer

### `engine_ready`

購読口: `window.electronAPI.onEngineReady(cb)`

Payload: なし

用途:
エンジン初期化完了を画面へ通知する。

### `game_started`

購読口: `window.electronAPI.onGameStarted(cb)`

Payload:

```ts
{
  turn: 'player' | 'rapfi',
  nextColor: 1 | 2,
  playerTime: number,
  aiTime: number
}
```

用途:
対局開始後、次の手番・初期持ち時間を画面へ通知する。

注意:
`turn` は画面の手番表示と操作可否に使われる。

### `move`

購読口: `window.electronAPI.onMove(cb)`

Payload:

```ts
{
  x: number,
  y: number,
  color: 1 | 2,
  isAI: true,
  aiTime: number,
  playerTime: number
}
```

用途:
Rapfi の着手を画面へ反映する。

注意:
現状は主にAI着手で使う。人間の着手はRenderer側で即時反映してからBackendへ送る。

### `undo_result`

購読口: `window.electronAPI.onUndoResult(cb)`

Payload:

```ts
{
  moveHistory: Array<{ x: number, y: number, color: 1 | 2 }>,
  turn?: 'player',
  takeback?: boolean,
  aiTime?: number,
  playerTime?: number
}
```

用途:
待った、棋譜編集、研究モードの一手戻し後に盤面を再同期する。

注意:
対局中の待ったでは `takeback: true` を付ける。Rendererはこれを見てプレイヤー手番に戻す。

### `ai_log`

購読口: `window.electronAPI.onAiLog(cb)`

Payload:

```ts
string | string[]
```

用途:
AIログ欄へ表示する。`broadcastLog()` 経由では配列でまとめて送られる。

### `game_over`

購読口: `window.electronAPI.onGameOver(cb)`

Payload:

```ts
{
  reason: 'win' | 'draw' | 'manual' | 'timeout',
  winner: string
}
```

用途:
対局終了を通知し、画面をレビュー状態に切り替える。

### `show_graph`

購読口: `window.electronAPI.onShowGraph(cb)`

Payload:

```ts
Array<any>
```

用途:
評価グラフを表示する。現在は `GameState.getEvalHistory()` の戻り値を渡す。

### `history_list`

購読口: `window.electronAPI.onHistoryList(cb)`

Payload:

```ts
Array<{
  id: string | number,
  moves: Array<{ x: number, y: number, color: 1 | 2 }>,
  evals?: Array<any>,
  [key: string]: any
}>
```

用途:
保存棋譜リストをロード・削除後に画面へ渡す。

### `load_record_data`

購読口: `window.electronAPI.onLoadRecordData(cb)`

Payload:

```ts
{
  id: string | number,
  moves: Array<{ x: number, y: number, color: 1 | 2 }>,
  evals: Array<any>
}
```

用途:
保存棋譜を画面に読み込ませる。

### `analysis_progress`

購読口: `window.electronAPI.onAnalysisProgress(cb)`

Payload:

```ts
{
  current: number,
  total: number,
  score: number | string
}
```

用途:
棋譜解析の進捗バーを更新する。

注意:
`score` は通常数値だが、メイト表記などを扱う場合は文字列も許容する。

### `analysis_complete`

購読口: `window.electronAPI.onAnalysisComplete(cb)`

Payload:

```ts
Array<any>
```

用途:
棋譜解析結果を画面へ渡し、グラフ・統計表示に使う。

### `quiz_list_data`

購読口: `window.electronAPI.onQuizListData(cb)`

Payload:

```ts
Array<any>
```

用途:
保存済みクイズ一覧を画面へ渡す。

### `research_update`

購読口: `window.electronAPI.onResearchUpdate(cb)`

Payload:

```ts
{
  rank: number,
  depth: number,
  x: number,
  y: number,
  score: number,
  turnColor: 1 | 2,
  pv?: string | string[],
  [key: string]: any
}
```

用途:
研究モードの候補手、評価値、PV表示を更新する。

注意:
Rendererは `rank`、`depth`、`x`、`y`、`score`、`turnColor` を直接参照している。

## Backend -> Renderer: 未購読または要確認

### `analysis_mode_started`

Payload: なし

現状:
`src/backend.js` から送信されているが、`public/preload_shim.js` と `index.html` に購読口がない。

扱い:
今後削除候補。ただし削除前に古いElectron版など別入口で使っていないか確認する。

## Renderer -> Backend

RendererからBackendへ送る入口は `public/preload_shim.js` の `window.electronAPI` に固定する。

### `requestHistory()`

Backend: `window.backendAPI_request_history()`

Payload: なし

結果イベント: `history_list`

### `requestQuizList()`

Backend: `window.backendAPI_request_quiz_list()`

Payload: なし

結果イベント: `quiz_list_data`

### `startGame(data)`

Backend: `window.backendAPI_start_game(data)`

主なPayload:

```ts
{
  playerColor: string | number,
  playerTime: number,
  playerIncrement: number,
  aiTime: number,
  aiIncrement: number,
  timeRule?: 'normal' | 'perMove',
  turnTimePercent?: number,
  turnTimeMarginMs?: number,
  initialStones?: Array<{ x: number, y: number, color: 1 | 2 }>,
  engineSettings?: Record<string, any>
}
```

`timeRule: 'perMove'` ではエンジンへ `TIME_LEFT 0` と `TIMEOUT_TURN = 一手の時間 - turnTimeMarginMs` を送る。
`timeRule: 'normal'` では `TIME_LEFT = 残り時間`、`TIMEOUT_TURN = 残り時間 * turnTimePercent / 100 - turnTimeMarginMs` を送る。

結果イベント: `game_started`, 必要に応じて `move`, `game_over`

### `playerMove(data)`

Backend: `window.backendAPI_player_move(data)`

Payload:

```ts
{ x: number, y: number }
```

結果イベント: `move`, `game_over`

### `undoMove()`

Backend: `window.backendAPI_undo_move()`

Payload: なし

結果イベント: `undo_result`

### `takebackMove()`

Backend: `window.backendAPI_takeback_move()`

Payload: なし

結果イベント: `undo_result`

注意:
対局中の待ったは `undo_result` に `takeback: true` を付けて返す。

### `finishGame()`

Backend: `window.backendAPI_finish_game()`

Payload: なし

結果イベント: `game_over`, `show_graph`

### `loadGameRecord(id)`

Backend: `window.backendAPI_load_game_record(recordId)`

Payload:

```ts
string | number
```

結果イベント: `load_record_data`

### `deleteGameRecord(id)`

Backend: `window.backendAPI_delete_game_record(recordId)`

Payload:

```ts
string | number
```

結果イベント: `history_list`

### `analyzeGame(data)`

Backend: `window.backendAPI_analyze_game(data)`

主なPayload:

```ts
{
  moves: Array<{ x: number, y: number, color: 1 | 2 }>,
  threads?: number,
  hashSize?: number,
  nbest?: number,
  [key: string]: any
}
```

結果イベント: `analysis_progress`, `analysis_complete`

### `saveAnalysisResult(data)`

Backend: `window.backendAPI_save_analysis_result(data)`

Payload:

```ts
{
  recordId: string | number,
  evals: Array<any>
}
```

結果イベント: なし

### `saveQuizList(list)`

Backend: `window.backendAPI_save_quiz_list(quizList)`

Payload:

```ts
Array<any>
```

結果イベント: なし

### `toggleResearch(enabled, nbest, threads, hashSize)`

Backend: `window.backendAPI_toggle_research(enabled, nbest, threads, hashSize)`

Payload:

```ts
enabled: boolean
nbest: number
threads: number
hashSize: number
```

結果イベント: `research_update`

### `researchSync(history, nbest, threads, hashSize)`

Backend: `window.backendAPI_research_sync(history, nbest, threads, hashSize)`

Payload:

```ts
history: Array<{ x: number, y: number, color: 1 | 2 }>
nbest: number
threads: number
hashSize: number
```

結果イベント: `research_update`

### `researchClick(move)`

Backend: `window.backendAPI_research_click(move)`

Payload:

```ts
{ x: number, y: number }
```

結果イベント: `research_update`

注意:
`preload_shim.js` には入口があるが、現状の `index.html` では直接呼び出しが見当たらない。今後使う場合も契約名は維持する。

### `sendUpdateEngineSetting(data)`

Backend: `window.backendAPI_update_engine_setting(data)`

Payload:

```ts
Record<string, any>
```

結果イベント: なし

## Backend内にあるがRenderer公開されていない入口

### `window.backendAPI_research_undo()`

現状:
`src/backend.js` にあるが `public/preload_shim.js` に対応する `window.electronAPI.researchUndo()` がない。

扱い:
必要なら公開口を追加する。不要なら将来削除候補。

### `window.backendAPI_init()`

現状:
Backend初期化用。`DOMContentLoaded` / `setTimeout` で内部的に呼ばれる。

扱い:
Renderer操作APIとして扱わない。
