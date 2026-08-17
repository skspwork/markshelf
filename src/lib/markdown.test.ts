import { describe, it, expect } from "vitest";
import { parseHeadings, stripFencedCode } from "./markdown";

const md = (...lines: string[]) => lines.join("\n");

describe("parseHeadings", () => {
  it("フェンス外の見出しだけを抽出する", () => {
    const source = md(
      "# タイトル",
      "",
      "```bash",
      "# これはコメント",
      "```",
      "",
      "## セクション",
    );
    expect(parseHeadings(source)).toEqual([
      { id: "タイトル", text: "タイトル", level: 1 },
      { id: "セクション", text: "セクション", level: 2 },
    ]);
  });

  it("markdown を入れ子にしたコードブロックの中身を見出しにしない", () => {
    const source = md(
      "# タイトル",
      "",
      "````markdown",
      "# 埋め込まれた見出し",
      "",
      "```bash",
      "# インストール手順",
      "npm i",
      "```",
      "",
      "## 埋め込まれた小見出し",
      "````",
      "",
      "## 本物の見出し",
    );
    expect(parseHeadings(source)).toEqual([
      { id: "タイトル", text: "タイトル", level: 1 },
      { id: "本物の見出し", text: "本物の見出し", level: 2 },
    ]);
  });

  it("入れ子コードブロックの後ろの見出しを取りこぼさない", () => {
    // 内側のフェンス行が奇数個でも、外側の ```` までブロックが続く
    const source = md(
      "````markdown",
      "```js",
      "console.log(1)",
      "````",
      "",
      "## 後続A",
      "",
      "## 後続B",
    );
    expect(parseHeadings(source).map((h) => h.text)).toEqual(["後続A", "後続B"]);
  });

  it("~~~ で囲んだ中の ``` では閉じない", () => {
    const source = md("~~~markdown", "```", "# 中身", "```", "~~~", "", "# 外側");
    expect(parseHeadings(source).map((h) => h.text)).toEqual(["外側"]);
  });

  it("同名の見出しに連番の ID を振る", () => {
    const source = md("## 概要", "## 概要");
    expect(parseHeadings(source).map((h) => h.id)).toEqual(["概要", "概要-1"]);
  });
});

describe("stripFencedCode", () => {
  it("入れ子のコードブロックを丸ごと取り除く", () => {
    const source = md(
      "前文",
      "````markdown",
      "[リンク](a.md)",
      "```",
      "code",
      "```",
      "````",
      "後文",
    );
    expect(stripFencedCode(source)).toBe(md("前文", "後文"));
  });

  it("閉じられていないフェンスは末尾まで取り除く", () => {
    expect(stripFencedCode(md("前文", "```js", "code", "残り"))).toBe("前文");
  });

  it("フェンスでない行はそのまま残す", () => {
    expect(stripFencedCode(md("`inline`", "text"))).toBe(md("`inline`", "text"));
  });
});
