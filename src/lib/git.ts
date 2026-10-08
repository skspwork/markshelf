import path from "path";
import { simpleGit, type LogResult, type DefaultLogFields } from "simple-git";
import { getDocsRoot } from "./docs";

function getGit() {
  return simpleGit(getDocsRoot());
}

/** Get the docs root path relative to the git repository root, with forward slashes. Returns "" if they are the same. */
async function getDocsPrefix(): Promise<string> {
  const git = getGit();
  const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
  const docsRoot = path.resolve(getDocsRoot());
  const rel = path.relative(repoRoot, docsRoot).replace(/\\/g, "/");
  return rel === "." ? "" : rel;
}

export interface CommitEntry {
  hash: string;
  hashShort: string;
  date: string;
  message: string;
  author: string;
}

export async function getFileHistory(relPath: string, maxCount = 30): Promise<CommitEntry[]> {
  const git = getGit();
  try {
    const log: LogResult<DefaultLogFields> = await git.log({
      file: relPath,
      maxCount,
    });
    return log.all.map((entry) => ({
      hash: entry.hash,
      hashShort: entry.hash.slice(0, 7),
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
    }));
  } catch {
    return [];
  }
}

export interface TimelineEntry {
  hash: string;
  hashShort: string;
  date: string;
  message: string;
  author: string;
  files: string[]; // changed .md file paths relative to docs root
}

export async function getTimeline(maxCount = 100): Promise<TimelineEntry[]> {
  const git = getGit();
  try {
    const prefix = await getDocsPrefix();
    // git is invoked with cwd = docsRoot, so the pathspec must be cwd-relative.
    // Default pathspec wildcards match "/" as well, so "*.md" covers all depths.
    const DELIM = "---COMMIT_BOUNDARY---";
    const log = await git.raw([
      "-c", "core.quotePath=false",
      "log",
      `--max-count=${maxCount}`,
      `--format=${DELIM}%n%H%n%h%n%aI%n%s%n%an`,
      "--name-only",
      "--diff-filter=ACDMR",
      "--", "*.md",
    ]);

    const entries: TimelineEntry[] = [];
    const blocks = log.split(DELIM).filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.trim().split("\n").filter((l) => l.length > 0);
      if (lines.length < 5) continue;

      const [hash, hashShort, date, message, author, ...fileLines] = lines;
      // Strip the docs prefix from file paths so they are relative to MARKSHELF_ROOT
      const files = fileLines
        .filter((f) => f.endsWith(".md"))
        .map((f) => (prefix && f.startsWith(prefix + "/") ? f.slice(prefix.length + 1) : f));
      if (files.length === 0) continue;

      entries.push({ hash, hashShort, date, message, author, files });
    }

    return entries;
  } catch {
    return [];
  }
}

export async function getFileDiff(relPath: string, hash: string): Promise<string> {
  const git = getGit();
  try {
    const diff = await git.diff([`${hash}~1`, hash, "--", relPath]);
    return diff || "(差分なし)";
  } catch {
    // First commit case - show the whole file at that commit
    try {
      const content = await git.show([`${hash}:${relPath}`]);
      return `+++ ${relPath}\n` + content.split("\n").map((l) => `+ ${l}`).join("\n");
    } catch {
      return "(差分を取得できませんでした)";
    }
  }
}
