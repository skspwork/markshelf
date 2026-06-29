#!/usr/bin/env node
// markshelf ドキュメント規約チェッカー
//
// docs/ 配下の Markdown を走査し、4階層ドキュメント（要求定義 → 要件定義 → 仕様 +
// 用語集）の規約違反を検出する。リンク解決ロジックは src/lib/links.ts に揃えてある。
//
// 使い方:
//   node .claude/skills/docs-lint/lint-docs.mjs [docsDir]
//     docsDir 省略時は ./docs
//   --json   機械可読な JSON で出力
//
// 終了コード: 違反(error)が1件以上あれば 1、なければ 0。

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const docsDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "docs");

// ---- 階層定義 ------------------------------------------------------------
// 番号が大きいほど下位レイヤ。下位 → 上位（番号の小さい方）へのリンクのみ許可。
const LAYERS = {
  要求定義: { rank: 1, label: "要求定義" },
  要件定義: { rank: 2, label: "要件定義", parentDir: "要求定義" },
  仕様: { rank: 3, label: "仕様", parentDir: "要件定義" },
};
const GLOSSARY = "用語集"; // 横断レイヤ。どこからリンクしてもよい。

// ---- リンク抽出（links.ts と同じ前処理） --------------------------------
const LINK_RE = /(^|[^!])\[([^\]]*)\]\(([^)]+)\)/g;
const FENCE_RE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;

function stripCode(content) {
  return content.replace(FENCE_RE, "").replace(INLINE_CODE_RE, "");
}

// ---- ファイル走査 --------------------------------------------------------
const IGNORE = new Set(["node_modules", ".git", ".next", "dist", ".turbo"]);

function walk(dir, base, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || IGNORE.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) walk(abs, rel, out);
    else if (ent.isFile() && /\.md$/i.test(ent.name)) out.push(rel);
  }
}

if (!fs.existsSync(docsDir)) {
  console.error(`docs ディレクトリが見つかりません: ${docsDir}`);
  process.exit(2);
}

const files = [];
walk(docsDir, "", files);
const fileSet = new Set(files);

// links.ts の resolveLink を移植（docs ルート相対で解決）
function resolveLink(currentPath, rawUrl) {
  const cleanUrl = rawUrl.split("#")[0].split("?")[0].trim();
  if (!cleanUrl) return { kind: "anchor" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanUrl)) return { kind: "external" };
  if (cleanUrl.startsWith("//")) return { kind: "external" };

  let decoded;
  try {
    decoded = decodeURI(cleanUrl);
  } catch {
    decoded = cleanUrl;
  }

  const currentDir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/"))
    : "";
  const joined = decoded.startsWith("/")
    ? decoded.slice(1)
    : currentDir
      ? currentDir + "/" + decoded
      : decoded;

  const parts = joined.split("/");
  const normalized = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(p);
  }
  const resolved = normalized.join("/");
  if (!resolved) return { kind: "anchor" };

  if (fileSet.has(resolved)) return { kind: "doc", path: resolved };
  if (fileSet.has(resolved + "/README.md"))
    return { kind: "doc", path: resolved + "/README.md" };
  if (!/\.md$/i.test(resolved) && fileSet.has(resolved + ".md"))
    return { kind: "doc", path: resolved + ".md" };
  return { kind: "broken", target: resolved };
}

// 相対リンクが docs ルートより上へ突き抜けるか判定する。
// ビューアは MARKSHELF_ROOT(=docs) 起点で解決し root 超えの `..` を吸収するため
// 画面上は動くが、IDE・GitHub・実ファイルシステムではリンク切れになる。
function fsEscapesRoot(currentPath, rawUrl) {
  const cleanUrl = rawUrl.split("#")[0].split("?")[0].trim();
  if (!cleanUrl) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanUrl)) return false; // 外部
  if (cleanUrl.startsWith("//")) return false; // プロトコル相対
  if (cleanUrl.startsWith("/")) return false; // docs ルート基準、突き抜けない
  let decoded;
  try {
    decoded = decodeURI(cleanUrl);
  } catch {
    decoded = cleanUrl;
  }
  const stack = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/")).split("/")
    : [];
  for (const p of decoded.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      if (stack.length === 0) return true; // docs ルートより上へ脱出
      stack.pop();
    } else {
      stack.push(p);
    }
  }
  return false;
}

function topFolder(p) {
  return p.split("/")[0];
}

function layerOf(p) {
  return LAYERS[topFolder(p)] ?? null;
}

// 命名規約パターン
const NAMING = {
  要求定義: /^R\d+(\.\d+)?[-.]/,
  要件定義: /^REQ\d+(\.\d+)?[-.]/,
  仕様: /^SPEC\d+(\.\d+)?[-.]/,
};

