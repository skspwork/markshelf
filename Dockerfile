# syntax=docker/dockerfile:1.6

# --- 依存インストール専用ステージ ---
# package.json / package-lock.json が変わらない限り、ここはキャッシュが
# 再利用される（重い `npm ci` をソース変更のたびに流さないため）
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- ランタイム兼ビルドステージ ---
# deps から node_modules を受け取り、ソースを入れて Next.js のデフォルト
# ビルド（basePath なし）まで済ませたうえで、起動用イメージとして仕上げる
FROM node:22-alpine
WORKDIR /app

# git は simple-git（変更履歴・タイムライン）が必要とする
RUN apk add --no-cache git

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MARKSHELF_ROOT=/docs

# 依存をまず入れてからソースを重ねる。こうすると
# 「ソースだけ変更」のビルドで node_modules 層が使い回される
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# basePath 未設定のデフォルトビルドをあらかじめ済ませておく。
# 起動時の docker-entrypoint.sh はスタンプファイルを見て、同じ basePath
# なら再ビルドをスキップする設計（= ユーザーが BASE_PATH を指定した
# 場合だけコンテナ内で `next build` が追加で走る）
RUN npx next build \
    && mkdir -p .next/standalone/.next \
    && cp -r .next/static .next/standalone/.next/static \
    && if [ -d public ]; then cp -r public .next/standalone/public; fi \
    && printf '__none__' > .next/markshelf-basepath

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# `VOLUME /docs` は意図的に宣言していない。
# 下流の Dockerfile が `FROM markshelf-base` で `COPY . /docs` した場合、
# 親で VOLUME 宣言されていると Docker のレイヤールールによって
# そのコピーが破棄されるため
LABEL org.opencontainers.image.title="markshelf" \
      org.opencontainers.image.description="Structured markdown viewer for git repositories" \
      org.opencontainers.image.source="https://github.com/skspwork/markshelf" \
      org.opencontainers.image.licenses="MIT"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
