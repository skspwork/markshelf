import type { Blockquote, Paragraph, Root, RootContent } from "mdast";

export const ALERT_TYPES = ["note", "tip", "important", "warning", "caution"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i;

/**
 * GitHub-style alerts: a blockquote whose first line is `[!NOTE]` (or TIP,
 * IMPORTANT, WARNING, CAUTION) becomes an alert. The marker is removed and the
 * blockquote gets `data-alert="<type>"` so the renderer can style it.
 */
export function remarkAlerts() {
  return (tree: Root) => {
    visit(tree);
  };
}

function visit(node: Root | RootContent) {
  if (node.type === "blockquote") transform(node);
  if ("children" in node) {
    for (const child of node.children) visit(child as RootContent);
  }
}

function transform(node: Blockquote) {
  const first = node.children[0];
  if (!first || first.type !== "paragraph") return;
  const text = first.children[0];
  if (!text || text.type !== "text") return;
  const m = MARKER.exec(text.value);
  // The marker must stand alone on its line: `[!NOTE] foo` is not an alert.
  if (!m) return;
  if (m[0].length === text.value.length && first.children.length > 1 && first.children[1].type !== "break") {
    return;
  }

  const type = m[1].toLowerCase() as AlertType;
  text.value = text.value.slice(m[0].length);
  stripLeadingBreak(first);
  if (first.children.length === 0 || (first.children.length === 1 && isEmptyText(first.children[0]))) {
    node.children.shift();
  }

  node.data = {
    ...node.data,
    // hast property name; serialized as the `data-alert` attribute.
    hProperties: { ...(node.data?.hProperties ?? {}), dataAlert: type },
  };
}

function stripLeadingBreak(p: Paragraph) {
  if (p.children.length > 0 && isEmptyText(p.children[0])) p.children.shift();
  if (p.children.length > 0 && p.children[0].type === "break") p.children.shift();
}

function isEmptyText(n: Paragraph["children"][number]) {
  return n.type === "text" && n.value === "";
}
