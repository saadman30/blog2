import {
  estimateReadingTime,
  sanitizeHtml,
  slugify,
} from './content.util';

jest.mock('isomorphic-dompurify', () => ({
  sanitize: (dirty: string) => dirty.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
}));

describe('content.util', () => {
  describe('sanitizeHtml', () => {
    it('strips script tags', () => {
      expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
    });
  });

  describe('slugify', () => {
    it('normalizes titles into slugs', () => {
      expect(slugify(' Hello World! ')).toBe('hello-world');
    });

    it('collapses separators', () => {
      expect(slugify('foo___bar--baz')).toBe('foo-bar-baz');
    });
  });

  describe('estimateReadingTime', () => {
    it('returns at least 1 minute', () => {
      expect(estimateReadingTime('')).toBe(1);
      expect(estimateReadingTime('one two')).toBe(1);
    });

    it('ceil-divides word count by 200', () => {
      const words = Array.from({ length: 401 }, (_, i) => `w${i}`).join(' ');
      expect(estimateReadingTime(words)).toBe(3);
    });
  });
});
