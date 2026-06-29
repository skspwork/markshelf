# ループ環境 構築指示書(Claude Code 向け)

> Addy Osmani "Loop Engineering" の5要素+記憶を、このリポジトリに段階的に実装するための指示書です。
> Claude Code はこのドキュメントを上から順に実行してください。

---

## 0. 進め方(最重要・必読)

- **フェーズ0 → 6 の順に実装する。** 飛ばさない。
- 各フェーズには「受け入れ基準」がある。**それを満たすまで次のフェーズに進まない。**
- **自動化(フェーズ5)は最後。** それ以前に、ループ一周を **人間が手動で1回実行して動くこと** を必ず確認する。動かないものをタイマーに乗せると、無人で間違い続けるループになる。
- 各フェーズの成果物は、そのフェーズ完了時にコミットする(コミットメッセージ例:`chore(loop): phase 1 skills`)。
- 不明点や判断が必要な箇所は、勝手に推測で埋めず、いったん停止して人間に確認する。

---

## 1. 前提情報(ユーザーが記入してから着手)

Claude Code は、以下が空欄(`{{...}}`)のままなら **そのフェーズで人間に質問してから** 進めること。

| 項目 | 値 |
| --- | --- |
| 対象リポジトリ | `{{repo path}}` |
| 言語 / スタック | `{{e.g. TypeScript / Node, Python, Go ...}}` |
| 依存インストール | `{{e.g. pnpm install}}` |
| ビルドコマンド | `{{e.g. pnpm build}}` |
| テストコマンド | `{{e.g. pnpm test}}` |
| Lint / 型チェック | `{{e.g. pnpm lint && pnpm typecheck}}` |
| Issue 管理 | `{{GitHub Issues / Linear / その他}}` |
| 通知先(任意) | `{{Slack #channel / なし}}` |
| 既定モデル方針 | 実装役=Sonnet、検証役=Opus(高コスト時はSonnetに下げる) |

---

## 2. 完成形(このループが目指す姿)

朝の自動化がトリアージSkillを呼ぶ → CI失敗・オープンissue・直近コミットを読み、進捗ファイルに「やるべきこと」を書き出す → 各案件ごとに隔離worktreeを開く → 実装サブエージェントが下書き → 検証サブエージェントがSkillと既存テストに照らしてレビュー → コネクタがPRを開き、issue/チケットを更新 → ループが扱えないものはトリアージとして人間に上げる → 進捗ファイルが「何を試したか・何が通ったか・何が未着手か」を記憶するので、翌朝は続きから再開できる。

---

## 3. 全フェーズ共通ルール(ガードレール)

1. **検証は人間に残す。** 検証サブエージェントの "done" は主張であって証明ではない。最終的なマージ可否の判断を自動化しない。
2. **トークンコストを意識する。** サブエージェントは各自がモデル・ツールを回すため消費が増える。「第二の意見に金を払う価値がある場所」にだけ検証役を使う。
3. **記憶はディスク上に置く。** 会話コンテキストではなくファイルに状態を持つ(モデルは実行間で忘れるため)。
4. **`.claude/` はリポジトリにコミットする。** ただし `.claude/settings.local.json` と worktree ローカル設定は `.gitignore` に入れる。

---

## フェーズ0:記憶(state)を作る ― ループの背骨

**目的:** 実行と実行のあいだで状態を保持する場所を用意する。

**やること:**
1. リポジトリ直下に進捗ファイル `loop/progress.md` を作成する。テンプレート:
   ```markdown
   # Loop Progress

   _最終更新: {自動更新}_

   ## In Progress
   - [ ] (案件、対応中のworktree/ブランチ名)

   ## Done (直近)
   - [x] (完了した案件と PR リンク)

   ## Backlog / Triage(人間の判断待ち)
   - (ループが自動処理できなかったもの)

   ## Notes
   - (試したが失敗したアプローチ。再試行を防ぐため)
   ```
2. リポジトリ直下に `AGENTS.md`(または既存の `CLAUDE.md`)を確認・整備し、「進捗の正は常に `loop/progress.md`」と明記する。
3. `AGENTS.md` は冗長にしない。各行について「これを消したらエージェントは間違えるか?」を自問し、Noなら消す。詳細な知識は次フェーズのSkillへ移す。

