export interface TextPart {
  text: string;
  href?: string;
}

export function messageLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const start = match.index!;
    let url = match[0].replace(/[.,!?;:]+$/, '');
    while (url.endsWith(')') && (url.match(/\)/g)?.length ?? 0) > (url.match(/\(/g)?.length ?? 0))
      url = url.slice(0, -1);
    let href: string;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      href = parsed.href;
    } catch {
      continue;
    }
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: url, href });
    cursor = start + url.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
