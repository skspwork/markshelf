# SPEC2.1: graph API

[REQ2.1 — グラフ描画](../../要件定義/REQ2-リンクグラフ/REQ2.1-グラフ描画.md) のためのバックエンド API。

## 設計

- エンドポイント: `GET /api/graph`
- 全 Markdown ファイルを走査し、ノードとエッジを返す
- レスポンス
  ```json
  {
    "nodes": [{ "id": "path/to/file.md", "label": "file" }],
    "edges": [{ "source": "a.md", "target": "b.md" }]
  }
  ```
- フロントは選択中ドキュメントを中心に絞り込んで描画する
