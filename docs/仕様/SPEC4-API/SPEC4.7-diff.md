# SPEC4.7: /api/diff

[REQ7.3 — diff 表示](../../要件定義/REQ7-変更履歴/REQ7.3-diff表示.md) のバックエンド。

## 設計

- メソッド: `GET /api/diff?path=<relative-path>&hash=<commit-hash>`
- レスポンス: `{ "diff": "diff --git a/... ..." }`
- `path` または `hash` が欠けていれば `400`
- 実装: `src/lib/git.ts` の `getFileDiff(relPath, hash)`
  - 通常は `git.diff([hash~1, hash, "--", relPath])` を返す
  - 初回コミットで `hash~1` が存在しないケースは `git show hash:relPath` で全文を取得し、`+ ` プレフィックス付きで返す
- 例外時は `(差分を取得できませんでした)` という文字列を返し、UI が空白にならないようにする
