"use client";

import { useEffect, useState, useCallback, useRef } from "react";

import type { HeadingInfo } from "@/lib/markdown";

export type { HeadingInfo };

interface Props {
  headings: HeadingInfo[];
  scrollContainer?: HTMLElement | null;
}

export function TableOfContents({ headings, scrollContainer }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!scrollContainer || headings.length === 0) return;

    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { root: scrollContainer, rootMargin: "0px 0px -70% 0px", threshold: 0.1 },
    );
    observerRef.current = observer;

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings, scrollContainer]);

  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveId(id);
        // Reflect the section in the URL hash so the address bar stays a
        // shareable deep link (?file=...#heading-id) without adding history.
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.hash = id;
          window.history.replaceState(null, "", url.toString());
        }
      }
    },
    [],
  );

  if (headings.length === 0) return null;

  return (
    <nav className="py-3 px-2 space-y-px">
      <div className="text-[10px] font-medium text-[var(--text-muted)] tracking-wider uppercase px-1.5 mb-1.5">
        目次
      </div>
      {headings.map((h) => (
        <button
          key={h.id}
          onClick={() => handleClick(h.id)}
          className={`block w-full text-left text-[11px] leading-relaxed py-0.5 truncate transition-colors rounded px-1.5 ${
            activeId === h.id
              ? "text-[var(--brand-primary)] font-medium bg-blue-50"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }`}
          style={{ paddingLeft: `${(h.level - 1) * 10 + 6}px` }}
          title={h.text}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
