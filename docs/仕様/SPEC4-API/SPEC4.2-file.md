# SPEC4.2: /api/file

[REQ3.1 — プレビューポップアップ](../../要件定義/REQ3-プレビューとツリー/REQ3.1-プレビューポップアップ.md) などが必要とする、個別 Markdown ファイルの内容を返す API。本文表示・プレビューポップアップの両方から呼ばれる。

## 設計

- メソッド: `GET /api/file?path=<relative-path>`
- レスポンス成功時:
  ```json
  { "path": "REQ1-.../REQ1.1-npx起動.md", "content": "# REQ1.1 ..." }
  ```
- エラー: `path` 欠落で `400`、読み取り不能／存在しないで `404`
- `path` は `MARKSHELF_ROOT` からの相対パス
- パストラバーサル防止のため、`path.resolve()` 後に `DOCS_ROOT` の prefix チェックを行う
