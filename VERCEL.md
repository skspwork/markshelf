# Vercel デプロイ（無料 PR プレビュー）

Vercel の Git 連携を使うと、**push するだけで自動的にプレビュー環境が無料で立ち、PR に URL がコメント**されます（本番は `master`、プレビューは各ブランチ/PR）。GitHub Actions もトークンも不要——連携は Vercel 側の1回設定だけです。

## 制約（重要）

markshelf は実行時に `git` バイナリを呼んで履歴・タイムライン・差分を生成しますが、**Vercel のサーバーレス実行環境には `git` バイナリが無い**ため、以下は Vercel 上では動きません（エラー時は空を返すのでクラッシュはしません）。

| 機能 | Vercel |
|---|---|
| ツリー / Markdown / 目次 / リンクグラフ / 検索 / プレビューポップアップ | ✅ 動く |
| 変更履歴 / タイムライン / 差分（git 由来） | ❌ 空表示 |
| 保存で自動リロード（SSE `/api/watch`） | ❌ 不可（デモでは不要） |

全機能を出したい場合は Fly（[DEPLOY.md](DEPLOY.md)）か、`git` 層を `isomorphic-git` に置き換える対応が必要です。

## コード側の対応（設定済み）

- [next.config.ts](next.config.ts): `outputFileTracingIncludes` で `docs/**` を API ルート関数へ同梱。Vercel ビルド時は `output: "standalone"` を外す（Docker 配布時のみ付与）。
- [src/lib/docs.ts](src/lib/docs.ts): Vercel 実行時は docs ルートを `process.cwd()/docs` に解決（`VERCEL` 環境変数で判定）。

このため **Vercel 側で環境変数の設定は不要**です。

## セットアップ（Vercel 側で一度だけ）

### ダッシュボードで連携（最も簡単・推奨）

1. <https://vercel.com/new> を開く
2. GitHub の `skspwork/markshelf` を Import
3. Framework Preset は **Next.js**（自動検出）。Build/Install もデフォルトのままで OK
4. **Deploy** を押す

これで完了です。以降:

- `master` へ push → 本番（`https://markshelf.vercel.app` など）を更新
- ブランチ/PR を push → **プレビュー URL が自動生成され、PR にコメント**

### CLI で連携する場合

```bash
npm i -g vercel
vercel login
vercel link          # プロジェクトに紐付け
vercel git connect   # GitHub 連携（push で自動デプロイ）
```

## Fly からの移行について

Vercel に一本化するなら、Fly 側は不要になります（現在 `markshelf-demo` は停止済み・ワークフローも無効化済み）。Vercel でプレビュー/本番が動くのを確認したら:

```bash
# Fly の本番アプリを完全削除（URL/IP も消える）
fly apps destroy markshelf-demo

# 旧 Fly 用ワークフローを削除（任意）
#   .github/workflows/deploy.yml  .github/workflows/preview.yml
```

Fly の scale-to-zero デモを残したい場合は消さなくても構いません（無アクセスならほぼ $0）。
