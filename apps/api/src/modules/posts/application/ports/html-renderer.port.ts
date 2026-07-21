export const HTML_RENDERER = Symbol('HTML_RENDERER');

export interface HtmlRendererPort {
  render(content: string): Promise<string>;
}
