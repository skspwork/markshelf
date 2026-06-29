# SPEC3.1: PreviewPopup

[REQ3.1 — プレビューポップアップ](../../要件定義/REQ3-プレビューとツリー/REQ3.1-プレビューポップアップ.md) の実装。

## 設計

- `<PreviewPopup>` コンポーネントとして実装 (`src/components/PreviewPopup.tsx`)
- ホバー対象のリンク要素近傍に絶対配置
- 表示遅延 (debounce) を入れ、意図しない表示を抑制
- Markdown レンダラーを再利用し、本文と同じスタイルで表示
