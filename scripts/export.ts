// Builds the book's files into export/out/: an EPUB for ebook stores and a
// DOCX in standard manuscript format for agents and editors.
//   node scripts/export.ts epub | docx | all
// The print PDF is the Book view printed from the browser (Print, then Save as PDF).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { AlignmentType, Document, Header, Packer, PageNumber, Paragraph, TextRun } from 'docx'
import JSZip from 'jszip'
import { Marked, type Token, type Tokens } from 'marked'
import { mdToHtml } from '../src/book/html.ts'
import { assemble, chapterNumber, copyrightLines, SECTIONS, startsPart, type BookInfo, type Manuscript, type Piece } from '../src/book/parse.ts'

const root = join(import.meta.dirname, '..')
const outDir = join(root, 'export', 'out')

function load(): { book: BookInfo; manuscript: Manuscript } {
  const book = JSON.parse(readFileSync(join(root, 'book.json'), 'utf8')) as BookInfo
  const files: Record<string, string> = {}
  for (const section of SECTIONS) {
    const dir = join(root, 'manuscript', section)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      files[`${section}/${name.slice(0, -3)}`] = readFileSync(join(dir, name), 'utf8')
    }
  }
  return { book, manuscript: assemble(book, files) }
}

function fileName(book: BookInfo, ext: string): string {
  const slug = book.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'book'
  return join(outDir, `${slug}.${ext}`)
}

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- EPUB 3 ----------

const MEDIA_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' }

const EPUB_CSS = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1 { font-weight: normal; text-align: center; margin: 2em 0 1.5em; }
.chapter-number { text-align: center; letter-spacing: 0.15em; margin: 2em 0 0; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
h1 + p, h2 + p, h3 + p, hr + p, blockquote + p, figure + p, .no-indent { text-indent: 0; }
hr { border: 0; margin: 1em 0; text-align: center; }
hr::after { content: '* * *'; }
blockquote { margin: 1em 1.5em; }
figure { margin: 1.5em 0; text-align: center; }
img { max-width: 100%; }
figcaption { font-size: 0.85em; }
.title-page, .half-title, .part { text-align: center; }
.title-page .subtitle { font-style: italic; }
.copyright p { text-indent: 0; font-size: 0.85em; margin-bottom: 0.75em; text-align: left; }
nav ol { list-style: none; padding: 0; }
mark.tk { background: none; }
`

function xhtml(book: BookInfo, title: string, body: string, bodyType = ''): string {
  const lang = esc(book.language || 'en')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="book.css" />
</head>
<body${bodyType ? ` epub:type="${bodyType}"` : ''}>
${body}
</body>
</html>
`
}

