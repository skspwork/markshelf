"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import { withBasePath } from "@/lib/basePath";

interface SearchMatch {
  line: number;
  text: string;
}

interface SearchResult {
  path: string;
  displayName: string;
  matches: SearchMatch[];
}

interface Props {
  onSelect: (path: string) => void;
}

export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsSearching(true);
    fetch(withBasePath(`/api/search?q=${encodeURIComponent(q.trim())}`))
      .then((r) => r.json())
      .then((data) => {
        setResults(data.results ?? []);
        setIsOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setIsSearching(false));
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (path: string) => {
    onSelect(path);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative px-4 pt-4 pb-2">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="ドキュメントを検索..."
          className="w-full pl-8 pr-8 py-1.5 text-[14px] leading-normal rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] transition-shadow"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-1 z-40 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="p-3 text-[12px] text-[var(--text-muted)] text-center">
              検索中...
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-[12px] text-[var(--text-muted)] text-center">
              該当するドキュメントが見つかりません
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.path}
                onClick={() => handleSelect(r.path)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] border-b border-[var(--border-default)] last:border-b-0 transition-colors"
              >
                <div className="text-[14px] font-medium text-[var(--text-primary)] truncate leading-snug">
                  {r.displayName}
                </div>
                <div className="text-[12px] text-[var(--text-muted)] font-[var(--font-mono)] truncate mb-1 leading-normal">
                  {r.path}
                </div>
                {r.matches.slice(0, 2).map((m) => (
                  <div
                    key={m.line}
                    className="text-[12px] text-[var(--text-secondary)] truncate leading-relaxed"
                  >
                    <span className="text-[var(--text-muted)] mr-1">L{m.line}</span>
                    <HighlightMatch text={m.text} query={query} />
                  </div>
                ))}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <span className="bg-yellow-200 text-yellow-900 rounded px-0.5">{match}</span>
      {after}
    </>
  );
}
