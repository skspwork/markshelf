---
name: release
description: markshelf の新バージョンをリリースする。npm version でバージョンを上げてタグを push し、前回タグからの変更を要約したリリースノートで GitHub Release を作成する。
argument-hint: "[patch|minor|major]"
disable-model-invocation: true
---

# release — バージョンアップと GitHub Release 作成

[RELEASING.md](../../../RELEASING.md) の通常リリース手順に、リリースノートの作成と GitHub Release の作成を加えたもの。タグを push すると npm と ghcr への配布が走り、取り消せないため、**push の前に必ずユーザーの確認を取る**。

引数: `$ARGUMENTS`（`patch` / `minor` / `major`。省略時は手順 3 で変更内容から提案する）

## 手順

1. **前提を確認する。** どれかを満たさなければ中断して理由を伝える。
   - 現在のブランチが `master`
   - `git status --porcelain` が空（未コミットの変更がない）
   - `git fetch origin` 後、`master` が `origin/master` と一致している
   - `gh auth status` でログイン済み

2. **前回からの変更を集める。**
   - 前回タグ: `git describe --tags --abbrev=0 --match 'v*.*.*'`
   - `git log --no-merges <前回タグ>..HEAD` でコミット一覧を見る。空なら「リリースする変更がない」と伝えて中断する。
   - コミットメッセージに `(#123)` があれば `gh pr view 123 --json title,body` で PR の内容を確認する。
   - 必要に応じて `git diff --stat <前回タグ>..HEAD` やソースを読み、利用者から見て何が変わったかを把握する。

3. **バージョン種別を決める。** 引数があればそれを使う。なければ変更内容から提案する（破壊的変更 → `major`、機能追加 → `minor`、修正のみ → `patch`）。0.x の間は破壊的変更も `minor` でよい。

4. **リリースノートの下書きを作る。** 書式:
   - 日本語で、markshelf の利用者向けに簡潔に書く。
   - 冒頭に 1〜2 文の要約。続けて該当する見出しだけを置く: `## 新機能` / `## 改善` / `## バグ修正` / `## 破壊的変更` / `## その他`
   - 各項目の末尾に PR 番号があれば `(#123)` を付ける。
   - バージョン番号だけのコミット（例: "0.3.2"）は載せない。CI や依存更新など利用者に影響しない変更は `## その他` にまとめるか省略する。
   - `# vX.Y.Z` の見出しやインストール手順は書かない（Release のタイトルで表示されるため）。

   下書きはスクラッチパッド（なければ OS の一時ディレクトリ）の `release-notes.md` に保存する。リポジトリ内には置かない。

5. **ユーザーに確認する。** 次の 3 点を見せて、進めてよいか尋ねる。修正を求められたら反映して再確認する。
   - 新しいバージョン（例: `0.3.2 → 0.3.3`）
   - リリースノートの全文
   - これから `npm version` → `git push --follow-tags` → `gh release create` を実行すること

6. **バージョンを上げて push する。**
   ```bash
   npm version <patch|minor|major>
   git push --follow-tags
   ```
   `npm version` が package.json の更新、コミット、`vX.Y.Z` タグの作成をまとめて行う。

7. **GitHub Release を作る。**
   ```bash
   gh release create vX.Y.Z --title vX.Y.Z --notes-file <release-notes.md のパス> --verify-tag
   ```

8. **配布ワークフローを確認する。** `gh run list --limit 5` で、タグで起動した `Publish npm package` と `Publish Docker image` の run を探し、`gh run watch <run-id> --exit-status` でそれぞれ完了を待つ。失敗したら `gh run view <run-id> --log-failed` でログを確認し、[RELEASING.md のトラブルシュート](../../../RELEASING.md#トラブルシュート)と照らして原因を報告する。

9. **結果を報告する。** Release の URL（`gh release view vX.Y.Z --json url -q .url`）と、各ワークフローの成否を伝える。
