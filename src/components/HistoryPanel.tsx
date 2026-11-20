"use client";

import { useEffect, useState } from "react";
import { GitCommit, ChevronDown, ChevronRight } from "lucide-react";
import { DiffView } from "./DiffView";
import { useRefreshTick } from "@/lib/useRefreshTick";
import { withBasePath } from "@/lib/basePath";

interface CommitEntry {
  hash: string;
  hashShort: string;
  date: string;
  message: string;
  author: string;
}

interface Props {
  filePath: string;
}

export function HistoryPanel({ filePath }: Props) {
  const [history, setHistory] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    setLoading(true);
    setExpandedHash(null);
    fetch(withBasePath(`/api/history?path=${encodeURIComponent(filePath)}`))
      .then((r) => r.json())
      .then((data) => {
        setHistory(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filePath, refreshTick]);

  if (loading) {
    return <div className="p-4 text-[var(--text-muted)] text-[14px]">読み込み中...</div>;
  }

  if (history.length === 0) {
    return <div className="p-4 text-[var(--text-muted)] text-[14px]">変更履歴がありません(git 管理外の可能性)</div>;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="divide-y divide-[var(--border-default)]">
      {history.map((commit) => {
        const isExpanded = expandedHash === commit.hash;
        return (
          <div key={commit.hash}>
            <button
              onClick={() => setExpandedHash(isExpanded ? null : commit.hash)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <GitCommit size={13} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-[var(--font-mono)] text-[var(--brand-primary)] leading-none">
                      {commit.hashShort}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)] leading-none">
                      {formatDate(commit.date)}
                    </span>
                    {commit.author && (
                      <span className="text-[12px] text-[var(--text-muted)] leading-none">
                        {commit.author}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-[var(--text-secondary)] mt-1 leading-snug line-clamp-2">
                    {commit.message}
                  </p>
                </div>
                <span className="text-[var(--text-muted)] shrink-0 mt-0.5">
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-3">
                <DiffView filePath={filePath} hash={commit.hash} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
