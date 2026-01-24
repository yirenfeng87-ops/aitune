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
