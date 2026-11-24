"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import mermaid from "mermaid";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

// ---- Layout preference ----------------------------------------------------
// Mermaid 12 changed the default layout engine from dagre to ELK. Users can
// pick the engine from the zoom modal; the choice is shared by every diagram
// on the page and persisted in localStorage.
const LAYOUTS = [
  { value: "elk", label: "ELK", title: "ELK レイアウト（Mermaid 12 の標準）" },
  { value: "dagre", label: "dagre", title: "dagre レイアウト（Mermaid 11 以前の標準）" },
] as const;
type MermaidLayout = (typeof LAYOUTS)[number]["value"];
const DEFAULT_LAYOUT: MermaidLayout = "elk";

const LAYOUT_KEY = "markshelf:mermaidLayout";
const layoutListeners = new Set<() => void>();
let layoutOverride: MermaidLayout | null = null;

function readLayout(): MermaidLayout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    return LAYOUTS.some((l) => l.value === saved) ? (saved as MermaidLayout) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function setLayout(value: MermaidLayout) {
  try {
    if (value === DEFAULT_LAYOUT) localStorage.removeItem(LAYOUT_KEY);
    else localStorage.setItem(LAYOUT_KEY, value);
  } catch {
    // storage unavailable: keep the in-memory choice working for this page
  }
  layoutOverride = value;
  layoutListeners.forEach((l) => l());
}

