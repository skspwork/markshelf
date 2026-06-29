# SPEC4.5: /api/history

[REQ7.1 — ファイル変更履歴](../../要件定義/REQ7-変更履歴/REQ7.1-ファイル変更履歴.md) のバックエンド。

## 設計

- メソッド: `GET /api/history?path=<relative-path>`
- レスポンス: `CommitEntry[]`
  ```json
  [
    {
      "hash": "8be4746...",
      "hashShort": "8be4746",
      "date": "2026-04-20T...",
      "message": "目次にコードブロック内の#が表示されるのを修正",
      "author": "久保槙之介"
    }
  ]
  ```
- 実装: `src/lib/git.ts` の `getFileHistory(relPath, maxCount=30)`
- 内部的に `simple-git` の `git.log({ file, maxCount })` を使用
- `.git` が無い／git で読めない場合は `[]` を返す（例外を握り潰す）
