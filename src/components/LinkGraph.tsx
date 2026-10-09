"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";
import { Filter } from "lucide-react";

cytoscape.use(fcose);

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface FolderInfo {
  path: string;
  displayName: string;
  depth: number;
}

interface Props {
  currentPath: string;
  folders: FolderInfo[];
  onNavigate: (path: string) => void;
  onPreviewShow?: (path: string, rect: DOMRect) => void;
  onPreviewHide?: () => void;
}

const DEPTH_KEY = "markshelf:linkGraphDepth";
const EXCLUDE_KEY = "markshelf:linkGraphExclude";
const ZOOM_KEY = "markshelf:linkGraphZoom";
const DEPTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1階層" },
  { value: 2, label: "2階層" },
  { value: 3, label: "3階層" },
  { value: Infinity, label: "全階層" },
];

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  // mulberry32
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function LinkGraph({ currentPath, folders, onNavigate, onPreviewShow, onPreviewHide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [ready, setReady] = useState(false);
  const [depth, setDepth] = useState<number>(1);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    const saved = localStorage.getItem(DEPTH_KEY);
    if (saved === null) return;
    const v = saved === "all" ? Infinity : Number(saved);
    if (Number.isFinite(v) || v === Infinity) setDepth(v);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(EXCLUDE_KEY);
    if (!saved) return;
    try {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) setExcluded(arr.filter((s) => typeof s === "string"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (folders.length === 0) return;
    const valid = new Set(folders.map((f) => f.path));
    setExcluded((prev) => {
      const next = prev.filter((p) => valid.has(p));
      if (next.length === prev.length) return prev;
      localStorage.setItem(EXCLUDE_KEY, JSON.stringify(next));
      return next;
    });
  }, [folders]);

  useEffect(() => {
    if (!showFilter) return;
    const onClick = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showFilter]);

  const changeDepth = (d: number) => {
    setDepth(d);
    localStorage.setItem(DEPTH_KEY, d === Infinity ? "all" : String(d));
  };

  const toggleExclude = (folderPath: string) => {
    setExcluded((prev) => {
      const next = prev.includes(folderPath)
        ? prev.filter((p) => p !== folderPath)
        : [...prev, folderPath];
      localStorage.setItem(EXCLUDE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isPathExcluded = useMemo(() => {
    const prefixes = excluded.map((f) => f + "/");
    const currentExcluded = excluded.some(
      (f) => currentPath === f || currentPath.startsWith(f + "/"),
    );
    return (p: string): boolean => {
      if (currentExcluded) return false;
      if (p === currentPath) return false;
      return prefixes.some((pre) => p.startsWith(pre));
    };
  }, [excluded, currentPath]);

  // Latest-callback refs to keep Cytoscape handlers without re-initializing on parent re-renders
  const onNavigateRef = useRef(onNavigate);
  const onPreviewShowRef = useRef(onPreviewShow);
  const onPreviewHideRef = useRef(onPreviewHide);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onPreviewShowRef.current = onPreviewShow;
    onPreviewHideRef.current = onPreviewHide;
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setEmpty(false);
    setReady(false);

    fetch(withBasePath("/api/graph"))
      .then((r) => r.json())
      .then((data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        if (cancelled || !containerRef.current) return;

        // Apply folder exclusion filter
        const filteredNodes = data.nodes.filter((n) => !isPathExcluded(n.id));
        const filteredEdges = data.edges.filter(
          (e) => !isPathExcluded(e.source) && !isPathExcluded(e.target),
        );

        // Show only nodes reachable from currentPath (undirected connected component)
        const adj = new Map<string, string[]>();
        for (const e of filteredEdges) {
          (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target);
          (adj.get(e.target) ?? adj.set(e.target, []).get(e.target)!).push(e.source);
        }
        const connectedPaths = new Set<string>([currentPath]);
        const queue: [string, number][] = [[currentPath, 0]];
        while (queue.length > 0) {
          const [cur, lvl] = queue.shift()!;
          if (lvl >= depth) continue;
          for (const nb of adj.get(cur) ?? []) {
            if (!connectedPaths.has(nb)) {
              connectedPaths.add(nb);
              queue.push([nb, lvl + 1]);
            }
          }
        }

        const localNodes = filteredNodes.filter((n) => connectedPaths.has(n.id));
        const localEdges = filteredEdges.filter(
          (e) => connectedPaths.has(e.source) && connectedPaths.has(e.target),
        );

        // Merge A→B and B→A into a single bidirectional edge
        const edgeKeys = new Set(localEdges.map((e) => `${e.source}\0${e.target}`));
        const seenPairs = new Set<string>();
        const displayEdges: { source: string; target: string; mutual: boolean }[] = [];
        for (const e of localEdges) {
          const pairKey = e.source < e.target ? `${e.source}\0${e.target}` : `${e.target}\0${e.source}`;
          const mutual = edgeKeys.has(`${e.target}\0${e.source}`);
          const dedupeKey = mutual ? pairKey : `${e.source}\0${e.target}`;
          if (seenPairs.has(dedupeKey)) continue;
          seenPairs.add(dedupeKey);
          displayEdges.push({ source: e.source, target: e.target, mutual });
        }

        if (localNodes.length === 0) {
          setEmpty(true);
          setLoading(false);
          return;
        }

        // Destroy previous instance
        cyRef.current?.destroy();

        // fcose uses Math.random; seed it so the layout is stable across refreshes
        const originalRandom = Math.random;
        Math.random = seededRandom(currentPath);
        let cy: cytoscape.Core;
        try {
          cy = cytoscape({
            container: containerRef.current,
            elements: [
              ...localNodes.map((n) => ({
                data: {
                  id: n.id,
                  label: n.label,
                  isCurrent: n.id === currentPath,
                },
              })),
              ...displayEdges.map((e, i) => ({
                data: {
                  id: `e${i}`,
                  source: e.source,
                  target: e.target,
                  mutual: e.mutual,
                },
              })),
            ],
            style: [
              {
                selector: "node",
                style: {
                  label: "data(label)",
                  "text-valign": "bottom",
                  "text-halign": "center",
                  "font-size": "11px",
                  "font-family": "var(--font-sans)",
                  color: "#4a5060",
                  "text-margin-y": 6,
                  "background-color": "#e8f0fe",
                  "border-width": 2,
                  "border-color": "#3b7ddb",
                  width: 28,
                  height: 28,
                  "text-max-width": "180px",
                  "text-wrap": "ellipsis",
                  "cursor": "pointer",
                } as cytoscape.Css.Node,
              },
              {
                selector: "node[?isCurrent]",
                style: {
                  "background-color": "#2563eb",
                  "border-color": "#1d4ed8",
                  color: "#1a1d23",
                  "font-weight": "bold" as const,
                  width: 36,
                  height: 36,
                } as cytoscape.Css.Node,
              },
              {
                selector: "edge",
                style: {
                  width: 1.5,
                  "line-color": "#c8ccd3",
                  "target-arrow-color": "#c8ccd3",
                  "target-arrow-shape": "triangle",
                  "curve-style": "bezier",
                  "arrow-scale": 0.8,
                } as cytoscape.Css.Edge,
              },
              {
                selector: "edge[?mutual]",
                style: {
                  width: 2,
                  "line-color": "#8fb0e8",
                  "target-arrow-color": "#8fb0e8",
                  "source-arrow-color": "#8fb0e8",
                  "source-arrow-shape": "triangle",
                } as cytoscape.Css.Edge,
              },
              {
                selector: "node:active",
                style: {
                  "overlay-opacity": 0,
                } as cytoscape.Css.Node,
              },
            ],
            layout: {
              name: "fcose",
              animate: false,
              randomize: true,
              quality: "proof",
              padding: 50,
              nodeDimensionsIncludeLabels: true,
              idealEdgeLength: 120,
              nodeRepulsion: 12000,
              nodeSeparation: 100,
            } as cytoscape.LayoutOptions,
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: false,
            autoungrabify: false,
          });
        } finally {
          Math.random = originalRandom;
        }

        // Defer fit/center until container has layout dimensions
        requestAnimationFrame(() => {
          cy.resize();
          const savedZoom = Number(localStorage.getItem(ZOOM_KEY));
          if (Number.isFinite(savedZoom) && savedZoom > 0) {
            cy.zoom({
              level: savedZoom,
              renderedPosition: {
                x: containerRef.current!.clientWidth / 2,
                y: containerRef.current!.clientHeight / 2,
              },
            });
          } else {
            cy.fit(undefined, 50);
            if (cy.zoom() > 0.9) {
              cy.zoom({
                level: 0.9,
                renderedPosition: {
                  x: containerRef.current!.clientWidth / 2,
                  y: containerRef.current!.clientHeight / 2,
                },
              });
            }
          }
          cy.center(cy.nodes("[?isCurrent]"));
          setReady(true);
        });

        // Persist zoom level on user interaction (debounced)
        let zoomWriteTimer: ReturnType<typeof setTimeout> | null = null;
        cy.on("zoom", () => {
          if (zoomWriteTimer) clearTimeout(zoomWriteTimer);
          zoomWriteTimer = setTimeout(() => {
            localStorage.setItem(ZOOM_KEY, String(cy.zoom()));
          }, 200);
        });

        // Hover effects
        cy.on("mouseover", "node", (e) => {
          const node = e.target;
          if (!node.data("isCurrent")) {
            node.style({
              "background-color": "#dbeafe",
              "border-color": "#2563eb",
              color: "#1a1d23",
            });
          }
          containerRef.current!.style.cursor = "pointer";

          const path = node.id();
          if (onPreviewShowRef.current && containerRef.current) {
            const bb = node.renderedBoundingBox();
            const cRect = containerRef.current.getBoundingClientRect();
            const left = cRect.left + bb.x1;
            const top = cRect.top + bb.y1;
            const rect = {
              left,
              top,
              right: cRect.left + bb.x2,
              bottom: cRect.top + bb.y2,
              width: bb.w,
              height: bb.h,
              x: left,
              y: top,
              toJSON: () => ({}),
            } as DOMRect;
            onPreviewShowRef.current(path, rect);
          }
        });

        cy.on("mouseout", "node", (e) => {
          const node = e.target;
          if (!node.data("isCurrent")) {
            node.style({
              "background-color": "#e8f0fe",
              "border-color": "#3b7ddb",
              color: "#4a5060",
            });
          }
          containerRef.current!.style.cursor = "default";
          onPreviewHideRef.current?.();
        });

        // Click to navigate
        cy.on("tap", "node", (e) => {
          const path = e.target.id();
          if (path !== currentPath) {
            onNavigateRef.current(path);
          }
        });

        cyRef.current = cy;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setEmpty(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [currentPath, depth, isPathExcluded, refreshTick]);

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
        <span className="text-[11px] text-[var(--text-muted)] mr-1">表示範囲</span>
        {DEPTH_OPTIONS.map((opt) => {
          const active = depth === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => changeDepth(opt.value)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                active
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <div className="ml-auto relative" ref={filterPopoverRef}>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              excluded.length > 0
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            }`}
            title="フォルダを除外"
          >
            <Filter size={11} />
            除外
            {excluded.length > 0 && <span className="ml-0.5">({excluded.length})</span>}
          </button>
          {showFilter && (
            <div className="absolute right-0 top-full mt-1 w-56 max-h-72 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md shadow-lg z-20 py-1">
              {folders.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  フォルダがありません
                </div>
              ) : (
                folders.map((f) => {
                  const checked = excluded.includes(f.path);
                  return (
                    <label
                      key={f.path}
                      className="flex items-center gap-2 px-3 py-1 text-[12px] cursor-pointer hover:bg-[var(--bg-muted)]"
                      style={{ paddingLeft: `${12 + f.depth * 12}px` }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExclude(f.path)}
                        className="shrink-0"
                      />
                      <span className="truncate text-[var(--text-secondary)]">{f.displayName}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      {(loading || empty) && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[var(--text-muted)] z-10 bg-[var(--bg-surface)]">
          {loading ? "グラフを構築中..." : "このドキュメントへのリンクはありません"}
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 transition-opacity duration-150"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
