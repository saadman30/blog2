export function estimateReadingTime(content: string, wordsPerMinute = 200): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function buildTableOfContents(markdown: string): Array<{ id: string; text: string; level: number }> {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: Array<{ id: string; text: string; level: number }> = [];
  let match = headingRegex.exec(markdown);
  while (match) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    items.push({ id, text, level });
    match = headingRegex.exec(markdown);
  }
  return items;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
