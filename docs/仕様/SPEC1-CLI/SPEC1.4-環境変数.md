# SPEC1.4: 環境変数

[REQ1.1 npx 起動](../../要件定義/REQ1-ビューア起動/REQ1.1-npx起動.md)、[REQ1.2 Docker 起動](../../要件定義/REQ1-ビューア起動/REQ1.2-Docker起動.md)、[REQ1.3 BASE_PATH 配信](../../要件定義/REQ1-ビューア起動/REQ1.3-BASE_PATH配信.md) が参照する環境変数を定義する。

## 環境変数一覧

| 変数 | デフォルト | 使用箇所 | 説明 |
|------|-----------|---------|------|
| `MARKSHELF_ROOT` | npx: `process.cwd()` / Docker: `/docs` | `src/lib/docs.ts` | ドキュメントのルートディレクトリ |
| `BASE_PATH` | なし | `docker-entrypoint.sh` | Docker 起動時のサブパス（`/wiki` 等） |
| `NEXT_PUBLIC_BASE_PATH` | `BASE_PATH` の転写 | `src/lib/basePath.ts`, `next.config` | クライアント側が参照する basePath（内部変換後の値） |
| `PORT` | `3000` | `bin/cli.mjs`, Dockerfile | サーバーがリッスンするポート |
| `HOSTNAME` | `0.0.0.0` | Dockerfile / standalone server | バインドアドレス |
| `NODE_ENV` | - | Next.js | ビルド／実行モード |
