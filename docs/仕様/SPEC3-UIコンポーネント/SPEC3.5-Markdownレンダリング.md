# SPEC3.5: Markdown レンダリング

[REQ3.1 プレビューポップアップ](../../要件定義/REQ3-プレビューとツリー/REQ3.1-プレビューポップアップ.md)、[REQ3.3 目次](../../要件定義/REQ3-プレビューとツリー/REQ3.3-目次.md)、[REQ3.6 画像プレビュー](../../要件定義/REQ3-プレビューとツリー/REQ3.6-画像プレビュー.md) の基盤となる Markdown レンダリング仕様。

## 設計

- 実装: `src/components/Markdown.tsx`（`react-markdown` + `remark-gfm`）
- GitHub Flavored Markdown（テーブル・タスクリスト・打ち消し線）を有効化
- 見出しはカスタムコンポーネントに置き換え、`parseHeadings()` で採番した ID を付与（目次のアンカーと一致）
- コードブロック:
  - `language-mermaid` は `<MermaidBlock>` に差し替え（[Mermaid](../../用語集/Mermaid.md)）
  - その他は Tailwind Typography の `prose-pre` / `prose-code` スタイルで装飾
- リンク（`<a>`）:
  - 相対パスは `resolveRelativeLink()` で docs パスへ解決し、解決できたら**アプリ内ナビゲーション**扱い（`<span>` + onClick）
  - ホバー時にプレビューポップアップを表示（`onPreviewShow` / `onPreviewHide`）
  - `autolink:` プレフィックスのものも同様にアプリ内扱い
- 画像（`<img>`）:
  - 相対 src を `/api/asset?path=...` に書き換える（[SPEC3.8 画像プレビュー](SPEC3.8-画像プレビュー.md)）
  - `data:`・プロトコル相対・絶対 URL はそのまま
- 自動マッチ（autolink）:
  - 段落・リスト・セル中のテキストを対象に、2 文字以上の displayName を部分マッチ
  - マッチ箇所は破線付きリンクとしてレンダリング、ホバー／クリックは相対リンクと同挙動
