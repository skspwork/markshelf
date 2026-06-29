import { describe, it, expect } from "vitest";
import { flattenTree, sortByPrefix, stripOrderPrefix } from "./docs";
import type { TreeEntry } from "./docs";

// ----------------------------------------------------------------
// flattenTree
// ----------------------------------------------------------------
describe("flattenTree", () => {
  it("file エントリがそのまま出る", () => {
    const entries: TreeEntry[] = [
      { name: "intro.md", displayName: "intro", path: "intro.md", type: "file" },
    ];
    expect(flattenTree(entries)).toEqual([{ path: "intro.md", displayName: "intro" }]);
  });

  it("folder で hasReadme:true は path+'/README.md' を folder の displayName で追加する", () => {
    const entries: TreeEntry[] = [
      {
        name: "guide",
        displayName: "guide",
        path: "guide",
        type: "folder",
        hasReadme: true,
        children: [],
      },
    ];
    expect(flattenTree(entries)).toEqual([{ path: "guide/README.md", displayName: "guide" }]);
  });

  it("folder で hasReadme:false は README を追加しない", () => {
    const entries: TreeEntry[] = [
      {
        name: "guide",
        displayName: "guide",
        path: "guide",
        type: "folder",
        hasReadme: false,
        children: [],
      },
    ];
    expect(flattenTree(entries)).toEqual([]);
  });

  it("ネストした folder を再帰的に flatten する（自 README → 子の順）", () => {
    const entries: TreeEntry[] = [
      {
        name: "parent",
        displayName: "parent",
        path: "parent",
        type: "folder",
        hasReadme: true,
        children: [
          { name: "child.md", displayName: "child", path: "parent/child.md", type: "file" },
        ],
      },
    ];
    expect(flattenTree(entries)).toEqual([
      { path: "parent/README.md", displayName: "parent" },
      { path: "parent/child.md", displayName: "child" },
    ]);
  });

  it("空配列を渡すと [] を返す", () => {
    expect(flattenTree([])).toEqual([]);
  });

  it("folder で children が無く hasReadme:true でも README だけ出して落ちない", () => {
    const entries: TreeEntry[] = [
      { name: "guide", displayName: "guide", path: "guide", type: "folder", hasReadme: true },
    ];
    expect(flattenTree(entries)).toEqual([{ path: "guide/README.md", displayName: "guide" }]);
  });
});

// ----------------------------------------------------------------
// sortByPrefix
// ----------------------------------------------------------------
describe("sortByPrefix", () => {
  it("両方プレフィックスありは数値昇順（'10_b' vs '2_a' で 2_a が先）", () => {
    const items = ["10_b", "2_a"];
    items.sort(sortByPrefix);
    expect(items).toEqual(["2_a", "10_b"]);
  });

  it("プレフィックスあり vs なし: プレフィックス付きが先", () => {
    const items = ["z_no_prefix", "1_with_prefix"];
    items.sort(sortByPrefix);
    expect(items[0]).toBe("1_with_prefix");
  });

  it("両方プレフィックスなしは localeCompare('ja') 順（あ < か）", () => {
    // あ < か はどのロケールでも明確
    const items = ["か", "あ"];
    items.sort(sortByPrefix);
    expect(items).toEqual(["あ", "か"]);
  });

  it("区切り文字のバリエーション（_ - . スペース）を正しく認識する", () => {
    // すべてプレフィックス付きとして認識され、数値昇順になること
    const items = ["4 d", "3.c", "2-b", "1_a"];
    items.sort(sortByPrefix);
    expect(items).toEqual(["1_a", "2-b", "3.c", "4 d"]);
  });

  it("同番号は比較が 0 を返し、安定ソートで元の順序を保つ", () => {
    const items = ["1_b", "1_a"];
    items.sort(sortByPrefix);
    expect(items).toEqual(["1_b", "1_a"]);
  });
});

// ----------------------------------------------------------------
// stripOrderPrefix
// ----------------------------------------------------------------
describe("stripOrderPrefix", () => {
  it("'01_intro' → 'intro'", () => {
    expect(stripOrderPrefix("01_intro")).toBe("intro");
  });

  it("'1-a' → 'a'", () => {
    expect(stripOrderPrefix("1-a")).toBe("a");
  });

  it("'2.3節' → '3節'（先頭1個だけ除去）", () => {
    expect(stripOrderPrefix("2.3節")).toBe("3節");
  });

  it("プレフィックスなしは不変", () => {
    expect(stripOrderPrefix("no-prefix")).toBe("no-prefix");
  });

  it("'123'（区切りなし数字のみ）は不変", () => {
    expect(stripOrderPrefix("123")).toBe("123");
  });

  it("拡張子は除去しない（責務境界: .md 除去は呼び出し側が別途行う）", () => {
    expect(stripOrderPrefix("01_intro.md")).toBe("intro.md");
  });
});
