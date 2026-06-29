import fs from "fs";
import path from "path";

const DOCS_ROOT = process.env.MARKSHELF_ROOT || process.cwd();

const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".turbo"]);
const MD_EXT = /\.md$/i;
const ORDER_PREFIX = /^(\d+)[_\-.\s]/;

export interface TreeEntry {
  name: string;
  displayName: string;
  path: string; // relative to DOCS_ROOT
  type: "folder" | "file";
  children?: TreeEntry[];
  hasReadme?: boolean;
}

export function stripOrderPrefix(name: string): string {
  return name.replace(ORDER_PREFIX, "");
}

export function sortByPrefix(a: string, b: string): number {
  const aMatch = a.match(ORDER_PREFIX);
  const bMatch = b.match(ORDER_PREFIX);
  if (aMatch && bMatch) return Number(aMatch[1]) - Number(bMatch[1]);
  if (aMatch) return -1;
  if (bMatch) return 1;
  return a.localeCompare(b, "ja");
}

export function buildTree(dirPath: string = DOCS_ROOT, relativeTo: string = DOCS_ROOT): TreeEntry[] {
  const entries: TreeEntry[] = [];

  // At root: include README.md as a virtual top entry
  if (dirPath === relativeTo) {
    const rootReadme = path.join(dirPath, "README.md");
    if (fs.existsSync(rootReadme)) {
      entries.push({
        name: "README.md",
        displayName: path.basename(dirPath),
        path: "README.md",
        type: "file",
      });
    }
  }

  let items: string[];
  try {
    items = fs.readdirSync(dirPath);
  } catch {
    return [];
  }

  items.sort(sortByPrefix);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, "/");

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(item) || item.startsWith(".")) continue;
      const children = buildTree(fullPath, relativeTo);
      const hasReadme = fs.existsSync(path.join(fullPath, "README.md"));
      // Skip folders with no markdown content (no children and no README)
      if (children.length === 0 && !hasReadme) continue;
      entries.push({
        name: item,
        displayName: stripOrderPrefix(item),
        path: relPath,
        type: "folder",
        children,
        hasReadme,
      });
    } else if (MD_EXT.test(item)) {
      // Skip README.md as standalone entry (it's attached to the folder)
      if (item.toLowerCase() === "readme.md") continue;
      entries.push({
        name: item,
        displayName: stripOrderPrefix(item).replace(MD_EXT, ""),
        path: relPath,
        type: "file",
      });
    }
  }

  return entries;
}

export function readFile(relPath: string): string | null {
  const fullPath = path.resolve(DOCS_ROOT, relPath);
  // Prevent path traversal (resolve both to normalise separators on Windows)
  if (!fullPath.startsWith(path.resolve(DOCS_ROOT))) return null;
  try {
    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return null;
  }
}

export function readAsset(relPath: string): Buffer | null {
  const fullPath = path.resolve(DOCS_ROOT, relPath);
  if (!fullPath.startsWith(path.resolve(DOCS_ROOT))) return null;
  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;
    return fs.readFileSync(fullPath);
  } catch {
    return null;
  }
}

export function statFile(relPath: string): number | null {
  const fullPath = path.resolve(DOCS_ROOT, relPath);
  if (!fullPath.startsWith(path.resolve(DOCS_ROOT))) return null;
  try {
    return fs.statSync(fullPath).mtimeMs;
  } catch {
    return null;
  }
}

export interface FileRef {
  path: string;
  displayName: string;
}

export function flattenTree(entries: TreeEntry[]): FileRef[] {
  const refs: FileRef[] = [];
  for (const e of entries) {
    if (e.type === "file") {
      refs.push({ path: e.path, displayName: e.displayName });
    }
    if (e.type === "folder") {
      if (e.hasReadme) {
        refs.push({ path: e.path + "/README.md", displayName: e.displayName });
      }
      if (e.children) {
        refs.push(...flattenTree(e.children));
      }
    }
  }
  return refs;
}

export function getDocsRoot(): string {
  return DOCS_ROOT;
}
