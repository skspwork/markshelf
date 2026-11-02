import { NextRequest, NextResponse } from "next/server";
import { readAsset } from "@/lib/docs";

// Serves files by path (not ?path=) so that relative references inside an
// HTML document (style.css, img/a.png, ...) resolve against this route.
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path ?? [];
  const filePath = segments.map((s) => decodeURIComponent(s)).join("/");

  const dot = filePath.lastIndexOf(".");
  const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : "";
  const contentType = MIME[ext];
  if (!contentType) {
    return NextResponse.json({ error: "unsupported media type" }, { status: 415 });
  }

  const data = readAsset(filePath);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
  // Even when opened directly (outside the viewer's iframe), run HTML in an
  // opaque origin so its scripts cannot reach markshelf's own APIs/storage.
  if (contentType.startsWith("text/html") || ext === ".svg") {
    headers["Content-Security-Policy"] = "sandbox allow-scripts allow-popups";
  }

  return new NextResponse(new Uint8Array(data), { headers });
}
