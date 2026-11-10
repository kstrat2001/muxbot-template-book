import type { CSSProperties } from 'react'
import { book, manuscript } from '../book/load.ts'
import { trimSize, type Piece } from '../book/parse.ts'
import { BuiltPages, isBare, PieceView } from './BookContent.tsx'
import { Pager } from './Pager.tsx'

const LINK_SECTION: Record<string, string> = { chapters: 'chapter', front: 'front', back: 'back' }

export function pieceHref(piece: Piece): string {
  return `/${LINK_SECTION[piece.section]}/${piece.slug}`
}

/** The whole book in reading order, or one piece (`only`, a key like "chapters/01-chapter-one").
    "print" is the book as pages you turn; "ebook" is the same text in one scrolling column. */
export function BookView({ mode, only }: { mode: 'print' | 'ebook'; only?: string }) {
  const { pieces } = manuscript
  const shown = only ? pieces.filter((piece) => piece.key === only) : pieces
  if (only && shown.length === 0) return <p className="empty">That piece isn't in book.json yet.</p>
  const [width, height] = trimSize(book.trim)
  const firstChapter = pieces.find((piece) => piece.section === 'chapters')

  // The pages' contents. `pageNumbers` fills in the contents page once the pages are laid out.
  const content = (pageNumbers?: Record<string, string>) => (
    <>
      {!only && <BuiltPages pageNumbers={pageNumbers} />}
      {shown
        .filter((piece) => only || !isBare(piece))
        .map((piece) => (
          <PieceView key={piece.key} piece={piece} rectoStart={!only && piece === firstChapter} />
        ))}
    </>
  )

  return (
    <main className={`book ${mode === 'ebook' ? 'ebook' : 'paged'}`} style={{ '--trim-w': width, '--trim-h': height } as CSSProperties}>
      {/* The printed page: its size, its margins and a page number at the foot. */}
      <style>{`@page { size: ${width}in ${height}in; margin: 0.8in 0.75in 0.95in; @bottom-center { content: counter(page); font: 9.5pt var(--font-body); } } @page plain { @bottom-center { content: none; } }`}</style>
      {mode === 'ebook' ? <div className="reader">{content()}</div> : <Pager cover={!only}>{content}</Pager>}
    </main>
  )
}
