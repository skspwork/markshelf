# SPEC3.5: Markdown レンダリング

[REQ3.1 プレビューポップアップ](../../要件定義/REQ3-プレビューとツリー/REQ3.1-プレビューポップアップ.md)、[REQ3.3 目次](../../要件定義/REQ3-プレビューとツリー/REQ3.3-目次.md)、[REQ3.6 画像プレビュー](../../要件定義/REQ3-プレビューとツリー/REQ3.6-画像プレビュー.md) の基盤となる Markdown レンダリング仕様。

## 設計

- 実装: `src/components/Markdown.tsx`（`react-markdown` + `remark-gfm`）
- GitHub Flavored Markdown（テーブル・タスクリスト・打ち消し線）を有効化
- 見出しはカスタムコンポーネントに置き換え、`src/lib/markdown.ts` の `parseHeadings()` で採番した ID を付与（目次のアンカーと一致。[SPEC3.3 TableOfContents](SPEC3.3-TableOfContents.md)）
  - `enableHeadingLinks`（本文表示のみ true、プレビューポップアップは false）のとき、見出しにホバーで現れるリンクアンカー `<HeadingAnchor>` を付ける
  - アンカークリックで `location.hash` を当該見出し ID に更新（`history.replaceState`）し、`?file=...#見出しID` 形式の共有 URL をクリップボードにコピー（コピー後は一時的にチェックアイコンを表示）。共有 URL の初期表示スクロールは [SPEC5.2 URL クエリ](../SPEC5-永続化/SPEC5.2-URLクエリ.md) を参照
  - スクロール到達時に上端へ張り付かないよう `scroll-mt-4` を付与
- コードブロック:
  - `language-mermaid` は `<MermaidBlock>` に差し替え（[Mermaid](../../用語集/Mermaid.md)）
  - その他は Tailwind Typography の `prose-pre` / `prose-code` スタイルで装飾
  - Markdown を入れ子で埋め込む場合は CommonMark どおり**外側のフェンスを内側より長く**する（例: 外側 \`\`\`\`、内側 \`\`\`）。同じ長さで入れ子にしたソースは仕様上その時点でブロックが閉じるため、レンダリング結果も途中で切れる
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