function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LAYOUT_KEY) {
      layoutOverride = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    layoutListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useMermaidLayout(): MermaidLayout {
  return useSyncExternalStore(
    subscribeLayout,
    () => layoutOverride ?? readLayout(),
    () => DEFAULT_LAYOUT,
  );
}

// ---- Rendering ------------------------------------------------------------
// mermaid.initialize() is global, so (re)initialize and render inside one
// serialized queue to keep each diagram's settings from leaking into another.
let renderQueue: Promise<unknown> = Promise.resolve();
let renderSeq = 0;

/**
 * Each render gets a fresh element id: re-rendering (e.g. after switching the
 * layout) while an SVG with the same id is still in the DOM makes Mermaid
 * measure the wrong element and emit an empty diagram.
 */
function renderDiagram(code: string, layout: MermaidLayout) {
  const id = `mermaid-${++renderSeq}`;
  const job = renderQueue.then(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "system-ui, sans-serif",
      // A top-level layout would also override swimlane diagrams, which need
      // their own engine, so pin that one back.
      ...(layout === DEFAULT_LAYOUT ? {} : { layout, swimlane: { layout: "swimlane" } }),
    });
    return mermaid.render(id, code).catch((e) => {
      // Clean up any error element mermaid might have injected
      document.getElementById("d" + id)?.remove();
      throw e;
    });
  });
  renderQueue = job.catch(() => undefined);
  return job;
}

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const layout = useMermaidLayout();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { svg: rendered } = await renderDiagram(code, layout);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mermaid render error");
          setSvg(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code, layout]);

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded p-3 text-[12px] text-red-700">
        <div className="font-medium mb-1">Mermaid エラー</div>
        <pre className="whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  // Mermaid emits width="100%" + style="max-width: Npx"; N is the diagram's
  // natural width, which the reader layout needs to size the block.
  const naturalWidth = svg ? Number(/max-width:\s*([\d.]+)px/.exec(svg)?.[1]) || null : null;

  if (!svg) {
    return (
      <div className="text-[12px] text-[var(--text-muted)] py-2">図を描画中...</div>
    );
  }

  return (
    <>
      <div
        className="md-mermaid my-2"
        style={naturalWidth ? ({ "--mermaid-w": `${naturalWidth}px` } as CSSProperties) : undefined}
      >
        <div
          ref={containerRef}
          className="overflow-x-auto cursor-zoom-in"
          title="クリックで拡大表示"
          onClick={() => setExpanded(true)}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      {expanded && (
        <MermaidModal
          svg={svg}
          layout={layout}
          onLayoutChange={setLayout}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Read the diagram's intrinsic size from its viewBox (falls back to the bbox). */
function naturalSize(svgEl: SVGSVGElement): { w: number; h: number } {
  const vb = svgEl.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height };
  const r = svgEl.getBoundingClientRect();
  return { w: r.width || 800, h: r.height || 600 };
}

function MermaidModal({
  svg,
  layout,
  onLayoutChange,
  onClose,
}: {
  svg: string;
  layout: MermaidLayout;
  onLayoutChange: (layout: MermaidLayout) => void;
  onClose: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [initialScale, setInitialScale] = useState(1);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Measure the diagram and pick a readable starting scale: fill the modal
  // width for small diagrams, but never shrink below native size.
  useLayoutEffect(() => {
    const svgEl = contentRef.current?.querySelector("svg");
    const viewport = viewportRef.current;
    if (!svgEl || !viewport) return;
    const size = naturalSize(svgEl);
    sizeRef.current = size;
    const pad = 48;
    const fitW = (viewport.clientWidth - pad) / size.w;
    const fitH = (viewport.clientHeight - pad) / size.h;
    const fit = Math.min(fitW, fitH);
    const s = clampScale(fit >= 1 ? Math.min(fit, 2) : 1);
    setInitialScale(s);
    setScale(s);
  }, [svg]);

  // Apply the scale by sizing the SVG explicitly so it stays crisp.
  useLayoutEffect(() => {
    const svgEl = contentRef.current?.querySelector("svg");
    const size = sizeRef.current;
    if (!svgEl || !size) return;
    svgEl.style.maxWidth = "none";
    svgEl.setAttribute("width", String(size.w * scale));
    svgEl.setAttribute("height", String(size.h * scale));
  }, [scale, svg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setScale((s) => clampScale(s * 1.2));
      else if (e.key === "-") setScale((s) => clampScale(s / 1.2));
      else if (e.key === "0") setScale(initialScale);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, initialScale]);

  // Ctrl/⌘ + wheel zooms (non-passive so we can prevent the browser zoom).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => clampScale(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    setDragging(true);
    viewport.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const viewport = viewportRef.current;
    if (!d || !viewport) return;
    viewport.scrollLeft = d.left - (e.clientX - d.x);
    viewport.scrollTop = d.top - (e.clientY - d.y);
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  const btn =
    "p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid 図の拡大表示"
    >
      <div
        className="bg-[var(--bg-surface)] rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden border border-[var(--border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)] shrink-0">
          <span className="text-[12px] text-[var(--text-muted)] mr-2">
            ドラッグで移動 / Ctrl+ホイールで拡大縮小
          </span>
          <button className={btn} onClick={() => setScale((s) => clampScale(s / 1.2))} title="縮小 (-)">
            <Minus size={16} />
          </button>
          <span className="text-[12px] tabular-nums w-12 text-center text-[var(--text-secondary)]">
            {Math.round(scale * 100)}%
          </span>
          <button className={btn} onClick={() => setScale((s) => clampScale(s * 1.2))} title="拡大 (+)">
            <Plus size={16} />
          </button>
          <button className={btn} onClick={() => setScale(initialScale)} title="リセット (0)">
            <RotateCcw size={14} />
          </button>
          <div className="ml-3 flex items-center gap-1" role="radiogroup" aria-label="レイアウト">
            <span className="text-[12px] text-[var(--text-muted)]">レイアウト</span>
            <div className="flex rounded border border-[var(--border-default)] overflow-hidden">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={layout === l.value}
                  className={`px-2 py-0.5 text-[12px] transition-colors ${
                    layout === l.value
                      ? "bg-[var(--bg-muted)] text-[var(--text-secondary)] font-medium"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  onClick={() => onLayoutChange(l.value)}
                  title={l.title}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <button className={`${btn} ml-auto`} onClick={onClose} title="閉じる (Esc)">
            <X size={16} />
          </button>
        </div>
        <div
          ref={viewportRef}
          className={`flex-1 overflow-auto select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* min-w/min-h + m-auto centers small diagrams while keeping large ones scrollable from the top-left */}
          <div className="min-w-full min-h-full flex p-6">
            <div ref={contentRef} className="m-auto" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
