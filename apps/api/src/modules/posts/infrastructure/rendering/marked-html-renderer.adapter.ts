import { Injectable } from '@nestjs/common';
import { marked } from 'marked';
import { sanitizeHtml } from '../../../../common/utils/content.util';
import { HtmlRendererPort } from '../../application/ports/html-renderer.port';

@Injectable()
export class MarkedHtmlRendererAdapter implements HtmlRendererPort {
  async render(content: string): Promise<string> {
    const html = await marked.parse(content);
    return sanitizeHtml(typeof html === 'string' ? html : String(html));
  }
}