// ---- チェック ------------------------------------------------------------
const findings = []; // {level, file, rule, message}
const add = (level, file, rule, message) =>
  findings.push({ level, file, rule, message });

for (const file of files) {
  const top = topFolder(file);
  const layer = LAYERS[top];
  const raw = fs.readFileSync(path.join(docsDir, file), "utf8");
  const content = stripCode(raw);

  // --- リンク収集と解決 ---
  const outgoing = []; // {url, resolved}
  LINK_RE.lastIndex = 0;
  let m;
  while ((m = LINK_RE.exec(content)) !== null) {
    const url = m[3];
    outgoing.push({ url, resolved: resolveLink(file, url) });
  }

  // 1) リンク切れ
  for (const { url, resolved } of outgoing) {
    if (resolved.kind === "broken") {
      add("error", file, "broken-link", `リンク切れ: \`${url}\``);
    }
  }

  // 1.5) docs ルートを突き抜ける相対リンク（`../` が多すぎる）
  //      ビューアでは吸収されて動くが、IDE・GitHub・実FSでは切れる。
  for (const { url } of outgoing) {
    if (fsEscapesRoot(file, url)) {
      add(
        "error",
        file,
        "escapes-root",
        `docs ルートより上を指す相対リンク（\`../\` が過剰）: \`${url}\` — ビューアでしか解決できない。\`../\` を減らすこと`,
      );
    }
  }

  // 2) 下向きリンク（下位レイヤへのクロスレイヤ違反）
  //    カテゴリ直下 README（docs/{レイヤ}/README.md）は規約の説明用メタページで、
  //    本文中に隣接レイヤへの参照を含むため対象外。
  const isCategoryRoot = file === `${top}/README.md`;
  if (layer && !isCategoryRoot) {
    for (const { url, resolved } of outgoing) {
      if (resolved.kind !== "doc") continue;
      const targetTop = topFolder(resolved.path);
      if (targetTop === GLOSSARY) continue; // 用語集は横断、常に許可
      const targetLayer = LAYERS[targetTop];
      if (!targetLayer) continue; // docs 直下 README 等は対象外
      if (targetLayer.rank > layer.rank) {
        add(
          "error",
          file,
          "downward-link",
          `下向きリンク（${layer.label}→${targetLayer.label}）: \`${url}\` — リンクは上位レイヤへ一方向のみ`,
        );
      }
    }
  }

  // 3) 親レイヤへの上向きリンクが本文にあるか
  //    対象: 要件定義/・仕様/ 配下の全ファイル（カテゴリ直下 README は除く）
  if (layer && layer.parentDir) {
    if (!isCategoryRoot) {
      const hasParentLink = outgoing.some(
        (o) =>
          o.resolved.kind === "doc" &&
          topFolder(o.resolved.path) === layer.parentDir,
      );
      if (!hasParentLink) {
        add(
          "error",
          file,
          "missing-parent-link",
          `親レイヤ（${layer.parentDir}）への上向きリンクが本文にない — 冒頭に対応する上位ドキュメントへのリンクを張ること`,
        );
      }
    }
  }

  // 4) 命名規約（カテゴリ直下 README・用語集は対象外）
  const pat = NAMING[top];
  if (pat) {
    const base = path.basename(file);
    if (!isCategoryRoot && base !== "README.md" && !pat.test(base)) {
      add(
        "warn",
        file,
        "naming",
        `命名規約に合致しない: \`${base}\`（期待プレフィックス: ${top === "要求定義" ? "R{番号}" : top === "要件定義" ? "REQ{番号}" : "SPEC{番号}"}）`,
      );
    }
  }
}

// ---- 出力 ----------------------------------------------------------------
const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");

if (asJson) {
  console.log(
    JSON.stringify(
      { docsDir, fileCount: files.length, errors, warns, findings },
      null,
      2,
    ),
  );
  process.exit(errors.length > 0 ? 1 : 0);
}

if (findings.length === 0) {
  console.log(`✓ ${files.length} ファイルを検査、規約違反なし`);
  process.exit(0);
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
for (const [file, list] of [...byFile].sort()) {
  console.log(`\n${file}`);
  for (const f of list) {
    const mark = f.level === "error" ? "✗" : "⚠";
    console.log(`  ${mark} [${f.rule}] ${f.message}`);
  }
}
console.log(
  `\n検査 ${files.length} ファイル — error ${errors.length}件 / warn ${warns.length}件`,
);
process.exit(errors.length > 0 ? 1 : 0);
