---
name: project-conventions
description: markshelf リポジトリの規約・ディレクトリ構成・ビルド/テスト/lint コマンド・既知の落とし穴。コードやドキュメントを変更する前に必ず参照する。
---

# markshelf プロジェクト規約

git リポジトリ内の Markdown を「読むため」に特化した構造化ビューア。Next.js 16（App Router）+ React 19 + TypeScript。

## 検証コマンド（コード変更後は必ず全部走らせる）

```bash
npm run typecheck   # tsc --noEmit（型）
npm run lint        # eslint（0 errors を維持。warn は許容だが増やさない）
npm test            # vitest run（src/**/*.test.ts）
```

- **3つすべてが緑でなければ "done" としない。** lint は warning 0 ではなく **error 0** が基準。
- 重い最終確認が要るときのみ `npm run build`（`next build` + `scripts/pack-static.mjs` で standalone を public 同梱）。
- パッケージ追加時は `npm install -D <pkg>`。lock ファイルもコミットする。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `src/app/` | App Router。`page.tsx`／`layout.tsx`／`api/*/route.ts`（各 API 1 ハンドラ） |
| `src/components/` | クライアント UI（TreeView, LinkGraph, PreviewPopup, Markdown ほか） |
| `src/lib/` | 純粋ロジック（`docs.ts` ツリー走査・`links.ts` リンクグラフ・`git.ts` simple-git ラッパ）。**ここは副作用が薄くテストしやすい。新規ロジックは可能な限り lib に置きテストを書く** |
| `bin/cli.mjs` | `npx markshelf` のエントリ（Node ESM、TS ではない） |
| `scripts/` | ビルド補助（`pack-static.mjs` ほか）。lint 対象外 |
| `docs/` | 自己文書化（4階層）。下記参照 |
| `loop/progress.md` | ループの状態の正。作業の開始時に読み、区切りで更新する |

## コーディング規約

- TypeScript strict 前提。`any` を避け、未定義参照は型で潰す（ESLint の `no-undef` は TS が担保するため無効化済み）。
- API ルートは JSON 主体（`/api/asset`・`/api/watch` を除く）、エラー時は `{ error: string }` と適切な HTTP ステータス。
- パス受け取り系 API は **パストラバーサル防止**を必ず入れる（`path.resolve()` 後に `DOCS_ROOT` prefix チェック。既存の `/api/file` 参照）。
- localStorage キーは `markshelf:` プレフィックスで統一（[docs/仕様/SPEC5-永続化/SPEC5.1-localStorage.md](../../../docs/仕様/SPEC5-永続化/SPEC5.1-localStorage.md)）。
- React: 既存に `useEffect` 内 setState の箇所があり react-hooks v6 で warn になっている。**新規コードでは effect 内同期 setState を増やさない**（warn を error に昇格させる方針）。

## ドキュメント（docs/）の鉄則

- 4階層: 要求定義(R) → 要件定義(REQ) → 仕様(SPEC) ＋ 用語集。**リンクは常に下位→上位の一方向のみ**。
- `docs/` を触ったら必ず `node .claude/skills/docs-lint/lint-docs.mjs` を走らせ error 0 を確認（[docs-lint](../docs-lint/SKILL.md)）。新規作成は [docs-new](../docs-new/SKILL.md)。
- **既知の事故**: SPEC 個別ファイルから要件定義へのリンクは `../../要件定義/`。`../../../` は docs ルートを突き抜け、ビューアでは動くが IDE・GitHub・実FSでリンク切れになる（過去に36件混入し修正済み）。docs-lint の `escapes-root` がこれを検出する。

## 環境・運用の落とし穴

- OS は Windows / シェルは PowerShell。POSIX スクリプトが要るときは Bash ツールを使う。
- dev サーバは `MARKSHELF_ROOT` 未指定だと cwd（＝このリポジトリ自身）がドキュメントルートになる。
- Docker 配信時のみ `BASE_PATH`（Next.js basePath）が効く。サブパス対応コードはこれ前提。
