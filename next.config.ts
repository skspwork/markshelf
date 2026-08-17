import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const basePath =
  rawBasePath && rawBasePath !== "/" && rawBasePath !== ""
    ? rawBasePath.replace(/\/$/, "")
    : undefined;

const nextConfig: NextConfig = {
  // standalone は Docker 配布用。Vercel は独自にビルドするため付けない
  // （VERCEL 環境変数はビルド時に Vercel が設定する）。
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  ...(basePath ? { basePath } : {}),
  // Vercel/サーバーレスでは docs/ を API ルート関数のバンドルへ同梱する
  // （読み取り専用ランタイムでも fs で docs を読めるように）。
  outputFileTracingIncludes: {
    "/api/**": ["./docs/**/*"],
  },
};

export default nextConfig;