**受け入れ基準:** `loop/progress.md` が存在し、4セクションを持つ。`AGENTS.md` が進捗ファイルの場所を参照している。

---

## フェーズ1:Skills でプロジェクト知識を外部化

**目的:** 毎セッション同じ説明を繰り返さないよう、プロジェクト固有の知識を `SKILL.md` に書き出す。

**やること:**
1. 最低2つのスキルを `skills/<name>/SKILL.md` のディレクトリ構造で作る。
   - `skills/project-conventions/SKILL.md` … コーディング規約、ディレクトリ構造、ビルド/テスト/lintコマンド、「過去の事故由来でこうしている」という暗黙知。
   - `skills/triage/SKILL.md` … 後でフェーズ5の自動化が呼ぶ。CI失敗・オープンissue・直近コミットを読み、対応すべき項目を `loop/progress.md` に追記する手順を記述。
2. 各 `SKILL.md` のフロントマター `description` は **地味で正確に** 書く(凝った表現より自動発火の精度が上がる)。
   ```markdown
   ---
   name: project-conventions
   description: このリポジトリの規約・ビルド/テスト手順・既知の落とし穴。コード変更時に参照する。
   ---
   ```

**受け入れ基準:** 2つの `SKILL.md` が存在し、ビルド/テスト/lint の正しいコマンド(前提情報の値)が `project-conventions` に書かれている。

---

## フェーズ2:サブエージェント(作る人/チェックする人の分離)

**目的:** コードを書いたモデルは自分の答えに甘いので、別指示の検証役を立てる。

**やること:**
1. `.claude/agents/` に3つのサブエージェントを Markdown+YAMLフロントマターで作る。
2. **探索役** `.claude/agents/explorer.md`(読み取り専用・高速):
   ```yaml
   ---
   name: explorer
   description: 着手前にコードベースを調査し、影響範囲と関連ファイルを要約する。読み取り専用。
   tools: Read, Grep, Glob
   model: sonnet
   ---
   関連コードを調査し、変更案の影響範囲・既存テスト・注意点を簡潔に要約する。コードは書かない。
   ```
3. **実装役** `.claude/agents/implementer.md`:
   ```yaml
   ---
   name: implementer
   description: spec に沿って最小の変更で実装し、テストを通す。
   tools: Read, Edit, Write, Bash, Grep, Glob
   model: sonnet
   skills:
     - project-conventions
   ---
   project-conventions に従って実装する。変更後は必ずテストとlintを実行し、結果を報告する。
   ```
4. **検証役** `.claude/agents/reviewer.md`(別モデル推奨):
   ```yaml
   ---
   name: reviewer
   description: 変更後に必ず使う。spec・既存テスト・規約に照らして厳しくレビューする。
   tools: Read, Grep, Glob, Bash
   model: opus
   skills:
     - project-conventions
   ---
   あなたはシニアレビュアー。実装役の変更を spec と既存テストに照らして検証する。
   自分が書いたコードではない前提で、甘く採点しない。問題点を具体的に列挙する。
   ```
5. **注意:** サブエージェントは親のスキルを継承しない。必要なスキルは各エージェントの `skills:` で明示的にプリロードすること。

**受け入れ基準:** 3エージェントが `.claude/agents/` に存在。実装役→検証役の順で1件の小さな変更を手動で通し、検証役が実際に指摘を返すことを確認できる。

---

## フェーズ3:worktree で並列を衝突させない

**目的:** 複数エージェントが同じファイルに同時に触れて壊すのを防ぐ。

**やること:**
1. コードを書くサブエージェント(`implementer`)のフロントマターに `isolation: worktree` を追加する。これで各実行が専用チェックアウトを持ち、変更がなければ自動で後片付けされる。
   ```yaml
   isolation: worktree
   ```
2. リポジトリ直下に `.worktreeinclude` を作り、gitignore済みだが新worktreeに必要なファイル(`.env`, `.env.local` 等)を列挙する(`.gitignore` 構文)。
3. 人間向けメモを `AGENTS.md` に追記:context-switch が必要なときは `claude --worktree <name>` で別ブランチの独立セッションを開ける(`.claude/worktrees/` 配下に作られる)。

**受け入れ基準:** `implementer` に `isolation: worktree` が付き、`.worktreeinclude` が存在する。並列で2件流しても互いのチェックアウトに影響しないことを確認。

