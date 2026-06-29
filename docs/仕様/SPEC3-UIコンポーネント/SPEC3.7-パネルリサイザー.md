# SPEC3.7: パネルリサイザー

[REQ3.4 — パネルリサイザー](../../要件定義/REQ3-プレビューとツリー/REQ3.4-パネルリサイザー.md) の実装。

## 設計

- 左ツリーと DetailPanel の間、DetailPanel 内本文と目次の間にドラッグハンドルを置く
- ツリー幅は `src/app/page.tsx` が `treeWidth` ステートで管理し、`localStorage['markshelf:treeWidth']`（デフォルト 260px）に永続化
- 目次幅は `src/components/DetailPanel.tsx` が管理し、`localStorage['markshelf:tocWidth']`（デフォルト 176px）に永続化
- ドラッグ中は `document` の `mousemove`/`mouseup` を監視してリアルタイムに幅を更新、終端で localStorage に書き込む
- 最小値・最大値でクランプして極端なレイアウト崩れを防ぐ
