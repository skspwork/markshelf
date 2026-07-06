"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { TreeView } from "@/components/TreeView";
import { DetailPanel } from "@/components/DetailPanel";
import { SearchBar } from "@/components/SearchBar";
import { TimelinePanel } from "@/components/TimelinePanel";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";
import { Clock } from "lucide-react";

interface TreeEntry {
  name: string;
  displayName: string;
  path: string;
  type: "folder" | "file";
  children?: TreeEntry[];
  hasReadme?: boolean;
}

const FILE_QUERY_KEY = "file";

function readFileFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URL(window.location.href).searchParams.get(FILE_QUERY_KEY);
  return v ? decodeURIComponent(v) : null;
}

export default function Home() {
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [root, setRoot] = useState<string>("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(260);
  const [showTimeline, setShowTimeline] = useState(false);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);

  // Initial hydration from URL (?file=...)
  useEffect(() => {
    const fromUrl = readFileFromUrl();
    if (fromUrl) setSelectedPath(fromUrl);
  }, []);

  // Keep URL in sync with selectedPath (shareable links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedPath) {
      url.searchParams.set(FILE_QUERY_KEY, selectedPath);
    } else {
      url.searchParams.delete(FILE_QUERY_KEY);
    }
    const next = url.pathname + (url.search ? url.search : "") + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedPath]);

  const navigateTo = useCallback((path: string | null) => {
    if (selectedPath && path !== selectedPath) {
      setBackStack((s) => [...s, selectedPath]);
      setForwardStack([]);
    }
    // Switching files drops any heading hash — it points at a heading in the
    // file we're leaving. Shared-link loads bypass navigateTo and keep theirs.
    if (path !== selectedPath && typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setSelectedPath(path);
  }, [selectedPath]);

  const goBack = useCallback(() => {
    if (backStack.length === 0) return;
    const prev = backStack[backStack.length - 1];
    if (selectedPath) setForwardStack((s) => [...s, selectedPath]);
    setBackStack((s) => s.slice(0, -1));
    setSelectedPath(prev);
  }, [backStack, selectedPath]);

  const goForward = useCallback(() => {
    if (forwardStack.length === 0) return;
    const next = forwardStack[forwardStack.length - 1];
    if (selectedPath) setBackStack((s) => [...s, selectedPath]);
    setForwardStack((s) => s.slice(0, -1));
    setSelectedPath(next);
  }, [forwardStack, selectedPath]);

  const canGoBack = backStack.length > 0;
  const canGoForward = forwardStack.length > 0;
  const refreshTick = useRefreshTick();

  useEffect(() => {
    fetch(withBasePath("/api/tree"))
      .then((r) => r.json())
      .then((data) => {
        setTree(data.tree ?? []);
        setRoot(data.root ?? "");
      });
  }, [refreshTick]);

  useEffect(() => {
    const saved = localStorage.getItem("markshelf:treeWidth");
    if (saved) setTreeWidth(Number(saved) || 260);
  }, []);

  const fileRefs = useMemo(() => {
    function flatten(entries: TreeEntry[]): { path: string; displayName: string }[] {
      const refs: { path: string; displayName: string }[] = [];
      for (const e of entries) {
        if (e.type === "file") {
          refs.push({ path: e.path, displayName: e.displayName });
        }
        if (e.type === "folder") {
          if (e.hasReadme) {
            refs.push({ path: e.path + "/README.md", displayName: e.displayName });
          }
          if (e.children) refs.push(...flatten(e.children));
        }
      }
      return refs;
    }
    return flatten(tree);
  }, [tree]);

  const folders = useMemo(() => {
    const result: { path: string; displayName: string; depth: number }[] = [];
    function walk(entries: TreeEntry[], depth: number) {
      for (const e of entries) {
        if (e.type === "folder") {
          result.push({ path: e.path, displayName: e.displayName, depth });
          if (e.children) walk(e.children, depth + 1);
        }
      }
    }
    walk(tree, 0);
    return result;
  }, [tree]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMouseMove = (e: MouseEvent) => {
      const w = Math.max(180, Math.min(window.innerWidth * 0.4, e.clientX));
      setTreeWidth(w);
      localStorage.setItem("markshelf:treeWidth", String(w));
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

  return (
    <div className="h-screen flex flex-col">
      <header className="h-11 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center px-5 shrink-0 gap-3">
        <span className="font-semibold text-[15px] tracking-tight leading-none">
          Mark<span className="text-[var(--brand-primary)]">Shelf</span>
        </span>
        {root && (
          <span className="text-[11px] text-[var(--text-muted)] font-[var(--font-mono)] truncate leading-none">
            {root}
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              showTimeline
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Clock size={12} />
            タイムライン
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="overflow-hidden flex flex-col shrink-0" style={{ width: treeWidth }}>
          <SearchBar onSelect={navigateTo} />
          <div className="flex-1 overflow-hidden">
            <TreeView
              entries={tree}
              selectedPath={selectedPath}
              onSelect={navigateTo}
            />
          </div>
        </div>

        <div
          className="w-1.5 hover:bg-[var(--brand-primary)] bg-[var(--border-default)] cursor-col-resize shrink-0 transition-colors duration-150"
          onMouseDown={startResize}
        />

        <div
          className="flex-1 border-l border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden flex flex-col"
        >
          {selectedPath ? (
            <DetailPanel
              filePath={selectedPath}
              fileRefs={fileRefs}
              folders={folders}
              onNavigate={navigateTo}
              onGoBack={goBack}
              onGoForward={goForward}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
            />
          ) : (
            <div className="p-6 text-[var(--text-muted)] text-sm flex items-center justify-center h-full">
              ファイルをクリックして内容を表示
            </div>
          )}
        </div>
      </div>

      {showTimeline && (
        <TimelinePanel
          onNavigate={(path) => { navigateTo(path); setShowTimeline(false); }}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </div>
  );
}
