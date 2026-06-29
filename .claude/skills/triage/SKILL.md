---
name: triage
description: CI の失敗・オープン issue・直近コミットを読み、対応すべき項目を loop/progress.md に追記する。ループの起点。朝の自動化や手動の棚卸しで使う。
---

# triage — やるべきことの洗い出し

ループの入口。外部状態（CI・issue・最近の変更）を読み、**対応項目を [loop/progress.md](../../../loop/progress.md) に追記する**だけのスキル。ここでコードは書かない。判断材料を集めて記憶ファイルに落とすことに徹する。

GitHub 連携は認証済みの `gh` CLI を使う（MCP 不要）。

## 手順

### 1. 現状を読む

```bash
# 直近の CI 実行（失敗を優先的に拾う）
gh run list --limit 10
# 失敗があれば詳細ログを確認
gh run view <run-id> --log-failed

# オープン issue（古い順 / ラベル付きを把握）
gh issue list --state open --limit 30

# 直近コミット（何が最近動いたか）
git log --oneline -15
```

ローカルの健全性も確認する（CI が無い／緑でもローカルで割れることがある）:

```bash
npm run typecheck && npm run lint && npm test
node .claude/skills/docs-lint/lint-docs.mjs
```

### 2. 既存の進捗と突き合わせる

[loop/progress.md](../../../loop/progress.md) を読み、**すでに In Progress / Done / Notes にある項目は重複登録しない**。Notes に「試して失敗した」と書かれているアプローチは再提案しない。

### 3. progress.md に追記する

各項目を以下の基準で振り分けて書き込む（既存の4セクション構造を保つ）:

- **明確で小さく自動処理できるもの** → `In Progress` に `- [ ] 概要 (ブランチ名未定)` で追加。1項目1行、何をどう直すかが分かる粒度にする。
- **判断・設計・優先度が要るもの、ループが安全に扱えないもの** → `Backlog / Triage（人間の判断待ち）` に理由付きで追加。
- CI 失敗の原因が分かれば、その要約を該当項目に添える。

`_最終更新:_` 行を今日の日付に更新する。

### 4. 出力

何件を In Progress に、何件を Triage に振ったかを短く報告する。**自動で実装には進まない**（実装はループ本体が項目ごとに explorer→implementer→reviewer を回す）。

## 原則

- triage の仕事は「記憶を最新化する」こと。コード変更・PR 作成はしない。
- 拾えなかった/判断に迷ったものは握りつぶさず必ず Triage セクションに上げる（無人ループでも人間に見える形で残す）。
- gh が未認証・ネットワーク不通なら、その旨を progress.md の Notes に記録し、ローカル検証分だけで続行する。
