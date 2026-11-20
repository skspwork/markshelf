# 仕様

[要件](../要件定義/README.md) を具体的に「どう実装するか」を記述するレイヤ。

## 書き方

- 各仕様は `SPEC{番号}-{テーマ}/README.md` で定義し、より細かい粒度は `SPEC{番号}.{サブ番号}-*.md` に分ける
- 対応する[要件](../要件定義/README.md)へのリンクを本文の冒頭に張る（親フォルダの README だけでなく、子ファイル `SPEC*.{サブ番号}-*.md` にも張ること）
- リンクは常に上位レイヤ（仕様→要件→要求）の一方向のみ張る。双方向にするとリンクグラフが読みづらくなるため

## ドキュメントの階層

```mermaid
flowchart LR
  R["要求定義<br/>R*"] --> REQ["要件定義<br/>REQ*"] --> SPEC["仕様<br/>SPEC*"]
  SPEC -. 本文から参照 .-> G["用語集"]
  REQ -. 本文から参照 .-> G
  SPEC -- リンクは上位へ --> REQ
  REQ -- リンクは上位へ --> R
```

実線の右向き矢印は詳細化の流れ、「リンクは上位へ」の矢印が実際にリンクを張る向き。

## 全体構成

画面の各コンポーネントがどの API を呼び、API がどこからデータを読むかの対応。

```mermaid
flowchart LR
  subgraph Browser["ブラウザ (src/app/page.tsx)"]
    TreeView["TreeView"]
    SearchBar["SearchBar"]
    DetailPanel["DetailPanel"]
    PreviewPopup["PreviewPopup"]
    Markdown["Markdown / MermaidBlock"]
    LinkGraph["LinkGraph"]
    HistoryPanel["HistoryPanel"]
    DiffView["DiffView"]
    TimelinePanel["TimelinePanel"]
    Refresh["useRefreshTick"]
  end

  subgraph API["Next.js API (src/app/api)"]
    api_tree["/api/tree"]
    api_search["/api/search"]
    api_file["/api/file"]
    api_raw["/api/raw"]
    api_asset["/api/asset"]
    api_graph["/api/graph"]
    api_history["/api/history"]
    api_diff["/api/diff"]
    api_timeline["/api/timeline"]
    api_watch["/api/watch (SSE)"]
  end

  subgraph Source["データソース"]
    FS[("DOCS_ROOT<br/>ファイルシステム")]
    Git[("git リポジトリ")]
  end

  TreeView --> api_tree
  SearchBar --> api_search
  DetailPanel --> api_file
  DetailPanel --> api_raw
  PreviewPopup --> api_file
  Markdown --> api_asset
  LinkGraph --> api_graph
  HistoryPanel --> api_history
  DiffView --> api_diff
  TimelinePanel --> api_timeline
  Refresh --> api_watch

  api_tree --> FS
  api_search --> FS
  api_file --> FS
  api_raw --> FS
  api_asset --> FS
  api_graph --> FS
  api_watch --> FS
  api_history --> Git
  api_diff --> Git
  api_timeline --> Git
```
