# SPEC4.8: /api/asset

[REQ3.6 — 画像プレビュー](../../要件定義/REQ3-プレビューとツリー/REQ3.6-画像プレビュー.md) のバックエンド。Markdown 中の `![](...)` がフロント側で `/api/asset?path=...` に書き換えられてから到達する。

## 設計

- メソッド: `GET /api/asset?path=<relative-path>`
- レスポンス: バイナリ（`Content-Type` は拡張子から決定、`Cache-Control: no-cache`）
- 対応拡張子と MIME
  | 拡張子 | Content-Type |
  |--------|-------------|
  | `.png` | `image/png` |
  | `.jpg` / `.jpeg` | `image/jpeg` |
  | `.gif` | `image/gif` |
  | `.svg` | `image/svg+xml` |
  | `.webp` | `image/webp` |
  | `.avif` | `image/avif` |
  | `.ico` | `image/x-icon` |
  | `.bmp` | `image/bmp` |
- 対応外の拡張子は `415 Unsupported Media Type`
- `path` 欠落で `400`、`readAsset()` が `null` で `404`
- パストラバーサル防止のため、`path.resolve()` 後に `DOCS_ROOT` の prefix チェックを行う
