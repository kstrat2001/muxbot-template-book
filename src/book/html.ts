// Markdown to HTML, shared by the reader app and the EPUB export.
import { Marked } from 'marked'

const marked = new Marked({ gfm: true, async: false })

export function mdToHtml(md: string, options: { xhtml?: boolean } = {}): string {
  let html = marked.parse(md) as string
  // An image alone in its paragraph, with a title, is a figure with a caption:
  // ![A map of the valley](/images/map.png "The valley in 1890")
  html = html.replace(/<p><img([^>]*?) title="([^"]*)"([^>]*)><\/p>/g, '<figure><img$1$3><figcaption>$2</figcaption></figure>')
  html = html.replace(/\[TK\b([^\]]*)\]/g, '<mark class="tk">TK$1</mark>')
  // EPUB is XHTML: empty elements close themselves.
  if (options.xhtml) html = html.replace(/<(br|hr|img)\b([^>]*?)\s*\/?>/g, '<$1$2 />')
  return html
}
