import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createElement } from "react";
import { remarkAlerts } from "./remarkAlerts";

const render = (src: string) =>
  renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkAlerts] }, src),
  );

describe("remarkAlerts", () => {
  it("[!NOTE] の引用をアラートにしてマーカーを除く", () => {
    const html = render("> [!NOTE]\n> 補足です");
    expect(html).toContain('data-alert="note"');
    expect(html).toContain("補足です");
    expect(html).not.toContain("[!NOTE]");
  });

  it("大文字小文字を区別しない", () => {
    expect(render("> [!warning]\n> 注意")).toContain('data-alert="warning"');
  });

  it("マーカーだけの段落は取り除き、続く段落を残す", () => {
    const html = render("> [!TIP]\n>\n> 本文");
    expect(html).toContain('data-alert="tip"');
    expect(html).toContain("<p>本文</p>");
  });

  it("同じ行に本文が続く場合はアラートにしない", () => {
    const html = render("> [!NOTE] 本文");
    expect(html).not.toContain("data-alert");
    expect(html).toContain("[!NOTE] 本文");
  });

  it("通常の引用はそのまま", () => {
    expect(render("> ただの引用")).not.toContain("data-alert");
  });
});
