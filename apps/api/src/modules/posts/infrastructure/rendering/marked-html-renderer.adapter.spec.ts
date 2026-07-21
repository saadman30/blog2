import { MarkedHtmlRendererAdapter } from './marked-html-renderer.adapter';

jest.mock('marked', () => ({
  marked: {
    parse: jest.fn(async (content: string) => `<p>${content}</p>`),
  },
}));

jest.mock('../../../../common/utils/content.util', () => ({
  sanitizeHtml: jest.fn((html: string) => html),
}));

describe('MarkedHtmlRendererAdapter', () => {
  const adapter = new MarkedHtmlRendererAdapter();

  it('renders sanitized html including non-string marked output', async () => {
    const markedModule = await import('marked');
    const parse = markedModule.marked.parse as unknown as jest.Mock;
    parse.mockResolvedValueOnce(42);
    await expect(adapter.render('hi')).resolves.toBe('42');
    parse.mockResolvedValueOnce('<p>hi</p>');
    await expect(adapter.render('hi')).resolves.toBe('<p>hi</p>');
  });
});
