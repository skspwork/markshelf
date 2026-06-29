# Loop Progress

_最終更新: 2026-06-29 (triage 3回目)_

> このファイルがループの**唯一の正**。会話コンテキストではなくここに状態を持つ
> （モデルは実行間で忘れるため）。triage スキルが追記し、各サブエージェントが更新する。

## In Progress
<!-- 対応中の案件。`- [ ] 概要 (worktree/ブランチ名)` で書く -->
- (なし)

## Done (直近)
<!-- 完了した案件と PR リンク。`- [x] 概要 (#PR番号)` -->
- [x] src/lib/docs.ts の純粋関数（flattenTree / sortByPrefix / stripOrderPrefix）に Vitest 単体テスト22件を追加 — ブランチ test/docs-lib-units、reviewer APPROVE、ゲート緑。PR は人間承認待ち
- [x] ループ環境構築（記憶/Skills/サブエージェント/worktree/コネクタ/検証ゲート）— PR #6 として master にマージ済み
- [x] origin/master の取り込み（next 16.2.4→16.2.6 / package-lock 再生成）— マージコミット c6e9207

## Backlog / Triage（人間の判断待ち）
<!-- ループが自動処理できなかった・検証役が指摘を残した・自信が持てなかったもの。
     人間がここを見て判断する。 -->
- **CI 失敗（dompurify, 低優先）**: 「Dependabot Updates」の dompurify 更新が `security_update_not_needed` で失敗（run 28370968542）。これは dompurify が既に patched 版（3.4.11, PR #5 でマージ済み）であることが原因の **no-op 失敗**で、コード側に対処は不要。Dependabot のセキュリティ更新ジョブが「既に対策済み」を error 扱いするだけ。実害なし。気になるなら Dependabot のセキュリティ更新設定を見直すか放置で可。
- **CI 失敗 / セキュリティ勧告（postcss）**: postcss にセキュリティ勧告。patch 版は存在するが、Dependabot が辿れる唯一の更新経路が **next を 16.2.6 → 9.3.3 にダウングレード**するため `fix_available: false` で自動修正不可（run 28370968454）。postcss は next 経由の推移的依存。対処は人間の判断が必要（next の更新待ち / postcss の overrides 追加 / 勧告の影響評価）。
- **lint warning 19件**（react-hooks/set-state-in-effect ほか、@next/next/no-img-element）。退行検知のため warn 化済みだが、段階的に解消するか方針判断が必要。`next/image` への移行は描画仕様への影響があるため要検討。
- **機能要望（issue #7）**: ページ共有時に Markdown のヘッダー単位でもリンクをコピーできるようにしたい。アンカー ID 採番（日本語見出しのスラッグ化・重複回避）、UI（見出しホバーでリンクアイコン）、URL 設計（`#heading` フラグメント）など仕様検討が必要。設計判断を要するため実装前に方針整理が必要。
- **CI ハング疑い（Docker publish, 低優先）**: PR #3 マージ起因の「Publish Docker image」run 28370961313（build-and-push）が26分超 in_progress（通常〜8分）。同 master HEAD に対する PR #6 の publish は成功済みのため本 run は実質冗長。人間が GitHub Actions 上でキャンセル/再実行を判断（自動操作はしない）。

## Notes
<!-- 試したが失敗したアプローチ。同じ轍を踏まないための記憶。 -->
- ESLint は eslint-config-next + FlatCompat が ESLint 9 で循環参照クラッシュするため不採用。typescript-eslint のネイティブ flat config + @next/eslint-plugin-next + eslint-plugin-react-hooks に切り替えて解決済み。
- 検証 hook（.claude/settings.json の SubagentStop, matcher:implementer）はユーザー承認のうえ適用済み。implementer 完了時に typecheck/lint/test を決定的に実行する。
- カスタムサブエージェント（explorer/implementer/reviewer）はセッション開始時ロードのため、定義直後の同一セッションでは名前解決できない。Claude Code 再起動後 or ループの新規セッションで有効。
- **worktree のベース選定に注意**: implementer の worktree（isolation:worktree）が現在ブランチ HEAD ではなく古い共通祖先（af155be、検証ツール導入前）から作られ、worktree 内に eslint/vitest/test スクリプトが無く検証ゲートが走らなかった。実装コード自体は有効だったため、成果物（docs.ts / docs.test.ts）を検証ツールのある作業ブランチへ取り込んでゲートを回した。オーケストレータは worktree 成果を取り込む際、ベース差分に注意し作業ブランチ側で再検証すること。
