# デプロイ（Fly.io 自動デプロイ + Web 動作確認）

`master` に push すると、GitHub Actions が **検証 → イメージビルド → Fly.io デプロイ → 実 URL のスモークテスト** まで自動で実行します。デプロイされるのは markshelf 自身の `docs/` を焼き込んだデモサイトです。

- 公開 URL: <https://markshelf-demo.fly.dev>
- パイプライン: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
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

3. **初回デプロイ**（ワークフローを手動起動、または master へ push）:

   ```bash
   gh workflow run "Deploy demo (Fly.io)"
   ```

   以降は `master` への push で自動的に回ります。

## ローカルから手動デプロイ

```bash
fly deploy        # fly.toml の [build] から docker/Dockerfile.demo をビルド
scripts/smoke-test.sh https://markshelf-demo.fly.dev
```

## 補足

- **常時起動**: `fly.toml` は `min_machines_running = 1` / `auto_stop_machines = "off"`。SSE（`/api/watch`）の常時接続を切らないため。コストを抑えたい場合は `auto_stop_machines = "suspend"` に変更可（初回アクセスにコールドスタートが乗ります）。
- **リージョン**: `primary_region = "nrt"`（東京）。
- マージや本番反映の最終判断は人間が行う運用（[CLAUDE.md の検証ゲート](CLAUDE.md)）と矛盾しません。ここで自動化しているのは「master に入ったものをデモへ反映して実挙動を確認する」ところまでです。
