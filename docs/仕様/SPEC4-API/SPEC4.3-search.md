# SPEC4.3: /api/search

[REQ5.1 — 全文検索](../../要件定義/REQ5-ファイル検索/REQ5.1-ファイル名検索.md) のバックエンド。

## 設計

- メソッド: `GET /api/search?q=<query>`
- レスポンス
  ```json
  {
    "results": [
      {
        "path": "REQ1-.../REQ1.1-npx起動.md",
        "displayName": "REQ1.1-npx起動",
        "matches": [ { "line": 12, "text": "npx markshelf で起動" } ]
      }
    ]
  }
  ```
- 空文字のクエリは `{ results: [] }` を即返し
- マッチ判定は `line.toLowerCase().includes(query.toLowerCase())`
- ファイルごとに最大 5 件までマッチを収集して結果を返す（画面には上位 2 件のみ表示）
- ツリー全体を `buildTree` + `flattenTree` で走査するため、ファイル数が多い場合は自然に重くなる（将来の最適化ポイント）
