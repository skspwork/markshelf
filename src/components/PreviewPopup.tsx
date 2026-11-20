"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Markdown, FileRef } from "./Markdown";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";
import { ExternalLink } from "lucide-react";

interface Props {
  path: string | null;
  position: { x: number; y: number } | null;
  onNavigate: (path: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  fileRefs?: FileRef[];
  depth?: number;
}

const MAX_DEPTH = 4;

export function PreviewPopup({ path, position, onNavigate, onMouseEnter, onMouseLeave, fileRefs, depth = 0 }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);

  // Nested popup state
  const [nestedPath, setNestedPath] = useState<string | null>(null);
  const [nestedPos, setNestedPos] = useState<{ x: number; y: number } | null>(null);
  const nestedShowTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const nestedHideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    // Cancel any pending nested popup timers whenever path changes
    if (nestedShowTimer.current) clearTimeout(nestedShowTimer.current);
    if (nestedHideTimer.current) clearTimeout(nestedHideTimer.current);

    if (!path) {
      setContent(null);
      setNestedPath(null);
      setNestedPos(null);
      return;
    }
    setLoading(true);
    setContent(null);
    setNestedPath(null);
    setNestedPos(null);
    fetch(withBasePath(`/api/file?path=${encodeURIComponent(path)}`))
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [path, refreshTick]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!position || !popupRef.current) {
      setAdjustedPos(position);
      return;
    }
    const rect = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = position;

    if (x + rect.width > vw - 16) x = vw - rect.width - 16;
    if (x < 16) x = 16;
    if (y + rect.height > vh - 16) y = position.y - rect.height - 8;

    setAdjustedPos({ x, y });
  }, [position, content]);

  const handleNestedShow = useCallback((p: string, rect: DOMRect) => {
    if (depth >= MAX_DEPTH - 1) return;
    if (nestedHideTimer.current) clearTimeout(nestedHideTimer.current);
    if (nestedShowTimer.current) clearTimeout(nestedShowTimer.current);
    nestedShowTimer.current = setTimeout(() => {
      setNestedPath(p);
      setNestedPos({ x: rect.right + 8, y: rect.top });
    }, 200);
  }, [depth]);

  const handleNestedHide = useCallback(() => {
    if (nestedShowTimer.current) clearTimeout(nestedShowTimer.current);
    if (nestedHideTimer.current) clearTimeout(nestedHideTimer.current);
    nestedHideTimer.current = setTimeout(() => {
      setNestedPath(null);
      setNestedPos(null);
    }, 300);
  }, []);

  const handleNestedEnter = useCallback(() => {
    if (nestedHideTimer.current) clearTimeout(nestedHideTimer.current);
    // Propagate upward so the parent popup's close timer is also cancelled
    onMouseEnter();
  }, [onMouseEnter]);

  const handleNestedLeave = useCallback(() => {
    handleNestedHide();
    // Propagate upward so the parent chain starts closing too
    onMouseLeave();
  }, [handleNestedHide, onMouseLeave]);

  if (!path || !position) return null;

  const displayName = path.split("/").pop()?.replace(/\.md$/i, "") || path;

  return (
    <>
      <div
        ref={popupRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={() => {
          onMouseLeave();
          // Also hide nested if mouse leaves this popup entirely
          handleNestedHide();
        }}
        className="fixed bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl w-[min(480px,30vw)] max-h-[min(420px,30vh)] overflow-y-auto"
        style={{
          left: adjustedPos?.x ?? position.x,
          top: adjustedPos?.y ?? position.y,
          zIndex: 50 + depth,
        }}
      >
        <div className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => onNavigate(path)}
            className="text-[14px] font-medium text-[var(--brand-primary)] hover:underline truncate flex items-center gap-1"
          >
            {displayName}
            <ExternalLink size={10} />
          </button>
        </div>
        <div className="p-3">
          {loading ? (
            <div className="text-[12px] text-[var(--text-muted)]">読み込み中...</div>
          ) : content ? (
            <div className="text-[14px]">
              <Markdown
                fileRefs={fileRefs}
                currentPath={path}
                onNavigate={onNavigate}
                onPreviewShow={handleNestedShow}
                onPreviewHide={handleNestedHide}
              >{content}</Markdown>
            </div>
          ) : (
            <div className="text-[12px] text-[var(--text-muted)]">プレビューを表示できません</div>
          )}
        </div>
      </div>

      <PreviewPopup
        path={nestedPath}
        position={nestedPos}
        onNavigate={onNavigate}
        onMouseEnter={handleNestedEnter}
        onMouseLeave={handleNestedLeave}
        fileRefs={fileRefs}
        depth={depth + 1}
      />
    </>
  );
}
