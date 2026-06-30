---
name: run-loop
description: markshelf のループを一周回す。triage で記憶を更新し、loop/progress.md の In Progress から案件を1件選んで explorer→implementer→reviewer→PR まで進める。手動でも /loop の定期実行からでも起動する（例: /loop 30m /run-loop）。
---

# run-loop — ループ一周の実行

これがループ本体。`triage` が更新した記憶をもとに、案件を1件だけ前に進める。**毎回フルプロンプトを貼る代わりにこのスキルを呼ぶ。** 定期実行は `/loop 30m /run-loop`。

最初に [CLAUDE.md](../../../CLAUDE.md) と [loop/progress.md](../../../loop/progress.md) を読むこと。状態の正は progress.md。

## 手順

### 1. 記憶を更新（triage）
[triage](../triage/SKILL.md) スキルを実行し、CI失敗・オープンissue・直近コミット・ローカル検証（typecheck/lint/test, docs-lint）を読んで `loop/progress.md` を最新化する。

### 2. 案件を1件選ぶ
`loop/progress.md` の **In Progress** から、自動処理できる案件を**最大1件**選ぶ。
- In Progress が空、または自動処理できるものが無ければ、その旨を報告して**終了**（無理に実装しない）。
- **Backlog / Triage からは選ばない。** あそこは設計判断が要る案件の置き場で、人間が In Progress に上げて初めて着手対象になる。

### 3. explorer で調査
`explorer` サブエージェントに案件を渡し、影響範囲・関連ファイル・既存テスト・踏襲パターン・注意点を調べさせる（読み取り専用）。

### 4. implementer で実装（worktree隔離）
`explorer` の結果を仕様として `implementer` サブエージェントに実装させる。`implementer` は worktree 隔離で動く。

> **worktree のベース差分に注意（既知の落とし穴）**: implementer の worktree が現在の作業ブランチ HEAD ではなく古い共通祖先から作られることがある。その場合 worktree 内に検証ツール（eslint/vitest）が無くゲートが走らない。implementer の成果（変更ファイル）を**作業ブランチに取り込んでから、作業ブランチ側で必ず検証を再実行する**こと。

### 5. 検証ゲート
作業ブランチで以下をすべて緑にする（lint は **error 0**）:
```bash
npm run typecheck && npm run lint && npm test
```
docs を触ったなら `node .claude/skills/docs-lint/lint-docs.mjs` も。緑でなければ implementer に戻す。

### 6. reviewer でレビュー
`reviewer` サブエージェントに変更をレビューさせる。
- 判定が **REQUEST_CHANGES** なら implementer に戻す（**最大2往復**）。2往復で解決しなければ Backlog / Triage に上げて終了。
- 判定が **APPROVE** かつゲート緑なら次へ。

### 7. PR を作成（マージはしない）
```bash
git push -u origin <branch>
gh pr create --base master --fill   # 関連 issue があれば本文に Closes #<n>
```
`loop/progress.md` の該当項目を **Done** に移し、PR 番号を添える。

### 8. 報告
扱った案件・判定・PR リンク、または「着手対象なしで終了」を短く報告する。

## 鉄則（厳守）
- **マージしない。** PR 作成までが上限。最終判断は人間（[CLAUDE.md の検証ゲート](../../../CLAUDE.md)）。
- **1回の起動で1案件。** トークンを浪費しない。
- **状態は必ず `loop/progress.md` に書き戻す。** 次回はそこから再開する。
- 試して失敗したアプローチは progress.md の **Notes** に残し、同じ轍を踏まない。
- reviewer の "done" は主張であって証明ではない。自信が持てない案件は Backlog / Triage に上げる。
