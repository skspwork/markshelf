"use client";

import { useEffect, useState } from "react";
import { GitCommit, FileText, ChevronDown, ChevronRight, X, Clock } from "lucide-react";
import { DiffView } from "./DiffView";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";

interface TimelineEntry {
  hash: string;
  hashShort: string;
  date: string;
  message: string;
  author: string;
  files: string[];
}

interface Props {
  onNavigate: (path: string) => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripPrefix(name: string): string {
  return name.replace(/^\d+[_\-.\s]/, "").replace(/\.md$/i, "");
}

export function TimelinePanel({ onNavigate, onClose }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<{ hash: string; file: string } | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    setLoading(true);
    fetch(withBasePath("/api/timeline"))
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshTick]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Group entries by date
  const grouped = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const dateKey = formatDate(e.date);
    const list = grouped.get(dateKey) ?? [];
    list.push(e);
    grouped.set(dateKey, list);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-lg shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-[var(--border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border-default)] shrink-0">
          <Clock size={14} className="text-[var(--brand-primary)]" />
          <h2 className="font-semibold text-[16px] text-[var(--text-primary)]">
            変更タイムライン
          </h2>
          <span className="text-[12px] text-[var(--text-muted)]">
            リポジトリ全体の変更履歴
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            title="閉じる (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-[14px] text-[var(--text-muted)]">
              タイムラインを読み込み中...
            </div>
          ) : entries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[14px] text-[var(--text-muted)]">
              変更履歴がありません
            </div>
          ) : (
            Array.from(grouped.entries()).map(([dateKey, dateEntries]) => (
        <div key={dateKey}>
          <div className="sticky top-0 z-10 bg-[var(--bg-base)] border-b border-[var(--border-default)] px-4 py-1.5">
            <span className="text-[12px] font-medium text-[var(--text-muted)] tracking-wide">
              {dateKey}
            </span>
          </div>

          {dateEntries.map((entry) => {
            const isExpanded = expandedHash === entry.hash;
            return (
              <div key={entry.hash} className="border-b border-[var(--border-default)]">
                <button
                  onClick={() => setExpandedHash(isExpanded ? null : entry.hash)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <GitCommit size={13} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-[var(--font-mono)] text-[var(--brand-primary)] leading-none">
                          {entry.hashShort}
                        </span>
                        <span className="text-[12px] text-[var(--text-muted)] leading-none">
                          {formatTime(entry.date)}
                        </span>
                        {entry.author && (
                          <span className="text-[12px] text-[var(--text-muted)] leading-none">
                            {entry.author}
                          </span>
                        )}
                      </div>
                      <p className="text-[14px] text-[var(--text-secondary)] mt-1 leading-snug line-clamp-2">
                        {entry.message}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[12px] text-[var(--text-muted)]">
                          {entry.files.length}件のドキュメント変更
                        </span>
                      </div>
                    </div>
                    <span className="text-[var(--text-muted)] shrink-0 mt-0.5">
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="space-y-1">
                      {entry.files.map((file) => {
                        const fileName = file.split("/").pop() || file;
                        const displayName = stripPrefix(fileName);
                        const isDiffExpanded =
                          expandedFile?.hash === entry.hash && expandedFile?.file === file;

                        return (
                          <div key={file}>
                            <div className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[var(--bg-muted)] group">
                              <button
                                onClick={() =>
                                  setExpandedFile(
                                    isDiffExpanded ? null : { hash: entry.hash, file },
                                  )
                                }
                                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              >
                                {isDiffExpanded ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                              </button>
                              <FileText
                                size={12}
                                className="shrink-0"
                                style={{ color: "var(--file-border)" }}
                              />
                              <button
                                onClick={() => onNavigate(file)}
                                className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] truncate text-left"
                                title={file}
                              >
                                {displayName}
                              </button>
                              <span className="text-[12px] text-[var(--text-muted)] truncate ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                {file}
                              </span>
                            </div>
                            {isDiffExpanded && (
                              <div className="ml-6 mt-1 mb-2">
                                <DiffView filePath={file} hash={entry.hash} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
