/**
 * Markdown ソースをそのまま走査するためのユーティリティ。
 *
 * 見出し抽出（目次）やリンク抽出（グラフ）は remark を通さず生テキストを
 * 行単位で読むため、フェンス（``` / ~~~）の開閉を CommonMark と同じ規則で
 * 判定する必要がある。特に「markdown の中に markdown のコードブロックを
 * 埋め込む」ケースでは外側を 4 個以上のバッククォートで囲むため、
 * 「同じ文字・同じ長さ以上・情報文字列なし」で閉じるという規則を守らないと
 * 内側の ``` で閉じたと誤認し、以降の解釈がずれる。
 */

export interface HeadingInfo {
  id: string;
  text: string;
  level: number;
}

/** 行頭（インデント許容）のフェンス行。$1 = マーカー, $2 = 情報文字列 */
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/**
 * 各行がフェンスコードブロックに属するか（フェンス行自身も true）を返す。
 * 閉じられていないフェンスは文書末尾までをコードブロックとして扱う。
 */
function fencedFlags(lines: string[]): boolean[] {
  const flags = new Array<boolean>(lines.length).fill(false);
  let open: { char: string; length: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const m = FENCE_RE.exec(lines[i]);
    if (!m) {
      flags[i] = open !== null;
      continue;
    }
    const marker = m[1];
    const char = marker[0];
    const info = m[2];

    if (open === null) {
      // バッククォートの開始フェンスは情報文字列にバッククォートを含められない
      if (char === "`" && info.includes("`")) continue;
      open = { char, length: marker.length };
      flags[i] = true;
      continue;
    }

    // 閉じフェンスの条件: 同じ文字・開始と同じ長さ以上・情報文字列なし。
    // これを満たさない行（内側の ``` など）はブロックの中身として扱う。
    if (char === open.char && marker.length >= open.length && info.trim() === "") {
      open = null;
    }
    flags[i] = true;
  }

  return flags;
}

/** フェンスコードブロックの行を取り除いた markdown を返す */
export function stripFencedCode(markdown: string): string {
  const lines = markdown.split("\n");
  const fenced = fencedFlags(lines);
  return lines.filter((_, i) => !fenced[i]).join("\n");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * markdown ソースから見出しを抽出する。ID が描画側と一致するよう、
 * React の strict mode に影響されない決定的な採番を行う。
 */
export function parseHeadings(markdown: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const seen = new Map<string, number>();
  const headingRe = /^(#{1,4})\s+(.+)$/;
  const lines = markdown.split("\n");
  const fenced = fencedFlags(lines);

  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const m = headingRe.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[#*_`[\]]/g, "").trim();
    const base = slugify(text) || "heading";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    headings.push({ id, text, level });
  }

  return headings;
}
