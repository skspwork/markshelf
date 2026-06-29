# SPEC4.6: /api/timeline

[REQ7.2 — タイムライン](../../要件定義/REQ7-変更履歴/REQ7.2-タイムライン.md) のバックエンド。

## 設計

- メソッド: `GET /api/timeline`
- レスポンス
  ```json
  {
    "entries": [
      {
        "hash": "...",
        "hashShort": "c07e676",
        "date": "2026-04-...",
        "message": "クライアントからのリクエスト時に BASE_PATH を考慮するよう修正",
        "author": "...",
        "files": ["src/lib/basePath.ts"]
      }
    ]
  }
  ```
- 実装: `src/lib/git.ts` の `getTimeline(maxCount=100)`
- 内部的に `git log --max-count=100 --format=... --name-only --diff-filter=ACDMR -- *.md` を走らせる
- `MARKSHELF_ROOT` と git リポジトリ root が違う（例: リポジトリ直下の `docs/`）場合は、`git.revparse --show-toplevel` でプレフィックスを取り、`files` を docs root 相対に変換
- `.md` 以外の変更は捨てる（タイムラインはドキュメント変更のみ表示）
