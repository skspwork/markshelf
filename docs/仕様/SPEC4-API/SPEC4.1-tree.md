# SPEC4.1: /api/tree

[REQ3.2 — ツリービュー](../../要件定義/REQ3-プレビューとツリー/REQ3.2-ツリービュー.md) のためにドキュメントのツリー構造を返す API。

## 設計

- メソッド: `GET /api/tree`
- クエリ: なし
- レスポンス
  ```json
  {
    "root": "/abs/path/to/docs",
    "tree": [
      { "name": "REQ1-...", "displayName": "REQ1-...", "path": "REQ1-...", "type": "folder", "hasReadme": true, "children": [...] },
      { "name": "foo.md",   "displayName": "foo",       "path": "foo.md",   "type": "file" }
    ]
  }
  ```
- 無視対象: `node_modules`, `.git`, `.next`, `dist`, `.turbo`、先頭が `.` のディレクトリ
- 並び順: `^(\d+)[_\-.\s]` の数値プレフィックスがあれば数値順、無ければ日本語ロケールで `localeCompare`
- `displayName` は順序プレフィックスを除去した名称
- ルート直下の `README.md` はルート名を displayName にした仮想エントリとしてツリー先頭に差し込む
- 子 Markdown が一切ないフォルダは省く
