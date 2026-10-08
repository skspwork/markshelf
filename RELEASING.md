# リリース手順

## 概要

git タグ `v*.*.*` を push すると、GitHub Actions が以下を同時配布します:

- **npm**: `markshelf@<version>`（provenance バッジ付き）
- **ghcr**: `<version>`, `<major>.<minor>`, `<major>`, `latest`

`master` への push では `latest` は更新されません（`master`, `sha-xxxx` タグだけが更新）。`latest` の更新は **タグ push 時のみ** です。

## 前提（一度だけ）

1. [npmjs.com](https://www.npmjs.com/) の Account Settings → Access Tokens → "Generate New Token" → **Automation** タイプでトークン生成
2. GitHub のリポジトリ Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Secret: 生成したトークン

## Claude Code でリリースする

Claude Code で `/release patch`（または `minor` / `major`）と打つと、[.claude/skills/release/SKILL.md](.claude/skills/release/SKILL.md) に沿って以下を行う:

1. 前回タグからの変更を読み、リリースノートの下書きを作る
2. 新バージョンとノートを見せて確認を取る
3. 下の「通常リリース」の手順 2〜4 を実行する
4. そのノートで GitHub Release を作る

`gh` CLI へのログイン（`gh auth login`）が必要。

## 通常リリース

1. `master` が出したいバージョンの状態になっているか確認
2. バージョンを上げる:
   ```bash
   npm version patch   # 0.2.0 → 0.2.1
   ```
   `npm version` は package.json の更新・コミット・`vX.Y.Z` タグ作成を一発で行う
3. コミットとタグを push:
   ```bash
   git push --follow-tags
   ```
4. GitHub Actions の `Publish npm package` と `Publish Docker image` が両方緑になることを確認

## バージョンの選び方

| コマンド | 用途 | 例 |
|---------|------|---|
| `npm version patch` | バグ修正のみ | 0.2.0 → 0.2.1 |
| `npm version minor` | 後方互換のある機能追加 | 0.2.0 → 0.3.0 |
| `npm version major` | 破壊的変更 | 0.2.0 → 1.0.0 |

## トラブルシュート

- **`Publish npm package` が "version does not match" で落ちる**
  git タグと `package.json` の version がずれている。`npm version` を使えば原理的に起きないが、手動で `git tag` した時に起きうる。
- **ghcr の `latest` が更新されない**
  master push では `latest` は更新されない仕様（[.github/workflows/docker-publish.yml:48](.github/workflows/docker-publish.yml#L48)）。`v*.*.*` 形式の git タグを push しているか確認。
- **npm publish が 401/403 で失敗**
  `NPM_TOKEN` secret が未設定か、トークンの有効期限切れ・権限不足。Automation タイプで再発行する。
- **ghcr push が失敗**
  `GITHUB_TOKEN` の `packages: write` 権限が必要。[.github/workflows/docker-publish.yml:18](.github/workflows/docker-publish.yml#L18) で付与済み。

## 関連ファイル

- [.github/workflows/npm-publish.yml](.github/workflows/npm-publish.yml) — npm 配布
- [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) — Docker イメージ配布
- [.claude/skills/release/SKILL.md](.claude/skills/release/SKILL.md) — Claude Code の `/release` スキル
- [package.json](package.json) — `version` フィールドが配布バージョンの源
