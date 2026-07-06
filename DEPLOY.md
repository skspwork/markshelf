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

2. **デプロイ用トークンを発行し、GitHub のシークレットに登録**:

   ```bash
   fly tokens create deploy -x 999999h        # 出力された FlyV1 ... トークンをコピー
   gh secret set FLY_API_TOKEN --body "<コピーしたトークン>"
   ```

   （GitHub 側で `Settings → Environments → production` を使う場合は、その環境シークレットとして登録しても可。）

3. **PR プレビュー用の org スコープトークンを登録**（プレビューはアプリの作成/破棄を伴うため、上記のアプリスコープトークンでは権限不足）:

   ```bash
   fly orgs list                              # Fly の org スラッグを確認（例: personal / skspwork）
   fly tokens create org <org-slug> -x 999999h
   gh secret set FLY_ORG_TOKEN --body "<コピーしたトークン>"

   # org スラッグが personal 以外なら GitHub の変数にも設定
   gh variable set FLY_ORG --body "<org-slug>"
   ```

4. **初回デプロイ**（ワークフローを手動起動、または master へ push）:

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

## 補足

- **常時起動**: `fly.toml` は `min_machines_running = 1` / `auto_stop_machines = "off"`。SSE（`/api/watch`）の常時接続を切らないため。コストを抑えたい場合は `auto_stop_machines = "suspend"` に変更可（初回アクセスにコールドスタートが乗ります）。
- **リージョン**: `primary_region = "nrt"`（東京）。
- マージや本番反映の最終判断は人間が行う運用（[CLAUDE.md の検証ゲート](CLAUDE.md)）と矛盾しません。ここで自動化しているのは「master に入ったものをデモへ反映して実挙動を確認する」ところまでです。
