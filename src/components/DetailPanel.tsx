"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Markdown, FileRef } from "./Markdown";
import { HistoryPanel } from "./HistoryPanel";
import { TableOfContents, HeadingInfo } from "./TableOfContents";
import { PreviewPopup } from "./PreviewPopup";
import { LinkGraph } from "./LinkGraph";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";
import { FileText, History, Network, ArrowLeft, ArrowRight } from "lucide-react";

interface FolderInfo {
  path: string;
  displayName: string;
  depth: number;
}

interface Props {
  filePath: string;
  fileRefs?: FileRef[];
  folders?: FolderInfo[];
  onNavigate?: (path: string) => void;
  onGoBack?: () => void;
  onGoForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

export function DetailPanel({ filePath, fileRefs, folders, onNavigate, onGoBack, onGoForward, canGoBack, canGoForward }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "history" | "links">("content");
  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [tocWidth, setTocWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("markshelf:tocWidth");
      return saved ? Number(saved) || 176 : 176;
    }
    return 176;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const tocContainerRef = useRef<HTMLDivElement>(null);

  // Preview popup state
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    setContent(null);
    setHeadings([]);
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setPreviewPath(null);
    setPreviewPos(null);
  }, [filePath]);

  useEffect(() => {
    fetch(withBasePath(`/api/file?path=${encodeURIComponent(filePath)}`))
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(() => setContent(null));
  }, [filePath, refreshTick]);

  // When opened via a shared link (?file=...#heading-id), scroll the matching
  // heading into view once its content has rendered. Runs once per file load.
  const scrolledHashRef = useRef<string | null>(null);
  useEffect(() => {
    scrolledHashRef.current = null;
  }, [filePath]);
  useEffect(() => {
    if (tab !== "content" || content === null || headings.length === 0) return;
    if (typeof window === "undefined") return;
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash) return;
    let hash = rawHash;
    try {
      hash = decodeURIComponent(rawHash);
    } catch {
      /* keep raw */
    }
    const key = `${filePath}#${hash}`;
    if (scrolledHashRef.current === key) return;
    if (!headings.some((h) => h.id === hash)) return;

    const raf = requestAnimationFrame(() => {
      const container = scrollRef.current;
      const el = document.getElementById(hash);
      if (!container || !el) return;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      container.scrollTop += eRect.top - cRect.top - 16;
      scrolledHashRef.current = key;
    });
    return () => cancelAnimationFrame(raf);
  }, [tab, content, headings, filePath]);

  const handlePreviewShow = useCallback((path: string, rect: DOMRect) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setPreviewPath(path);
      setPreviewPos({ x: rect.left, y: rect.bottom + 4 });
    }, 200);
  }, []);

  const handlePreviewHide = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setPreviewPath(null);
      setPreviewPos(null);
    }, 300);
  }, []);

  const handlePreviewEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const handlePreviewLeave = useCallback(() => {
    handlePreviewHide();
  }, [handlePreviewHide]);

  const startTocResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const container = tocContainerRef.current?.parentElement;
    const onMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const containerRight = container.getBoundingClientRect().right;
      const w = Math.max(120, Math.min(400, containerRight - e.clientX));
      setTocWidth(w);
      localStorage.setItem("markshelf:tocWidth", String(w));
    };
    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const fileName = filePath.split("/").pop()?.replace(/\.md$/i, "") || filePath;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[var(--border-default)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {canGoBack && (
            <button
              onClick={onGoBack}
              className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="戻る"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {canGoForward && (
            <button
              onClick={onGoForward}
              className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="進む"
            >
              <ArrowRight size={14} />
            </button>
          )}
          <h2 className="font-semibold text-[14px] leading-snug truncate text-[var(--text-primary)]">
            {fileName}
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("content")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              tab === "content"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <FileText size={12} />
            内容
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              tab === "history"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <History size={12} />
            変更履歴
          </button>
          <button
            onClick={() => setTab("links")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              tab === "links"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Network size={12} />
            リンク
          </button>
        </div>
      </div>

      {tab === "content" ? (
        content !== null ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
              <div className="p-4">
                <Markdown
                  enableHeadingLinks
                  onHeadingsExtracted={setHeadings}
                  fileRefs={fileRefs}
                  currentPath={filePath}
                  onNavigate={(p) => {
                    setTab("content");
                    onNavigate?.(p);
                  }}
                  onPreviewShow={handlePreviewShow}
                  onPreviewHide={handlePreviewHide}
                >
                  {content}
                </Markdown>
              </div>
            </div>
            {headings.length > 0 && (
              <div className="flex shrink-0" ref={tocContainerRef}>
                <div
                  className="w-1 hover:bg-[var(--brand-primary)] bg-[var(--border-default)] cursor-col-resize shrink-0 transition-colors duration-150"
                  onMouseDown={startTocResize}
                />
                <div
                  className="overflow-y-auto border-l border-[var(--border-default)]"
                  style={{ width: tocWidth }}
                >
                  <TableOfContents headings={headings} scrollContainer={scrollRef.current} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 p-4 text-[var(--text-muted)] text-sm">読み込み中...</div>
        )
      ) : tab === "history" ? (
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <HistoryPanel filePath={filePath} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <LinkGraph
            currentPath={filePath}
            folders={folders ?? []}
            onNavigate={(p) => onNavigate?.(p)}
            onPreviewShow={handlePreviewShow}
            onPreviewHide={handlePreviewHide}
          />
        </div>
      )}

      <PreviewPopup
        path={previewPath}
        position={previewPos}
        onNavigate={(p) => {
          setPreviewPath(null);
          setPreviewPos(null);
          setTab("content");
          onNavigate?.(p);
        }}
        onMouseEnter={handlePreviewEnter}
        onMouseLeave={handlePreviewLeave}
        fileRefs={fileRefs}
      />
    </div>
  );
}
