# SPEC3.8: 画像プレビュー / asset 配信

[REQ3.6 — 画像プレビュー](../../要件定義/REQ3-プレビューとツリー/REQ3.6-画像プレビュー.md) の実装。

## 設計

- `<Markdown>` の `img` コンポーネントが、相対 src を `resolveAssetPath()` で解決し、`/api/asset?path=...` ([SPEC4.8](../SPEC4-API/SPEC4.8-asset.md)) に書き換える
- `data:`・`http(s):`・プロトコル相対の src はそのまま素通し
- `/api/asset` は `MARKSHELF_ROOT` 配下のバイナリを読んで、拡張子ベースで Content-Type を付けて返す
- 対応拡張子: `.png` `.jpg` `.jpeg` `.gif` `.svg` `.webp` `.avif` `.ico` `.bmp`
- パストラバーサル防止のため、解決後のパスが `DOCS_ROOT` の下にあることを `startsWith` で検証
