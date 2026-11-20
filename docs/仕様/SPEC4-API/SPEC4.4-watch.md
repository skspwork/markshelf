# SPEC4.4: /api/watch (SSE)

[REQ6.1 — SSE による変更通知](../../要件定義/REQ6-ファイル監視/REQ6.1-SSE変更通知.md) の実装。

## 設計

- メソッド: `GET /api/watch`
- Content-Type: `text/event-stream; charset=utf-8`（SSE）
- 送信するイベント:
  - `event: connected` / `data: { "root": "/docs" }` — 接続直後に 1 回
  - `event: change` / `data: { "path": "foo/bar.md" }` — ファイル変更を検知するたび
  - `event: error` / `data: { "message": "..." }` — `fs.watch` が失敗したとき
  - `: keepalive` コメント — 30 秒ごとにプロキシ切断対策で送信
- 監視は `fs.watch(DOCS_ROOT, { recursive: true, persistent: false })`
- 無視対象（ギャップを通らない）: `node_modules`, `.git`, `.next`, `dist`, `.turbo`、先頭が `.` のパス
- `request.signal.abort` で `watcher.close()` と `clearInterval(keepAlive)` を確実に解放
- クライアントは `src/lib/useRefreshTick.ts` の `useRefreshTick()` が購読し、`change` を受け取るたびに再取得トリガを発火

## シーケンス

```mermaid
sequenceDiagram
  autonumber
  participant C as useRefreshTick（ブラウザ）
  participant W as /api/watch
  participant FS as fs.watch(DOCS_ROOT)

  C->>W: GET /api/watch（EventSource）
  W->>FS: watch 開始（recursive）
  W-->>C: event: connected
  loop 30 秒ごと
    W-->>C: : keepalive
  end
  FS->>W: ファイル変更
  alt 無視対象（node_modules / .git / 先頭が . など）
    W->>W: 送信しない
  else 通常のファイル
    W-->>C: event: change { path }
    C->>C: 150ms デバウンス後に tick を加算し再取得
  end
  C-xW: 接続を切断（abort）
  W->>FS: watcher.close() / clearInterval
```
