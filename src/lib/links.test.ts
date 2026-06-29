import { describe, it, expect } from "vitest";
import { buildLinkGraph } from "./links";
import type { FileRef } from "./docs";

// readFile を差し替えてグラフ生成のみを純粋に検証する。
function graphOf(files: FileRef[], contents: Record<string, string>) {
  return buildLinkGraph(files, (p) => contents[p] ?? null);
}

describe("buildLinkGraph", () => {
  it("明示的な相対リンクをエッジにする", () => {
    const files: FileRef[] = [
      { path: "a.md", displayName: "a-document" },
      { path: "b.md", displayName: "b-document" },
    ];
    const { edges } = graphOf(files, {
      "a.md": "[B へ](b.md)",
      "b.md": "# b",
    });
    expect(edges).toEqual([{ source: "a.md", target: "b.md" }]);
  });

  it("フォルダ宛リンクを README.md に補完する", () => {
    const files: FileRef[] = [
      { path: "a.md", displayName: "a-document" },
      { path: "sub/README.md", displayName: "sub-folder" },
    ];
    const { edges } = graphOf(files, {
      "a.md": "[sub へ](sub/)",
      "sub/README.md": "# sub",
    });
    expect(edges).toEqual([{ source: "a.md", target: "sub/README.md" }]);
  });

  it("画像リンク・コードブロック内・外部URLはエッジにしない", () => {
    const files: FileRef[] = [
      { path: "a.md", displayName: "a-document" },
      { path: "b.md", displayName: "b-document" },
    ];
    const { edges } = graphOf(files, {
      "a.md": [
        "![alt](b.md)", // 画像は除外
        "`[code](b.md)`", // インラインコードは除外
        "[外部](https://example.com/b.md)", // 外部は除外
      ].join("\n"),
      "b.md": "# b",
    });
    expect(edges).toHaveLength(0);
  });

  it("本文中の displayName 自動マッチをエッジにする", () => {
    const files: FileRef[] = [
      { path: "a.md", displayName: "a-document" },
      { path: "glossary.md", displayName: "用語サンプル" },
    ];
    const { edges } = graphOf(files, {
      "a.md": "この文書は 用語サンプル を説明する。",
      "glossary.md": "# 用語サンプル",
    });
    expect(edges).toContainEqual({ source: "a.md", target: "glossary.md" });
  });

  it("自己参照はエッジにしない", () => {
    const files: FileRef[] = [{ path: "a.md", displayName: "a-document" }];
    const { edges } = graphOf(files, { "a.md": "[自分](a.md)" });
    expect(edges).toHaveLength(0);
  });
});
