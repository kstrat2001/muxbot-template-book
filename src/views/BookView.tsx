import type { CSSProperties } from 'react'
import { book, manuscript } from '../book/load.ts'
import { mdToHtml } from '../book/html.ts'
import { chapterNumber, copyrightLines, startsPart, trimSize, type Piece } from '../book/parse.ts'

const LINK_SECTION: Record<string, string> = { chapters: 'chapter', front: 'front', back: 'back' }

export function pieceHref(piece: Piece): string {
  return `/${LINK_SECTION[piece.section]}/${piece.slug}`
}

/** The whole book in reading order, or one piece (`only`, a key like "chapters/01-chapter-one"). */
export function BookView({ mode, only }: { mode: 'print' | 'ebook'; only?: string }) {
  const { pieces } = manuscript
  const shown = only ? pieces.filter((piece) => piece.key === only) : pieces
  if (only && shown.length === 0) return <p className="empty">That piece isn't in book.json yet.</p>
  const [width, height] = trimSize(book.trim)

  return (
    <main className={`book ${mode}`} style={{ '--trim-w': `${width}in`, '--trim-h': `${height}in` } as CSSProperties}>
      <style>{`@page { size: ${width}in ${height}in; margin: 0.75in 0.65in 0.85in; @bottom-center { content: counter(page); font: 9pt var(--font-body); } } @page plain { @bottom-center { content: none; } }`}</style>
      {!only && <BuiltPages />}
      {shown.map((piece) => (
        <PieceView key={piece.key} piece={piece} />
      ))}
    </main>
  )
}

function PieceView({ piece }: { piece: Piece }) {
  const { pieces } = manuscript
  const number = piece.section === 'chapters' ? chapterNumber(pieces, piece) : 0
  return (
    <>
      {startsPart(pieces, piece) && (
        <section className="page plain part">
          <h1>{piece.part}</h1>
        </section>
      )}
      <section className={`page piece ${piece.section}`} id={piece.key}>
        <header className="opener">
          {number > 0 && <p className="chapter-number">{number}</p>}
          <h1>{piece.title}</h1>
        </header>
        <div className="text" dangerouslySetInnerHTML={{ __html: mdToHtml(piece.body) }} />
      </section>
    </>
  )
}

/** Half title, title page, copyright page and contents, all from book.json. */
function BuiltPages() {
  const { pieces } = manuscript
  return (
    <>
      <section className="page plain half-title">
        <h1>{book.title}</h1>
      </section>
      <section className="page plain title-page">
        <h1>{book.title}</h1>
        {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
        <p className="author">{book.author}</p>
        {book.publisher && <p className="imprint">{book.publisher}</p>}
      </section>
      <section className="page plain copyright">
        {copyrightLines(book).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
      <section className="page plain contents">
        <h1>Contents</h1>
        <ol>
          {pieces.map((piece) => (
            <li key={piece.key} className={piece.section}>
              {startsPart(pieces, piece) && <span className="part-name">{piece.part}</span>}
              <a href={`#${piece.key}`}>
                {piece.section === 'chapters' && <span className="number">{chapterNumber(pieces, piece)}</span>}
                {piece.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
