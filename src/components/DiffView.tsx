"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/basePath";

interface Props {
  filePath: string;
  hash: string;
}

export function DiffView({ filePath, hash }: Props) {
  const [diff, setDiff] = useState<string | null>(null);

  useEffect(() => {
    setDiff(null);
    fetch(withBasePath(`/api/diff?path=${encodeURIComponent(filePath)}&hash=${hash}`))
      .then((r) => r.json())
      .then((data) => setDiff(data.diff))
      .catch(() => setDiff("(差分を取得できませんでした)"));
  }, [filePath, hash]);

  if (diff === null) {
    return <div className="text-[14px] text-[var(--text-muted)] py-2">差分を読み込み中...</div>;
  }

  return (
    <pre className="text-[12px] font-[var(--font-mono)] bg-[var(--bg-muted)] rounded-lg p-3 overflow-x-auto leading-[1.7] border border-[var(--border-default)]">
      {diff.split("\n").filter((line) =>
        !line.startsWith("diff --git") &&
        !line.startsWith("index ") &&
        !line.startsWith("new file") &&
        !line.startsWith("deleted file") &&
        !line.startsWith("similarity") &&
        !line.startsWith("rename ") &&
        !line.startsWith("old mode") &&
        !line.startsWith("new mode")
      ).map((line, i) => {
        let color = "var(--text-secondary)";
        let bg = "transparent";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          color = "var(--add-color)";
          bg = "var(--add-bg)";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          color = "var(--del-color)";
          bg = "var(--del-bg)";
        } else if (line.startsWith("@@")) {
          color = "var(--brand-primary)";
        }
        return (
          <div key={i} style={{ color, backgroundColor: bg }} className="px-1 -mx-1 rounded-sm">
            {line}
          </div>
        );
      })}
    </pre>
  );
}
