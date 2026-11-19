"use client";

import { isValidElement, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  Link2,
  Check,
  Copy,
  Info,
  Lightbulb,
  MessageSquareWarning,
  TriangleAlert,
  OctagonAlert,
} from "lucide-react";
import { remarkAlerts, type AlertType } from "@/lib/remarkAlerts";
import type { HeadingInfo } from "./TableOfContents";
import { MermaidBlock } from "./MermaidBlock";
import { withBasePath } from "@/lib/basePath";
import { parseHeadings, slugify } from "@/lib/markdown";

export interface FileRef {
  displayName: string;
  path: string;
}

interface Props {
  children: string;
  onHeadingsExtracted?: (headings: HeadingInfo[]) => void;
  fileRefs?: FileRef[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onPreviewShow?: (path: string, rect: DOMRect) => void;
  onPreviewHide?: () => void;
  /** Show a per-heading anchor link that copies a shareable URL (main content only). */
  enableHeadingLinks?: boolean;
  /**
   * "reader": roomy, centered layout for the main content pane.
   * "compact": dense layout for hover previews.
   */
  variant?: "reader" | "compact";
}

const REMARK_PLUGINS: Options["remarkPlugins"] = [remarkGfm, remarkAlerts];
// Only fenced blocks with an explicit language are highlighted; mermaid stays
// plain text so <MermaidBlock> receives the raw source.
const REHYPE_PLUGINS: Options["rehypePlugins"] = [
  [rehypeHighlight, { detect: false, plainText: ["mermaid"] }],
];

const ALERTS: Record<AlertType, { label: string; Icon: typeof Info }> = {
  note: { label: "Note", Icon: Info },
  tip: { label: "Tip", Icon: Lightbulb },
  important: { label: "Important", Icon: MessageSquareWarning },
  warning: { label: "Warning", Icon: TriangleAlert },
  caution: { label: "Caution", Icon: OctagonAlert },
};

/** Copy text via a temporary textarea + execCommand (works without a secure context). */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok: boolean;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * Anchor rendered next to a heading. Clicking it points the URL hash at the
 * heading and copies the resulting shareable link (?file=...#heading-id) to the
 * clipboard so it can be sent to someone else and opened scrolled to that spot.
 */
function HeadingAnchor({ id }: { id: string }) {
  const [copied, copy] = useCopied();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.hash = id;
    const full = url.toString();
    window.history.replaceState(null, "", full);
    copy(full);
  };

  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      className="md-heading-anchor"
      title={copied ? "リンクをコピーしました" : "このヘッダーへのリンクをコピー"}
      aria-label="このヘッダーへのリンクをコピー"
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
    </a>
  );
}

/** Copy to the clipboard, falling back to execCommand outside secure contexts. */
async function copyText(text: string): Promise<boolean> {
  // navigator.clipboard is only available in secure contexts (HTTPS or
  // localhost). When served over plain HTTP from another host it is
  // undefined, so fall back to the legacy execCommand approach.
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return legacyCopy(text);
    }
  }
  return legacyCopy(text);
}

/** Copy text and show a check mark for a moment afterwards. */
function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return [copied, copy];
}

