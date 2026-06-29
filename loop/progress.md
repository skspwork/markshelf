# Loop Progress

_最終更新: 2026-06-29 (triage 実行)_

> このファイルがループの**唯一の正**。会話コンテキストではなくここに状態を持つ
> （モデルは実行間で忘れるため）。triage スキルが追記し、各サブエージェントが更新する。

## In Progress
<!-- 対応中の案件。`- [ ] 概要 (worktree/ブランチ名)` で書く -->
- [ ] src/lib/docs.ts の純粋関数（順序プレフィックス除去・ソート順・ツリー走査）に Vitest 単体テストを追加（未着手 / ブランチ未定）

## Done (直近)
<!-- 完了した案件と PR リンク。`- [x] 概要 (#PR番号)` -->
- [x] ループ環境構築（記憶/Skills/サブエージェント/worktree/コネクタ/検証ゲート）— ブランチ chore/loop-engineering

## Backlog / Triage（人間の判断待ち）
<!-- ループが自動処理できなかった・検証役が指摘を残した・自信が持てなかったもの。
     人間がここを見て判断する。 -->
- **CI 失敗**: 「Dependabot Updates」が dompurify の更新で繰り返し失敗（最新 run 28349102259 ほか）。dompurify は直接依存ではなく推移的依存（mermaid 経由の可能性）。Dependabot が推移的依存を直接上げられず失敗していると見られる。対処方針（mermaid 側のバージョン更新 / package.json の overrides 追加 / Dependabot 設定見直し）は人間の判断が必要。
- **lint warning 19件**（react-hooks/set-state-in-effect ほか、@next/next/no-img-element）。退行検知のため warn 化済みだが、段階的に解消するか方針判断が必要。`next/image` への移行は描画仕様への影響があるため要検討。

## Notes
<!-- 試したが失敗したアプローチ。同じ轍を踏まないための記憶。 -->
- ESLint は eslint-config-next + FlatCompat が ESLint 9 で循環参照クラッシュするため不採用。typescript-eslint のネイティブ flat config + @next/eslint-plugin-next + eslint-plugin-react-hooks に切り替えて解決済み。
- 検証 hook（.claude/settings.json の SubagentStop, matcher:implementer）はユーザー承認のうえ適用済み。implementer 完了時に typecheck/lint/test を決定的に実行する。
- カスタムサブエージェント（explorer/implementer/reviewer）はセッション開始時ロードのため、定義直後の同一セッションでは名前解決できない。Claude Code 再起動後 or ループの新規セッションで有効。
