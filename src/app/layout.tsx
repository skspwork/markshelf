import type { Metadata } from "next";
import "./globals.css";
import "./markdown.css";

export const metadata: Metadata = {
  title: "MarkShelf",
  description: "Structured markdown viewer for git repositories",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
