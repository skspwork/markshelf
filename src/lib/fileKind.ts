export const MD_EXT = /\.md$/i;
export const HTML_EXT = /\.html?$/i;

export function isHtmlPath(p: string): boolean {
  return HTML_EXT.test(p);
}
