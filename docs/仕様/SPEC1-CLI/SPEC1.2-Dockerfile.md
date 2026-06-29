# SPEC1.2: Dockerfile / entrypoint

[REQ1.2 — Docker 起動](../../要件定義/REQ1-ビューア起動/REQ1.2-Docker起動.md) の実装。

## 設計

- マルチステージビルド（`deps` ステージで `npm ci`、最終ステージで `next build`）
- 最終イメージは `node:20-alpine` ベースで、`git` を追加インストール（simple-git 用）
- `MARKSHELF_ROOT=/docs` を既定値に設定し、ホスト側の `docs/` をボリュームマウント or `COPY` で配置する運用を想定
- `VOLUME /docs` は**宣言しない**（下流 Dockerfile が `FROM` した後に `COPY . /docs` するケースで、親イメージの VOLUME 宣言が `COPY` を破棄してしまうため）
- エントリポイント: `docker-entrypoint.sh`
  - マウントされた `.git` をコンテナ内 root から触れるよう `git config --global --add safe.directory '*'` を流す
  - `BASE_PATH` の値を見て `next build` を必要なときだけ再実行し、スタンプファイル（`.next/markshelf-basepath`）で再ビルドの要否を判定する
  - `next build` 後に `.next/static`・`public/` を `.next/standalone/` 配下にコピーし、`node .next/standalone/server.js` で起動

## 関連用語

- standalone