/** Fenced code block with a language label and a copy button. */
function CodeBlock({ language, children }: { language: string | null; children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, copy] = useCopied();
  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span className="md-code-lang">{language ?? ""}</span>
        <button
          type="button"
          className="md-code-copy"
          onClick={() => copy(preRef.current?.textContent ?? "")}
          title={copied ? "コピーしました" : "コードをコピー"}
          aria-label="コードをコピー"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

/** GitHub-style alert box (`> [!NOTE]` etc., see remarkAlerts). */
function Alert({ type, children }: { type: AlertType; children: React.ReactNode }) {
  const { label, Icon } = ALERTS[type];
  return (
    <div className={`md-alert md-alert-${type}`} role="note">
      <p className="md-alert-title">
        <Icon size={15} aria-hidden />
        {label}
      </p>
      {children}
    </div>
  );
}

export function Markdown({
  children,
  onHeadingsExtracted,
  fileRefs,
  currentPath,
  onNavigate,
  onPreviewShow,
  onPreviewHide,
  enableHeadingLinks = false,
  variant = "compact",
}: Props) {
  // Parse headings deterministically from the markdown source
  const headings = useMemo(() => parseHeadings(children), [children]);

  // Build a map from heading text → id for the components to use
  const headingIdMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const h of headings) {
      const existing = map.get(h.text) ?? [];
      existing.push(h.id);
      map.set(h.text, existing);
    }
    return map;
  }, [headings]);

  // Track which heading text has been consumed during this render
  const headingCounters = useMemo(() => new Map<string, number>(), [headings]);

  // Notify parent of headings
  useEffect(() => {
    onHeadingsExtracted?.(headings);
  }, [headings, onHeadingsExtracted]);

  const fileSet = useMemo(
    () => new Set((fileRefs ?? []).map((f) => f.path)),
    [fileRefs],
  );

  function resolveRelativeLink(href: string): string | null {
    const cleanUrl = href.split("#")[0].split("?")[0].trim();
    if (!cleanUrl) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(cleanUrl)) return null;
    if (cleanUrl.startsWith("//")) return null;

    let decoded: string;
    try {
      decoded = decodeURI(cleanUrl);
    } catch {
      decoded = cleanUrl;
    }

    const currentDir =
      currentPath && currentPath.includes("/")
        ? currentPath.slice(0, currentPath.lastIndexOf("/"))
        : "";
    const joined = decoded.startsWith("/")
      ? decoded.slice(1)
      : currentDir
        ? currentDir + "/" + decoded
        : decoded;

    const parts = joined.split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "" || p === ".") continue;
      if (p === "..") {
        normalized.pop();
        continue;
      }
      normalized.push(p);
    }
    const resolved = normalized.join("/");
    if (!resolved) return null;

    if (fileSet.has(resolved)) return resolved;
    if (fileSet.has(resolved + "/README.md")) return resolved + "/README.md";
    if (!/\.md$/i.test(resolved) && fileSet.has(resolved + ".md")) return resolved + ".md";
    return null;
  }

  function resolveAssetPath(src: string): string | null {
    const cleanUrl = src.split("#")[0].split("?")[0].trim();
    if (!cleanUrl) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(cleanUrl)) return null;
    if (cleanUrl.startsWith("//")) return null;

    let decoded: string;
    try {
      decoded = decodeURI(cleanUrl);
    } catch {
      decoded = cleanUrl;
    }

    const currentDir =
      currentPath && currentPath.includes("/")
        ? currentPath.slice(0, currentPath.lastIndexOf("/"))
        : "";
    const joined = decoded.startsWith("/")
      ? decoded.slice(1)
      : currentDir
        ? currentDir + "/" + decoded
        : decoded;

    const parts = joined.split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "" || p === ".") continue;
      if (p === "..") {
        normalized.pop();
        continue;
      }
      normalized.push(p);
    }
    const resolved = normalized.join("/");
    return resolved || null;
  }

  function getIdForHeading(text: string): string {
    const ids = headingIdMap.get(text);
    if (!ids) return slugify(text) || "heading";
    const idx = headingCounters.get(text) ?? 0;
    headingCounters.set(text, idx + 1);
    return ids[idx % ids.length];
  }

  function makeHeadingComponent(level: number) {
    return function HeadingWithId({
      children: headingChildren,
      className,
      ...props
    }: React.HTMLAttributes<HTMLHeadingElement>) {
      const text =
        typeof headingChildren === "string"
          ? headingChildren
          : extractText(headingChildren);
      const id = getIdForHeading(text);

      // `scroll-mt-6` keeps the heading clear of the container's top edge when
      // scrolled to via a shared hash link; `group` drives the anchor's hover.
      const mergedClassName = enableHeadingLinks
        ? `group scroll-mt-6${className ? ` ${className}` : ""}`
        : className;
      const hProps = { ...props, id, className: mergedClassName };
      const inner = (
        <>
          {headingChildren}
          {enableHeadingLinks && <HeadingAnchor id={id} />}
        </>
      );
      switch (level) {
        case 1: return <h1 {...hProps}>{inner}</h1>;
        case 2: return <h2 {...hProps}>{inner}</h2>;
        case 3: return <h3 {...hProps}>{inner}</h3>;
        default: return <h4 {...hProps}>{inner}</h4>;
      }
    };
  }

  const components: Components = {
    h1: makeHeadingComponent(1),
    h2: makeHeadingComponent(2),
    h3: makeHeadingComponent(3),
    h4: makeHeadingComponent(4),
    // Mermaid code blocks
    code: ({ className, children, ...rest }) => {
      const match = /language-mermaid/.exec(className || "");
      if (match) {
        const code = String(children).replace(/\n$/, "");
        return <MermaidBlock code={code} />;
      }
      return <code className={className} {...rest}>{children}</code>;
    },
    // Wrap pre to avoid nesting issues with mermaid blocks
    pre: ({ children }) => {
      // If the child is a MermaidBlock (rendered from code), don't wrap in <pre>
      if (isValidElement(children) && children.type === MermaidBlock) {
        return <>{children}</>;
      }
      const codeClass = isValidElement<{ className?: string }>(children)
        ? (children.props.className ?? "")
        : "";
      const language = /language-([\w+#-]+)/.exec(codeClass)?.[1] ?? null;
      return <CodeBlock language={language}>{children}</CodeBlock>;
    },
    blockquote: ({ children, node }) => {
      const type = node?.properties?.dataAlert;
      if (typeof type === "string" && type in ALERTS) {
        return <Alert type={type as AlertType}>{children}</Alert>;
      }
      return <blockquote>{children}</blockquote>;
    },
    // Wide tables scroll horizontally instead of overflowing the pane.
    table: ({ children }) => (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    ),
    // Resolve relative markdown links to docs paths so they navigate in-app.
    a: ({ href, children: linkChildren, ...rest }) => {
      const targetPath = href ? resolveRelativeLink(href) : null;

      if (targetPath) {
        const resolved = targetPath;
        return (
          <span
            className="text-[var(--brand-primary)] font-medium cursor-pointer hover:underline transition-colors"
            onClick={(e) => {
              e.preventDefault();
              onPreviewHide?.();
              onNavigate?.(resolved);
            }}
            onMouseEnter={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              onPreviewShow?.(resolved, rect);
            }}
            onMouseLeave={() => onPreviewHide?.()}
          >
            {linkChildren}
          </span>
        );
      }
      return <a href={href} {...rest}>{linkChildren}</a>;
    },
    // Images: rewrite relative src to the asset API so files under DOCS_ROOT
    // are reachable; leave absolute, data:, and protocol-relative URLs alone.
    img: ({ src, alt, ...rest }) => {
      if (typeof src !== "string") {
        return <img src={src as string | undefined} alt={alt} {...rest} />;
      }
      const resolved = resolveAssetPath(src);
      if (!resolved) return <img src={src} alt={alt} {...rest} />;
      const apiSrc = withBasePath(`/api/asset?path=${encodeURIComponent(resolved)}`);
      return <img src={apiSrc} alt={alt} {...rest} />;
    },
  };

  return (
    <div className={`md-body md-${variant}`}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractText((node as any).props.children);
  }
  return "";
}