---

## フェーズ4:MCP/コネクタで実ツールに接続

**目的:** ファイルシステム以外(issue・PR・通知)にもループが手を伸ばせるようにする。

**やること:**
1. 前提情報の「Issue 管理」に応じて MCP コネクタを設定する。
   - GitHub Issues/PR を使う場合:GitHub 連携(PR作成・issue更新)。
   - Linear を使う場合:Linear MCP を接続し、`loop/progress.md` の代わり/併用としてボードを記憶に使えるようにする。
2. 通知先がある場合は Slack 等の MCP を接続し、「CIが緑になったら指定チャンネルに通知」できる状態にする。
3. 接続後、最小の動作確認(例:テスト用issueを1件読む)を行い、認証が通っていることを確かめる。
4. 必要なら、ここまでのスキル+コネクタを `/plugin` でまとめてチームに配布できる形にする(任意)。

**受け入れ基準:** 少なくとも issue/PR 系コネクタが接続され、読み取り1件の動作確認が取れている。

---

## フェーズ5:自動化(心臓)を起動 ― ここで初めてタイマー化

**目的:** 手動で一周回せることを確認したうえで、定期実行に乗せる。

**Claude Code(あなた)がやること:**
1. フェーズ1の `triage` スキルが完成し、単体で正しく `loop/progress.md` を更新できることを再確認する。
2. 検証を確実に走らせる hook を `.claude/settings.json` に用意する。
   - `SubagentStop` で検証役の完了時にテスト/lintを必ず実行(プロンプト解釈に頼らず決定的に効かせる)。
   - 例:`PostToolUse` で `Write|Edit` 後に自動フォーマット。
   ```json
   {
     "hooks": {
       "PostToolUse": [
         { "matcher": "Write|Edit",
           "hooks": [{ "type": "command", "command": "{{format command}} || true" }] }
       ]
     }
   }
   ```
3. 自動化が呼ぶ起動プロンプト(triageスキルを発火し、案件ごとに explorer→implementer→reviewer を回す指示)を1つにまとめておく。

**人間(ユーザー)が最後に実行すること:**
- ラップトップを開いている前提のローカル繰り返し:`/loop` を使う(ローカルで最大3日まで繰り返しスケジュールできる)。例:`/loop 30m /triage`。
- ラップトップを閉じても走らせたい常駐ジョブ:`/schedule` を使う(クラウドで実行され続ける)。
- まずは短い間隔・低頻度で開始し、出力を見ながら間隔を調整する。

**受け入れ基準:** triageスキルを手動発火 → 1案件が explorer→implementer→reviewer→PR まで自動で流れることを確認。その後に `/loop` または `/schedule` を設定する。

---

## フェーズ6:検証ゲート(常設・省略不可)

**目的:** 無人で回るループは無人で間違うループでもある。人間の最終確認を制度として残す。

**やること:**
1. ループが自動マージしない設計にする。PR作成までは自動、マージは人間。
2. ループが自信を持てなかった/検証役が指摘を残した案件は、必ず `loop/progress.md` の **Triage** セクションに上げる。
3. 週次で `git worktree prune` 相当の後片付けと、`AGENTS.md`/スキルの陳腐化レビューを行う(古い指示は無害ではなく有害)。

**受け入れ基準:** マージは人間操作でのみ起きる。Triage に上がった項目が人間に見える形で残る。

---

## 4. 完了チェックリスト

- [ ] `loop/progress.md`(記憶)が機能している
- [ ] `skills/` に最低2スキル(`project-conventions`, `triage`)
- [ ] `.claude/agents/` に explorer / implementer / reviewer
- [ ] `implementer` が `isolation: worktree`、`.worktreeinclude` あり
- [ ] issue/PR コネクタ接続・動作確認済み
- [ ] 検証 hook が `.claude/settings.json` に設定済み
- [ ] **手動で1周(triage→実装→検証→PR)が通った**
- [ ] その後に `/loop` または `/schedule` を設定
- [ ] マージは人間のみ、Triage が人間に見える

---

## 補足:この指示書のスコープ外(人間の判断)

- どの案件をループに任せ、どれを直接プロンプトするかの線引き。
- トークン予算の上限設定と監視。
- ループが生んだコードを読み、理解の負債(comprehension debt)を溜めないこと。
