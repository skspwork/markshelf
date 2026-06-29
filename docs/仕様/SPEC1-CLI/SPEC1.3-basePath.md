# SPEC1.3: basePath 実装

[REQ1.3 — BASE_PATH 配信](../../要件定義/REQ1-ビューア起動/REQ1.3-BASE_PATH配信.md) の実装。

## 設計

- ユーザーが設定するのは `BASE_PATH` 環境変数。`docker-entrypoint.sh` が値を `NEXT_PUBLIC_BASE_PATH` に転写してから `next build` を走らせる
- Next.js の `basePath` 設定は `NEXT_PUBLIC_BASE_PATH` を読むようビルド時に反映される
- クライアント側のフェッチは `src/lib/basePath.ts` の `withBasePath()` を経由して `basePath + "/api/..."` を組み立てる
- `BASE_PATH` 未指定時は空文字に倒れ、ルート直下で動く
- `docker-entrypoint.sh` はスタンプファイル `.next/markshelf-basepath` に現在の basePath を書き、次回起動時に同じ値なら `next build` をスキップする
