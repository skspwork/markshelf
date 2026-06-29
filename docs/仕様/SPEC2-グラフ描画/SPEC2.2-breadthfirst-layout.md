# SPEC2.2: breadthfirst レイアウト

[REQ2.1](../../要件定義/REQ2-リンクグラフ/REQ2.1-グラフ描画.md) と [REQ2.2 — 階層切替](../../要件定義/REQ2-リンクグラフ/REQ2.2-階層切替.md) の描画仕様。

## 設計

- Cytoscape の breadthfirst レイアウトを `directed: true` で使用
- roots は「入次数 0 のノード」を選定し、これにより上から下への流れに統一
- 無向 BFS で選択中ノードからの深さを制限して表示ノードを絞り込む
- 表示階層選択値は `localStorage['markshelf:linkGraphDepth']` に保存
