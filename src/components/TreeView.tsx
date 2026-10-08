"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Folder, FileText } from "lucide-react";

interface TreeEntry {
  name: string;
  displayName: string;
  path: string;
  type: "folder" | "file";
  children?: TreeEntry[];
  hasReadme?: boolean;
}

interface Props {
  entries: TreeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const EXPANDED_KEY = "markshelf:treeExpanded";

/** Collect all folder paths that are ancestors of targetPath */
function getAncestorPaths(entries: TreeEntry[], targetPath: string): Set<string> {
  const result = new Set<string>();

  function walk(items: TreeEntry[], ancestors: string[]): boolean {
    for (const item of items) {
      if (item.type === "file" && item.path === targetPath) {
        for (const a of ancestors) result.add(a);
        return true;
      }
      if (item.type === "folder") {
        // Check README match
        if (item.hasReadme && item.path + "/README.md" === targetPath) {
          for (const a of ancestors) result.add(a);
          return true;
        }
        if (item.children && walk(item.children, [...ancestors, item.path])) {
          return true;
        }
      }
    }
    return false;
  }

  walk(entries, []);
  return result;
}

export function TreeView({ entries, selectedPath, onSelect }: Props) {
  // Track which folders are expanded (by path). Hydrated from localStorage on mount.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  // Load saved state once on mount; if none, default to expanding top-level hasReadme folders.
  useEffect(() => {
    if (hydratedRef.current) return;
    const saved = localStorage.getItem(EXPANDED_KEY);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          setExpanded(new Set(arr.filter((s) => typeof s === "string")));
          hydratedRef.current = true;
          return;
        }
      } catch {
        /* ignore */
      }
    }
    // No saved state: expand top-level hasReadme folders as the default.
    if (entries.length > 0) {
      const initial = new Set<string>();
      for (const e of entries) {
        if (e.type === "folder" && e.hasReadme) initial.add(e.path);
      }
      setExpanded(initial);
      hydratedRef.current = true;
    }
  }, [entries]);

  // Persist expanded state to localStorage (only after hydration, to avoid overwriting with empty set).
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
  }, [expanded]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // When selectedPath changes, expand ancestors and scroll into view
  useEffect(() => {
    if (!selectedPath) return;

    const ancestors = getAncestorPaths(entries, selectedPath);
    if (ancestors.size > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const a of ancestors) next.add(a);
        return next;
      });
    }

    // Scroll after DOM update
    requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [selectedPath, entries]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto py-1 bg-[var(--bg-base)]">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          selectedPath={selectedPath}
          selectedRef={selectedRef}
          expanded={expanded}
          onToggle={toggleExpand}
          onSelect={onSelect}
        />
      ))}
      {entries.length === 0 && (
        <div className="text-[var(--text-muted)] text-[13px] p-4 text-center">
          マークダウンファイルが見つかりません
        </div>
      )}
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  selectedPath,
  selectedRef,
  expanded,
  onToggle,
  onSelect,
}: {
  entry: TreeEntry;
  depth: number;
  selectedPath: string | null;
  selectedRef: React.RefObject<HTMLDivElement | null>;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isFolder = entry.type === "folder" && !entry.hasReadme;
  const isExpanded = expanded.has(entry.path);
  const hasChildren = entry.type === "folder" && entry.children && entry.children.length > 0;
  const isSelected = entry.type === "file"
    ? selectedPath === entry.path
    : entry.hasReadme && selectedPath === entry.path + "/README.md";

  const handleClick = () => {
    if (entry.type === "folder" && entry.hasReadme) {
      onSelect(entry.path + "/README.md");
      // Expand children when clicking a collapsed README folder, but don't collapse when already expanded
      if (hasChildren && !isExpanded) onToggle(entry.path);
    } else if (isFolder) {
      onToggle(entry.path);
    } else {
      onSelect(entry.path);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(entry.path);
  };

  const indent = depth * 16 + 8;

  return (
    <>
      <div
        ref={isSelected ? selectedRef : undefined}
        onClick={handleClick}
        className={`
          flex items-center gap-1.5 cursor-pointer select-none
          h-7 pr-2 text-[12px] leading-none transition-colors
          ${isSelected
            ? "bg-[var(--brand-primary)]/10 text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }
        `}
        style={{ paddingLeft: indent }}
      >
        {hasChildren ? (
          <span
            onClick={handleChevronClick}
            className="shrink-0 text-[var(--text-muted)] w-4 flex items-center justify-center hover:text-[var(--text-primary)]"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="shrink-0 w-4" />
        )}
        {isFolder ? (
          <Folder size={14} className="shrink-0" style={{ color: "var(--folder-border)" }} />
        ) : (
          <FileText size={14} className="shrink-0" style={{ color: "var(--file-border)" }} />
        )}
        <span
          className={`truncate leading-normal ${
            isFolder ? "font-medium text-[var(--folder-text)]" : ""
          } ${isSelected ? "font-medium" : ""}`}
        >
          {entry.displayName}
        </span>
      </div>

      {entry.type === "folder" && isExpanded && entry.children && entry.children.length > 0 && (
        <>
          {entry.children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              selectedRef={selectedRef}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
}
