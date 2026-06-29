# SPEC3.3: TableOfContents

[REQ3.3 — 目次](../../要件定義/REQ3-プレビューとツリー/REQ3.3-目次.md) の実装。

## 設計

- `<TableOfContents>` コンポーネント (`src/components/TableOfContents.tsx`) として実装
- 見出し抽出は `<Markdown>` 側 (`src/components/Markdown.tsx`) の `parseHeadings()` で**Markdown ソースから直接**行う。HTML から拾うのではなく、フェンスコードブロック (\`\`\` / \~\~\~) の中を明示的にスキップしてから `^(#{1,4})\s+(.+)$` にマッチさせる
- 見出し ID は `slugify(text)` で生成し、同じテキストが複数回現れる場合は `-1`, `-2` … のサフィックスで重複回避
- 表示はレベル（H1〜H4）に応じてインデント、スクロール位置に一番近い見出しを IntersectionObserver でハイライト
- 目次パネル幅は localStorage `markshelf:tocWidth` に永続化（[SPEC3.7 パネルリサイザー](SPEC3.7-パネルリサイザー.md)）
