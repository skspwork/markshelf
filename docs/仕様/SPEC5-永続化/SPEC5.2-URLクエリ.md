# SPEC5.2: URL クエリ `?file=`

[REQ4.2 — 共有可能 URL](../../要件定義/REQ4-ナビゲーション/REQ4.2-共有可能URL.md) の実装。

## 設計

- 実装: `src/app/page.tsx`
- クエリキー: `file`（`FILE_QUERY_KEY` 定数）
- 値: ドキュメントルートからの相対パス（`encodeURIComponent` 済み）
- 例: `http://localhost:3000/?file=docs%2F%E8%A6%81%E4%BB%B6%E5%AE%9A%E7%BE%A9%2FREQ1.md`

## 動作

- 初期化時: `readFileFromUrl()` が `URLSearchParams.get("file")` を読み、`decodeURIComponent` の上で `setSelectedPath()`
- 選択ファイル変更時: 選択中 path を URL に `history.replaceState` で書き込む（`pushState` は使わないので戻る／進む履歴を汚さない）
- 選択解除時（`selectedPath === null`）: クエリを削除
- 同じ URL になる場合は `replaceState` をスキップして無駄な履歴書き換えを避ける
