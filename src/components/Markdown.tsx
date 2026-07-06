"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link2, Check } from "lucide-react";
import type { HeadingInfo } from "./TableOfContents";
import { MermaidBlock } from "./MermaidBlock";
import { withBasePath } from "@/lib/basePath";

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
}

/**
 * Anchor rendered next to a heading. Clicking it points the URL hash at the
 * heading and copies the resulting shareable link (?file=...#heading-id) to the
 * clipboard so it can be sent to someone else and opened scrolled to that spot.
 */
function HeadingAnchor({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.hash = id;
    const full = url.toString();
    window.history.replaceState(null, "", full);
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(full).then(done).catch(done);
    } else {
      done();
    }
  };

  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      className="ml-2 inline-flex items-center align-middle text-[var(--text-muted)] no-underline opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--brand-primary)] transition-opacity"
      title={copied ? "リンクをコピーしました" : "このヘッダーへのリンクをコピー"}
      aria-label="このヘッダーへのリンクをコピー"
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
    </a>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Parse headings from raw markdown text so IDs are deterministic and not affected by React strict mode */
function parseHeadings(markdown: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const seen = new Map<string, number>();
  const headingRe = /^(#{1,4})\s+(.+)$/;
  const fenceRe = /^[ \t]*(`{3,}|~{3,})/;
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const fenceMatch = fenceRe.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) {
        fence = marker;
        continue;
      }
      if (fenceMatch[1].startsWith(fence)) {
        fence = null;
        continue;
      }
    }
    if (fence !== null) continue;
    const m = headingRe.exec(line);
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

export function Markdown({
  children,
  onHeadingsExtracted,
  fileRefs,
  currentPath,
  onNavigate,
  onPreviewShow,
  onPreviewHide,
  enableHeadingLinks = false,
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

  // Build autolink regex from fileRefs
  const autolinkMap = useMemo(() => {
    if (!fileRefs || fileRefs.length === 0) return null;
    const map = new Map<string, string>();
    const filtered = fileRefs
      .filter((f) => f.displayName.length > 2 && f.path !== currentPath)
      .sort((a, b) => b.displayName.length - a.displayName.length);
    for (const f of filtered) {
      map.set(f.displayName, f.path);
    }
    return map;
  }, [fileRefs, currentPath]);

  const autolinkRegex = useMemo(() => {
    if (!autolinkMap || autolinkMap.size === 0) return null;
    const escaped = Array.from(autolinkMap.keys()).map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp(`(${escaped.join("|")})`, "g");
  }, [autolinkMap]);

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

      // `scroll-mt-4` keeps the heading clear of the container's top edge when
      // scrolled to via a shared hash link; `group` drives the anchor's hover.
      const mergedClassName = enableHeadingLinks
        ? `group scroll-mt-4${className ? ` ${className}` : ""}`
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
      if (
        children &&
        typeof children === "object" &&
        "type" in children &&
        (children as React.ReactElement).type === MermaidBlock
      ) {
        return <>{children}</>;
      }
      return <pre>{children}</pre>;
    },
    // Auto-link rendering: intercept <a> with "autolink:" prefix,
    // and resolve relative markdown links to docs paths so they behave like autolinks.
    a: ({ href, children: linkChildren, ...rest }) => {
      let targetPath: string | null = null;
      if (href?.startsWith("autolink:")) {
        targetPath = href.slice("autolink:".length);
      } else if (href) {
        targetPath = resolveRelativeLink(href);
      }

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
    // Inject auto-links into text content
    p: ({ children: pChildren, ...rest }) => {
      return <p {...rest}>{processAutolinks(pChildren)}</p>;
    },
    li: ({ children: liChildren, ...rest }) => {
      return <li {...rest}>{processAutolinks(liChildren)}</li>;
    },
    td: ({ children: tdChildren, ...rest }) => {
      return <td {...rest}>{processAutolinks(tdChildren)}</td>;
    },
  };

  function processAutolinks(node: React.ReactNode): React.ReactNode {
    if (!autolinkRegex || !autolinkMap) return node;

    if (typeof node === "string") {
      return splitWithAutolinks(node);
    }

    if (Array.isArray(node)) {
      return node.map((child, i) => {
        if (typeof child === "string") {
          return <span key={i}>{splitWithAutolinks(child)}</span>;
        }
        return child;
      });
    }

    return node;
  }

  function splitWithAutolinks(text: string): React.ReactNode {
    if (!autolinkRegex || !autolinkMap) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex
    autolinkRegex.lastIndex = 0;

    while ((match = autolinkRegex.exec(text)) !== null) {
      const matchedText = match[0];
      const targetPath = autolinkMap.get(matchedText);
      if (!targetPath) continue;

      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      parts.push(
        <span
          key={`${match.index}-${matchedText}`}
          className="text-[var(--brand-primary)] border-b border-dashed border-[var(--brand-primary)] cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            onPreviewHide?.();
            onNavigate?.(targetPath);
          }}
          onMouseEnter={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            onPreviewShow?.(targetPath, rect);
          }}
          onMouseLeave={() => onPreviewHide?.()}
        >
          {matchedText}
        </span>,
      );

      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length === 0 ? text : parts;
  }

  return (
    <div
      className="prose prose-sm max-w-none
      prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[var(--text-primary)]
      prose-h1:text-lg prose-h1:leading-snug prose-h1:mb-4
      prose-h2:text-[15px] prose-h2:leading-snug prose-h2:border-b prose-h2:border-[var(--border-default)] prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-3
      prose-h3:text-[13px] prose-h3:leading-snug prose-h3:mt-6 prose-h3:mb-2
      prose-p:text-[var(--text-secondary)] prose-p:text-[13px] prose-p:leading-[1.75]
      prose-li:text-[var(--text-secondary)] prose-li:text-[13px] prose-li:leading-[1.75]
      prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
      prose-a:text-[var(--brand-primary)] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
      prose-code:text-xs prose-code:text-[var(--text-primary)] prose-code:bg-[var(--bg-muted)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-[var(--bg-muted)] prose-pre:text-xs prose-pre:text-[var(--text-primary)]
      prose-table:text-[12px]
      prose-th:bg-[var(--bg-muted)] prose-th:text-[var(--text-primary)] prose-th:font-semibold prose-th:px-3 prose-th:py-1.5 prose-th:text-left
      prose-td:px-3 prose-td:py-1.5 prose-td:border-[var(--border-default)] prose-td:text-[var(--text-secondary)]
      prose-hr:border-[var(--border-default)]
      prose-blockquote:border-l-[var(--brand-primary)] prose-blockquote:text-[var(--text-muted)] prose-blockquote:not-italic
      prose-img:rounded-lg
    "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
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
