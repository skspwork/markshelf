# CLAUDE.md

markshelf — git リポジトリ内の Markdown を「読むため」に特化した構造化ビューア（Next.js 16 + React 19）。

## ループの記憶（最重要）

- **進捗の正は常に [loop/progress.md](loop/progress.md)。** 状態は会話ではなくこのファイルに持つ。作業の開始時に読み、区切りで更新する。
- ループが自動処理できないもの・検証役が指摘を残したものは `loop/progress.md` の **Backlog / Triage** に上げる。マージは人間のみ。

## 知識の在り処（Skills）

詳細な手順はここに書かず Skill に置く。`.claude/skills/` を参照:

- **project-conventions** — 規約・ビルド/テスト/lint コマンド・既知の落とし穴。コード変更時に必ず参照。
- **triage** — CI/issue/直近コミットを読み、対応項目を `loop/progress.md` に追記する。
- **docs-lint** / **docs-new** — `docs/` の4階層ドキュメント規約の検査・新規作成。

## サブエージェント

`.claude/agents/` に explorer（調査・読取専用）/ implementer（実装・worktree隔離）/ reviewer（厳格レビュー）。
サブエージェントは親のスキルを継承しないため、各エージェントの `skills:` で必要なものを明示している。

## worktree（並列の隔離）

- implementer は `isolation: worktree` で専用チェックアウトを持つため、並列実行しても互いのファイルを壊さない。新 worktree に必要な gitignore 済みファイルは [.worktreeinclude](.worktreeinclude) に列挙。
- 人間が別ブランチの独立セッションを開きたいときは `claude --worktree <name>`（`.claude/worktrees/` 配下に作られる。これと `settings.local.json` は gitignore 済み）。

## コネクタ（GitHub / gh CLI）

issue・PR・CI へは認証済みの `gh` CLI で接続する（MCP 不要）。リポジトリは `skspwork/markshelf`（default: master）。

- 読み取り（triage が使う）: `gh issue list` / `gh run list` / `gh run view <id> --log-failed`
- PR を開く（reviewer が APPROVE した案件のみ）:
  ```bash
  git push -u origin <branch>
  gh pr create --fill --base master --head <branch>
  ```
- 関連 issue があれば PR 本文に `Closes #<n>` を入れて更新を連動させる。
- **マージはしない。** PR 作成までが自動の上限（[Phase 6 の検証ゲート](#検証ゲート人間の最終確認)）。

## 検証コマンド（実装後は必ず実行）

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
```
