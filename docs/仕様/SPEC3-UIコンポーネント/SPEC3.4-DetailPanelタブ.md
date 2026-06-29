# SPEC3.4: DetailPanel タブ

[REQ3.5 — タブシステム](../../要件定義/REQ3-プレビューとツリー/REQ3.5-タブシステム.md) の実装。

## 設計

- 実装: `src/components/DetailPanel.tsx`
- タブ: `"content" | "history" | "links"`（内容／履歴／リンクグラフ）
- 内容タブ: `<Markdown>` + `<TableOfContents>` + `<PreviewPopup>`
- 履歴タブ: `<HistoryPanel>`（[SPEC4.5 /api/history](../SPEC4-API/SPEC4.5-history.md) を呼ぶ）
- リンクタブ: `<LinkGraph>`（[SPEC2.1 /api/graph](../SPEC2-グラフ描画/SPEC2.1-graph-api.md) を呼ぶ）
- ファイル切替時（親の `selectedPath` 更新）はタブ状態とプレビュー状態を初期化
- グラフ上でノードクリックしたときだけ例外的に「リンクタブ」状態を維持したままファイル切替（`<Markdown>` 側のリンククリックは強制的に内容タブへ戻す）
