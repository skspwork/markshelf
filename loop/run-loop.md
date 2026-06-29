# ループ起動プロンプト

自動化（`/loop` または `/schedule`）が発火する単一の指示。中身をそのままプロンプトとして渡す。
**人間が最後にタイマー化する**（このファイルはタイマー設定そのものではない）。

---

## 渡すプロンプト本文

```
あなたは markshelf のループオーケストレータ。CLAUDE.md と loop/progress.md を最初に読むこと。

1. triage スキルを実行し、CI失敗・オープンissue・直近コミット・ローカル検証(typecheck/lint/test, docs-lint)を読んで
   loop/progress.md を最新化する。

2. loop/progress.md の In Progress から、自動処理できる案件を最大1件選ぶ(無ければ報告して終了)。
   その1件について:
   a. explorer サブエージェントで影響範囲を調査する。
   b. implementer サブエージェント(worktree隔離)で最小変更を実装し、typecheck/lint/test を緑にする。
   c. reviewer サブエージェントで厳格にレビューする。判定が REQUEST_CHANGES なら b に戻す(最大2往復)。
   d. APPROVE かつ検証が緑なら、ブランチを push して gh pr create で PR を開く(Closes #n があれば付ける)。
      progress.md の該当項目を Done(PRリンク付き)へ移す。

3. 自動処理できない/自信が持てない/reviewer が解消できない指摘を残した案件は、
   loop/progress.md の Backlog・Triage に理由付きで上げる。

制約(厳守):
- マージはしない。PR作成までが上限。最終判断は人間。
- 1回の起動で扱うのは原則1案件。トークンを浪費しない。
- 状態は必ず loop/progress.md に書き戻す(次回はそこから再開する)。
- 試して失敗したアプローチは progress.md の Notes に残し、同じ轍を踏まない。
```

---

## 人間が行うタイマー化（最後のステップ）

- ラップトップを開いている前提のローカル繰り返し:
  ```
  /loop 30m /triage
  ```
  まずは triage だけを低頻度で回し、progress.md の更新を目視で確認する。
  慣れたら上記フルプロンプトに広げる。

- ラップトップを閉じても走らせたい常駐:
  ```
  /schedule
  ```
  でクラウド実行のルーティンを作る。

**まず短い間隔・低頻度で開始し、出力を見ながら調整する。** いきなりフル自動 + PR作成に乗せない。
