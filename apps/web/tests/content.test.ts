import { describe, expect, it } from 'vitest';
import { buildTableOfContents, estimateReadingTime, formatDate } from '@/utils/content';

describe('content utils', () => {
  it('estimates reading time', () => {
    expect(estimateReadingTime('')).toBe(1);
    expect(estimateReadingTime(Array.from({ length: 250 }, () => 'word').join(' '))).toBe(2);
  });

  it('builds toc from markdown', () => {
    const toc = buildTableOfContents('## One\n\ntext\n\n### Two!\n');
    expect(toc).toEqual([
      { id: 'one', text: 'One', level: 2 },
      { id: 'two', text: 'Two!', level: 3 },
    ]);
  });

  it('formats dates', () => {
    expect(formatDate('2024-01-15T00:00:00.000Z')).toContain('2024');
    expect(formatDate(new Date('2024-01-15T00:00:00.000Z'))).toContain('Jan');
  });
});
