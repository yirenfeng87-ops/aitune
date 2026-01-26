export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^\)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^\)]*\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/<[^>]*>/g, "");
}

export function getCharCount(text: string): number {
  const clean = stripMarkdown(text);
  return clean.replace(/\s+/g, "").length;
}

export function getChineseCharCount(text: string): number {
  const clean = stripMarkdown(text);
  const matches = clean.match(/[\u4E00-\u9FFF]/gu);
  return matches ? matches.length : 0;
}