/** A stable id for a book with no ebook ISBN, so a re-export is the same book to a reader app. */
function bookId(book: BookInfo): string {
  if (book.isbn?.ebook) return `urn:isbn:${book.isbn.ebook.replace(/[^0-9Xx]/g, '')}`
  const hex = createHash('sha1').update(`${book.title}\n${book.author}`).digest('hex')
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const EPUB_TYPE: Record<string, string> = { dedication: 'dedication', epigraph: 'epigraph', foreword: 'foreword', preface: 'preface', introduction: 'introduction', prologue: 'prologue', acknowledgments: 'acknowledgments', epilogue: 'epilogue', afterword: 'afterword', glossary: 'glossary', bibliography: 'bibliography' }

async function exportEpub(book: BookInfo, manuscript: Manuscript): Promise<string> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" /></rootfiles>
</container>
`)
  zip.file('OEBPS/book.css', EPUB_CSS)

  const manifest: string[] = ['<item id="css" href="book.css" media-type="text/css" />', '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />']
  const spine: string[] = []
  const toc: string[] = []
  const images = new Set<string>()
  const add = (id: string, title: string, body: string, bodyType = '') => {
    zip.file(`OEBPS/${id}.xhtml`, xhtml(book, title, body, bodyType))
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml" />`)
    spine.push(`<itemref idref="${id}" />`)
  }
  const withImages = (html: string) =>
    html.replace(/src="\/images\/([^"]+)"/g, (_, name: string) => {
      images.add(name)
      return `src="images/${name}"`
    })

  if (book.cover) {
    const name = book.cover.replace(/^\/?images\//, '')
    images.add(name)
    add('cover', 'Cover', `<section epub:type="cover"><img src="images/${esc(name)}" alt="${esc(`Cover of ${book.title}`)}" /></section>`)
  }
  add('title-page', book.title, `<section class="title-page" epub:type="titlepage"><h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="subtitle">${esc(book.subtitle)}</p>` : ''}<p>${esc(book.author)}</p>${book.publisher ? `<p>${esc(book.publisher)}</p>` : ''}</section>`)
  add('copyright', 'Copyright', `<section class="copyright" epub:type="copyright-page">${copyrightLines(book).map((line) => `<p>${esc(line)}</p>`).join('\n')}</section>`)

  manuscript.pieces.forEach((piece: Piece, index: number) => {
    const id = `piece-${String(index + 1).padStart(3, '0')}`
    if (startsPart(manuscript.pieces, piece)) {
      add(`${id}-part`, piece.part, `<section class="part" epub:type="part"><h1>${esc(piece.part)}</h1></section>`)
      toc.push(`<li><a href="${id}-part.xhtml">${esc(piece.part)}</a></li>`)
    }
    const number = piece.section === 'chapters' ? chapterNumber(manuscript.pieces, piece) : 0
    const type = piece.section === 'chapters' ? 'chapter' : (EPUB_TYPE[piece.slug] ?? '')
    const heading = `${number ? `<p class="chapter-number">${number}</p>\n` : ''}<h1>${esc(piece.title)}</h1>`
    const body = withImages(mdToHtml(piece.body, { xhtml: true })).replace(/<mark class="tk">/g, '<mark class="tk">[').replace(/<\/mark>/g, ']</mark>')
    add(id, piece.title, `<section${type ? ` epub:type="${type}"` : ''}>\n${heading}\n${body}</section>`, piece.section === 'chapters' ? 'bodymatter' : `${piece.section}matter`)
    toc.push(`<li><a href="${id}.xhtml">${number ? `${number}. ` : ''}${esc(piece.title)}</a></li>`)
  })

  zip.file('OEBPS/nav.xhtml', xhtml(book, 'Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>\n${toc.join('\n')}\n</ol></nav>\n<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="toc" href="nav.xhtml">Contents</a></li>${manuscript.pieces.some((p) => p.section === 'chapters') ? `<li><a epub:type="bodymatter" href="piece-${String(manuscript.pieces.findIndex((p) => p.section === 'chapters') + 1).padStart(3, '0')}.xhtml">Start</a></li>` : ''}</ol></nav>`))
  spine.splice(book.cover ? 3 : 2, 0, '<itemref idref="nav" />')

  let imageIndex = 0
  for (const name of images) {
    const path = join(root, 'public', 'images', name)
    if (!existsSync(path)) throw new Error(`public/images/${name} is used in the book but missing`)
    const type = MEDIA_TYPES[extname(name).toLowerCase()]
    if (!type) throw new Error(`public/images/${name}: use JPEG, PNG, GIF, SVG or WebP`)
    zip.file(`OEBPS/images/${name}`, readFileSync(path))
    const isCover = book.cover && book.cover.replace(/^\/?images\//, '') === name
    manifest.push(`<item id="img-${++imageIndex}" href="images/${esc(name)}" media-type="${type}"${isCover ? ' properties="cover-image"' : ''} />`)
  }

  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const meta = [
    `<dc:identifier id="book-id">${esc(bookId(book))}</dc:identifier>`,
    `<dc:title>${esc(book.title)}</dc:title>`,
    book.subtitle ? `<meta property="title-type" refines="#subtitle">subtitle</meta><dc:title id="subtitle">${esc(book.subtitle)}</dc:title>` : '',
    `<dc:creator>${esc(book.author)}</dc:creator>`,
    `<dc:language>${esc(book.language || 'en')}</dc:language>`,
    book.publisher ? `<dc:publisher>${esc(book.publisher)}</dc:publisher>` : '',
    book.description ? `<dc:description>${esc(book.description)}</dc:description>` : '',
    ...(book.keywords ?? []).map((keyword) => `<dc:subject>${esc(keyword)}</dc:subject>`),
    `<dc:rights>${esc(`Copyright © ${book.year} ${book.author}. ${book.rights}`)}</dc:rights>`,
    `<meta property="dcterms:modified">${modified}</meta>`,
    '<meta property="schema:accessMode">textual</meta>',
    images.size ? '<meta property="schema:accessMode">visual</meta>' : '',
    '<meta property="schema:accessModeSufficient">textual</meta>',
    '<meta property="schema:accessibilityFeature">structuralNavigation</meta>',
    '<meta property="schema:accessibilityFeature">tableOfContents</meta>',
    images.size ? '<meta property="schema:accessibilityFeature">alternativeText</meta>' : '',
    '<meta property="schema:accessibilityHazard">none</meta>',
    '<meta property="schema:accessibilitySummary">Text with headings and a table of contents; images have text alternatives.</meta>',
  ].filter(Boolean)

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${esc(book.language || 'en')}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${meta.join('\n')}
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine>
${spine.join('\n')}
</spine>
</package>
`)
  const path = fileName(book, 'epub')
  writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/epub+zip' }))
  return path
}

// ---------- DOCX, standard manuscript format ----------
// 12 pt Times New Roman, double spaced, 1 inch margins, first lines indented
// half an inch, each chapter on a new page a third of the way down, and a
// header of Surname / TITLE / page number.

const lexer = new Marked({ gfm: true })
interface Style { bold?: boolean; italics?: boolean }

function runs(tokens: Token[] | undefined, style: Style = {}): TextRun[] {
  const out: TextRun[] = []
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'strong': out.push(...runs((token as Tokens.Strong).tokens, { ...style, bold: true })); break
      case 'em': out.push(...runs((token as Tokens.Em).tokens, { ...style, italics: true })); break
      case 'br': out.push(new TextRun({ break: 1 })); break
      case 'image': out.push(new TextRun({ text: `[Image: ${(token as Tokens.Image).text}]`, ...style })); break
      default: {
        const nested = 'tokens' in token ? (token.tokens as Token[] | undefined) : undefined
        if (nested && nested.length && token.type !== 'codespan') out.push(...runs(nested, style))
        else out.push(new TextRun({ text: decode('text' in token ? String(token.text) : token.raw), ...style }))
      }
    }
  }
  return out
}

const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function blocks(md: string): Paragraph[] {
  const out: Paragraph[] = []
  let indent = false // no first-line indent after a heading or a scene break
  const walk = (tokens: Token[], left = 0) => {
    for (const token of tokens) {
      if (token.type === 'paragraph') {
        out.push(new Paragraph({ children: runs((token as Tokens.Paragraph).tokens), indent: { left, firstLine: indent && !left ? 720 : 0 } }))
        indent = true
      } else if (token.type === 'heading') {
        out.push(new Paragraph({ children: runs((token as Tokens.Heading).tokens, { bold: true }), alignment: AlignmentType.CENTER }))
        indent = false
      } else if (token.type === 'hr') {
        out.push(new Paragraph({ children: [new TextRun('#')], alignment: AlignmentType.CENTER }))
        indent = false
      } else if (token.type === 'blockquote') {
        walk((token as Tokens.Blockquote).tokens, left + 720)
      } else if (token.type === 'list') {
        const list = token as Tokens.List
        list.items.forEach((item, i) => {
          const marker = list.ordered ? `${Number(list.start || 1) + i}. ` : '• '
          const inline = item.tokens.flatMap((t) => ('tokens' in t && t.tokens ? (t.tokens as Token[]) : [t]))
          out.push(new Paragraph({ children: [new TextRun(marker), ...runs(inline)], indent: { left: left + 720, hanging: 360 } }))
        })
      } else if (token.type === 'code') {
        out.push(new Paragraph({ children: [new TextRun((token as Tokens.Code).text)], indent: { left: left + 720 } }))
      }
    }
  }
  walk(lexer.lexer(md))
  return out
}

async function exportDocx(book: BookInfo, manuscript: Manuscript): Promise<string> {
  const words = manuscript.pieces.reduce((sum, piece) => sum + piece.words, 0)
  const rounded = words < 1000 ? Math.max(100, Math.round(words / 100) * 100) : Math.round(words / 1000) * 1000
  const surname = book.author.trim().split(/\s+/).pop() ?? ''
  const page = { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
  const header = new Header({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [`${surname} / ${book.title.toUpperCase()} / `, PageNumber.CURRENT] })] })],
  })

  const titlePage = [
    new Paragraph({ children: [new TextRun(book.author)] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(`About ${rounded.toLocaleString('en-US')} words`)] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3600 }, children: [new TextRun(book.title.toUpperCase())] }),
    ...(book.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(book.subtitle)] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(`by ${book.author}`)] }),
  ]

  const sections = manuscript.pieces.map((piece) => {
    const number = piece.section === 'chapters' ? chapterNumber(manuscript.pieces, piece) : 0
    const opener = [
      ...(startsPart(manuscript.pieces, piece) ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: [new TextRun(piece.part.toUpperCase())] })] : []),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: startsPart(manuscript.pieces, piece) ? 480 : 2880 }, children: [new TextRun(number ? `Chapter ${number}` : piece.title)] }),
      ...(number ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(piece.title)] })] : []),
    ]
    return { properties: { page }, headers: { default: header }, children: [...opener, ...blocks(piece.body)] }
  })

  const doc = new Document({
    creator: book.author,
    title: book.title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 480 } } } } },
    sections: [{ properties: { page }, children: titlePage }, ...sections],
  })
  const path = fileName(book, 'docx')
  writeFileSync(path, await Packer.toBuffer(doc))
  return path
}

// ---------- main ----------

const format = process.argv[2] ?? 'all'
if (!['epub', 'docx', 'all'].includes(format)) {
  console.error('Usage: node scripts/export.ts epub | docx | all')
  process.exit(2)
}
const { book, manuscript } = load()
for (const key of manuscript.missing) console.warn(`warning: ${key}.md is listed in book.json but missing; it is left out`)
for (const key of manuscript.unlisted) console.warn(`warning: manuscript/${key}.md is not in book.json; it is left out`)
const tks = manuscript.pieces.reduce((sum, piece) => sum + piece.tks, 0)
if (tks) console.warn(`warning: ${tks} open [TK] placeholder(s) are still in the book`)
mkdirSync(outDir, { recursive: true })
if (format !== 'docx') console.log(`EPUB: ${await exportEpub(book, manuscript)}`)
if (format !== 'epub') console.log(`DOCX: ${await exportDocx(book, manuscript)}`)
