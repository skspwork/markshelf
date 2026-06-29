# SPEC5.1: localStorage キー一覧

ビューアが書き込むすべての localStorage キーを `markshelf:` プレフィックスで管理する。

## キー一覧

| キー | 保存場所 | 用途 | デフォルト | 関連要件 |
|------|---------|------|-----------|---------|
| `markshelf:treeWidth` | `src/app/page.tsx` | 左ツリーパネルの幅 (px) | `260` | [REQ3.4](../../要件定義/REQ3-プレビューとツリー/REQ3.4-パネルリサイザー.md) |
| `markshelf:tocWidth` | `src/components/DetailPanel.tsx` | 目次パネルの幅 (px) | `176` | [REQ3.4](../../要件定義/REQ3-プレビューとツリー/REQ3.4-パネルリサイザー.md) |
| `markshelf:treeExpanded` | `src/components/TreeView.tsx` | ツリーの展開状態（フォルダパスの集合） | トップレベルの README 付きフォルダを展開 | [REQ3.2](../../要件定義/REQ3-プレビューとツリー/REQ3.2-ツリービュー.md) |
| `markshelf:linkGraphDepth` | `src/components/LinkGraph.tsx` | リンクグラフで辿る深さ（1/2/3/`all`） | `1` | [REQ2.2](../../要件定義/REQ2-リンクグラフ/REQ2.2-階層切替.md) |
| `markshelf:linkGraphExclude` | `src/components/LinkGraph.tsx` | グラフから除外するフォルダ名の配列 | `[]` | [REQ2.3](../../要件定義/REQ2-リンクグラフ/REQ2.3-フォルダ除外.md) |
| `markshelf:linkGraphZoom` | `src/components/LinkGraph.tsx` | リンクグラフのズーム倍率 | （未保存時は全体フィット） | [REQ2.2](../../要件定義/REQ2-リンクグラフ/REQ2.2-階層切替.md) |

## 規約

- プレフィックスは常に `markshelf:`
- 値は文字列。数値・配列は `String(num)` / `JSON.stringify(arr)` で直列化
- キーを追加する場合は本ファイルに必ず追記する
