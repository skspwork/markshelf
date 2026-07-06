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

## 見出しアンカー（URL フラグメント `#`）

- クエリの後ろに URL フラグメント `#<見出しID>` を付けて特定セクションを共有できる（例: `?file=docs%2Ffoo.md#設計`）
- 見出し ID は [SPEC3.5 Markdown レンダリング](../SPEC3-UIコンポーネント/SPEC3.5-Markdownレンダリング.md) の `parseHeadings()` が採番した ID と一致（[SPEC3.3 TableOfContents](../SPEC3-UIコンポーネント/SPEC3.3-TableOfContents.md) のアンカーと同じ）
- 初期表示スクロール: `src/components/DetailPanel.tsx` が、内容タブでファイルの本文・見出しがレンダリングされた後に `location.hash` を読み、対応する見出しをスクロールコンテナ上端付近へスクロールさせる（`requestAnimationFrame` 後にコンテナ相対で位置補正、ファイルごとに 1 回だけ）
- フラグメント更新: 見出しアンカーのコピー操作（`src/components/Markdown.tsx`）と目次クリック（`src/components/TableOfContents.tsx`）が `history.replaceState` で `#` を書き換える（履歴を増やさない）
- ファイル切替時（`navigateTo`）は前ファイルの見出しを指す `#` を消してから遷移する。URL 由来の初期表示は `navigateTo` を経由しないためフラグメントを保持する
- `page.tsx` の URL 同期はライブの `location.hash` を保存するので、上記のフラグメント更新を上書きしない
