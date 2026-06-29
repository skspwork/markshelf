# SPEC1.1: bin/cli.mjs

[REQ1.1 — npx 起動](../../要件定義/REQ1-ビューア起動/REQ1.1-npx起動.md) の実装。

## 設計

- `package.json` の `bin` フィールドに `markshelf: ./bin/cli.mjs` を登録する
- `bin/cli.mjs` は Next.js の standalone ビルド成果物を起動する
- 現在の作業ディレクトリ (cwd) をドキュメントルートとして扱う
- 起動ポートは空きポートを自動検出、標準出力にアクセス URL を表示する

## 関連

- npx
