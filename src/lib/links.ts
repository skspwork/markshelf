import type { FileRef } from "./docs";
import { stripFencedCode } from "./markdown";

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface LinkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Matches markdown link `[label](url)` excluding image syntax `![...]`.
// The leading capture group absorbs a non-"!" char (or string start) to avoid
// matching image links.
const LINK_RE = /(^|[^!])\[([^\]]*)\]\(([^)]+)\)/g;
// Inline code `...`
const INLINE_CODE_RE = /`[^`\n]*`/g;

function stripCode(content: string): string {
  return stripFencedCode(content).replace(INLINE_CODE_RE, "");
}

function resolveLink(
  currentPath: string,
  rawUrl: string,
  fileSet: Set<string>,
): string | null {
  const cleanUrl = rawUrl.split("#")[0].split("?")[0].trim();
  if (!cleanUrl) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanUrl)) return null;
  if (cleanUrl.startsWith("//")) return null;

  let decoded: string;
  try {
    decoded = decodeURI(cleanUrl);
  } catch {
    decoded = cleanUrl;
  }

  const currentDir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/"))
    : "";
  const joined = decoded.startsWith("/")
    ? decoded.slice(1)
    : currentDir
      ? currentDir + "/" + decoded
      : decoded;

  const parts = joined.split("/");
  const normalized: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(p);
  }
  const resolved = normalized.join("/");
  if (!resolved) return null;

  if (fileSet.has(resolved)) return resolved;
  if (fileSet.has(resolved + "/README.md")) return resolved + "/README.md";
  if (!/\.md$/i.test(resolved) && fileSet.has(resolved + ".md")) return resolved + ".md";
  return null;
}

export function buildLinkGraph(
  files: FileRef[],
  readFile: (path: string) => string | null,
): LinkGraph {
  const filtered = files
    .filter((f) => f.displayName.length > 2)
    .sort((a, b) => b.displayName.length - a.displayName.length);

  const fileSet = new Set(files.map((f) => f.path));
  const nameToPath = new Map<string, string>();
  for (const f of filtered) {
    nameToPath.set(f.displayName, f.path);
  }

  const displayNameRegex =
    filtered.length === 0
      ? null
      : new RegExp(
          `(${filtered
            .map((f) => f.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")})`,
          "g",
        );

  const edgeSet = new Set<string>();
  const referencedPaths = new Set<string>();

  const addEdge = (source: string, target: string) => {
    if (target === source) return;
    const key = `${source}\0${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    referencedPaths.add(source);
    referencedPaths.add(target);
  };

  for (const file of files) {
    const raw = readFile(file.path);
    if (!raw) continue;
    let content = stripCode(raw);

    // 1) Explicit markdown links: resolve URL → add edge, then strip (url) portion
    //    so URL path segments don't create spurious displayName matches.
    content = content.replace(LINK_RE, (_m, lead, label, url) => {
      const target = resolveLink(file.path, url, fileSet);
      if (target) addEdge(file.path, target);
      return `${lead}[${label}]`;
    });

    // 2) DisplayName auto-matching on the stripped content
    if (displayNameRegex) {
      displayNameRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = displayNameRegex.exec(content)) !== null) {
        const targetPath = nameToPath.get(match[0]);
        if (!targetPath) continue;
        addEdge(file.path, targetPath);
      }
    }
  }

  const nodes: GraphNode[] = files
    .filter((f) => referencedPaths.has(f.path))
    .map((f) => ({ id: f.path, label: f.displayName }));

  const edges: GraphEdge[] = Array.from(edgeSet).map((key) => {
    const [source, target] = key.split("\0");
    return { source, target };
  });

  return { nodes, edges };
}

// ---- In-memory cache ----

let cachedGraph: LinkGraph | null = null;
let cachedSignature: string | null = null;

function computeSignature(
  files: FileRef[],
  statFile: (path: string) => number | null,
): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const parts: string[] = [];
  for (const f of sorted) {
    const mtime = statFile(f.path) ?? 0;
    parts.push(`${f.path}\0${mtime}\0${f.displayName}`);
  }
  return parts.join("\n");
}

export function getCachedLinkGraph(
  files: FileRef[],
  readFile: (path: string) => string | null,
  statFile: (path: string) => number | null,
): LinkGraph {
  const signature = computeSignature(files, statFile);
  if (cachedGraph && cachedSignature === signature) {
    return cachedGraph;
  }
  const graph = buildLinkGraph(files, readFile);
  cachedGraph = graph;
  cachedSignature = signature;
  return graph;
}
