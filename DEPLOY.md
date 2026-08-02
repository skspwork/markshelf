# デプロイ（Fly.io 自動デプロイ + Web 動作確認）

2種類の自動デプロイがあります。

| | トリガー | URL | 用途 |
|---|---|---|---|
| **本番デモ** | `master` へ push | `https://markshelf-demo.fly.dev`（固定） | マージ済みの内容を反映 |
| **PR プレビュー** | PR の open / 更新 | `https://markshelf-pr-<番号>.fly.dev`（PR 毎） | **マージ前**にブランチをレビュー。PR クローズで自動破棄 |

どちらもデプロイ後に実 URL のスモークテストが走り、失敗すればワークフローも失敗します。表示するのは markshelf 自身の `docs/` を焼き込んだサイトです。

- 本番パイプライン: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- プレビューパイプライン: [.github/workflows/preview.yml](.github/workflows/preview.yml)
- デモ用イメージ: [docker/Dockerfile.demo](docker/Dockerfile.demo)（配布用ベースイメージと違い docs/ と `.git` を焼き込み、`MARKSHELF_ROOT=/app/docs`）
- スモークテスト: [scripts/smoke-test.sh](scripts/smoke-test.sh)

## 仕組み

```
push (master) ──▶ verify (typecheck / lint / test)
                     │
                     ▼
              build docker/Dockerfile.demo ──▶ registry.fly.io へ push
                     │
                     ▼
              flyctl deploy --image ...  ──▶ Fly マシンが起動
                     │
                     ▼
              scripts/smoke-test.sh https://markshelf-demo.fly.dev
              （home 200 / /api/tree に docs / /api/timeline に git 履歴）
```

スモークテストが失敗するとワークフローも失敗するので、「push したのに壊れていた」を Web 上の実挙動で検知できます。

## 初回だけ必要な手動セットアップ

自動化できないのは Fly 側のアカウント作業とシークレット登録だけです。以下を一度だけ実施してください。

1. **Fly CLI で認証してアプリを作成**（アプリ名は `fly.toml` の `app` と一致させる）:

   ```bash
   fly auth login
   fly apps create markshelf-demo
   ```

   別名にしたい場合は `fly.toml`・`deploy.yml`・`DEPLOY.md` 内の `markshelf-demo` を置換してください。

2. **org スコープのトークンを1つ発行して登録**（本番デプロイと PR プレビューの両方がこの1つを使う。プレビューはアプリの作成/破棄を伴うため org スコープが必須）:

   ```bash
   fly orgs list                              # Fly の org スラッグを確認（例: personal / skspwork）
   # トークンを画面に出さず、そのままシークレットへパイプする
   fly tokens create org <org-slug> -x 999999h | gh secret set FLY_ORG_TOKEN

   # org スラッグが personal 以外なら GitHub の変数にも設定
   gh variable set FLY_ORG --body "<org-slug>"
   ```

   > 本番 [deploy.yml](.github/workflows/deploy.yml) も `FLY_ORG_TOKEN` を使います（flyctl は環境変数 `FLY_API_TOKEN` を読むだけなので、シークレット名は問いません）。アプリスコープの `FLY_API_TOKEN` は不要なので、あれば削除して構いません（`gh secret delete FLY_API_TOKEN`）。
   >
   > 最小権限にこだわる場合は、本番だけ `fly tokens create deploy -a markshelf-demo -x 999999h | gh secret set FLY_API_TOKEN` でアプリスコープトークンを作り、[deploy.yml](.github/workflows/deploy.yml) の `FLY_ORG_TOKEN` を `FLY_API_TOKEN` に戻してください。

3. **初回デプロイ**（ワークフローを手動起動、または master へ push）:

   ```bash
   gh workflow run "Deploy demo (Fly.io)"
   ```

   以降は `master` への push で自動的に回ります。

## PR プレビュー（マージ前レビュー）

PR を開くと [preview.yml](.github/workflows/preview.yml) が動き、そのブランチを `markshelf-pr-<番号>` という独立した Fly アプリにデプロイします。

- URL は PR に自動コメントされます（`https://markshelf-pr-<番号>.fly.dev`）。
- PR に push するたびに更新、**PR をクローズ/マージすると自動で `flyctl apps destroy`**。
- 本番と同じ demo イメージ・スモークテストを使いますが、`fly.preview.toml` で `auto_stop_machines = "suspend"` / `min_machines_running = 0` にしてあり、アイドル時は停止してコストを抑えます（初回アクセスはコールドスタート）。
- フォークからの PR はシークレットにアクセスできないため、プレビューはスキップされます（同一リポジトリのブランチのみ）。

## ローカルから手動デプロイ

```bash
fly deploy        # fly.toml の [build] から docker/Dockerfile.demo をビルド
scripts/smoke-test.sh https://markshelf-demo.fly.dev
```

## コスト管理と一時停止

Fly は**起動中マシンの実行時間**に課金します（停止中・0台なら $0。IPv6 dedicated と IPv4 shared は無料）。

- **スケールゼロ設定**: `fly.toml` は `auto_stop_machines = "stop"` / `min_machines_running = 0`。アクセスが来たときだけ起動し、アイドルで停止。無アクセスならほぼ $0。初回アクセスはコールドスタート。
- **1台のみ**: デプロイは `--ha=false`（未指定だと冗長構成で2台作られ常時課金の原因になる）。
- **SSE を常時保ちたい場合**は `auto_stop_machines = "off"` / `min_machines_running = 1` に戻す（＝常時課金）。

### 完全に止める / 再開する

```bash
# いま動いているマシンを全停止（$0。アプリ設定・URL は残る）
fly scale count 0 -a markshelf-demo

# 自動デプロイ／プレビューを止める（push でマシンが復活しないように）
gh workflow disable "Deploy demo (Fly.io)"
gh workflow disable "Preview deploy (Fly.io)"

# ---- 再開するとき ----
gh workflow enable "Deploy demo (Fly.io)"
gh workflow enable "Preview deploy (Fly.io)"
fly deploy -a markshelf-demo --ha=false     # または master へ push
```

> プレビュー環境（`markshelf-pr-<n>`）は PR クローズで自動破棄され、アイドルで suspend するので低コストですが、開いた PR に push するたび数分マシンが動きます。課金を完全に避けたい期間は上記のとおりプレビューも disable してください。

## 補足

- **リージョン**: `primary_region = "nrt"`（東京）。
- マージや本番反映の最終判断は人間が行う運用（[CLAUDE.md の検証ゲート](CLAUDE.md)）と矛盾しません。ここで自動化しているのは「master に入ったものをデモへ反映して実挙動を確認する」ところまでです。
