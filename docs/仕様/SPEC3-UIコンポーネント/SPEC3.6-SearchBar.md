# SPEC3.6: SearchBar

[REQ5.1 — 全文検索](../../要件定義/REQ5-ファイル検索/REQ5.1-ファイル名検索.md) の実装。

## 設計

- 実装: `src/components/SearchBar.tsx`
- 左パネル上部に常設。検索語を入力すると 300ms のデバウンス後に `/api/search?q=...` ([SPEC4.3](../SPEC4-API/SPEC4.3-search.md)) を叩く
- 結果は `{ path, displayName, matches: [{ line, text }] }[]` を受け取り、ドロップダウン形式で列挙
  - ファイル displayName を上段に
  - 相対パスを小さく中段に
  - ヒットした行（最大 2 件）を `L{line}` 付きで下段に表示。マッチ部分は黄色ハイライト
- Esc キー／外側クリックでドロップダウンを閉じる
- クリアボタン（`X`）で入力を空にして通常のツリー表示に戻す
- 選択時は親の `onSelect(path)` を呼び、ファイル遷移は [REQ4.1 戻る／進む](../../要件定義/REQ4-ナビゲーション/REQ4.1-戻る進む.md) の履歴スタックに載せる
