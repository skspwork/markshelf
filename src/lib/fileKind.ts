export const MD_EXT = /\.md$/i;
export const HTML_EXT = /\.html?$/i;
export const PDF_EXT = /\.pdf$/i;

export function isMarkdownPath(p: string): boolean {
  return MD_EXT.test(p);
}

export function isHtmlPath(p: string): boolean {
  return HTML_EXT.test(p);
}

export function isPdfPath(p: string): boolean {
  return PDF_EXT.test(p);
}
