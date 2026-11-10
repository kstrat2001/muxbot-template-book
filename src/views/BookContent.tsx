// What is in the book, in reading order: the cover, the pages built from
// book.json (half title, title page, copyright, contents) and each piece of
// the manuscript. BookView.tsx puts these on pages; the look is src/styles/book.css.
import { book, manuscript } from '../book/load.ts'
import { mdToHtml } from '../book/html.ts'
import { chapterNumber, copyrightLines, startsPart, type Piece } from '../book/parse.ts'

/** The mark under a chapter title and on the title page: a diamond on a short rule. */
export function Ornament() {
  return (
    <svg className="ornament" viewBox="0 0 88 11" aria-hidden="true">
      <path d="M0 5.5h33M55 5.5h33" stroke="currentColor" strokeWidth="0.7" />
      <path d="M44 1l4.5 4.5L44 10l-4.5-4.5z" fill="currentColor" />
      <circle cx="36" cy="5.5" r="0.9" fill="currentColor" />
      <circle cx="52" cy="5.5" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** The front cover: the image named in book.json's "cover", or one set from the title and author. */
export function Cover() {
  if (book.cover) return <img className="cover" src={`/${book.cover.replace(/^\//, '')}`} alt={`Cover of ${book.title}`} />
  return (
    <div className="cover">
      <div className="cover-frame">
        <p className="cover-title">{book.title}</p>
        {book.subtitle && <p className="cover-subtitle">{book.subtitle}</p>}
        <Ornament />
        <p className="cover-author">{book.author}</p>
      </div>
    </div>
  )
}

/** An empty left-hand page, shown only when the next page has to start on the right. */
function Blank() {
  return <div className="blank" data-kind="plain" hidden />
}

// Pieces that stand alone on their page with no heading, before the contents.
const BARE = ['dedication', 'epigraph']
export const isBare = (piece: Piece) => piece.section === 'front' && BARE.includes(piece.slug)

// "Chapter One" as a title already says its number.
const namesItsNumber = (title: string) => /^chapter\b/i.test(title)

export function PieceView({ piece, rectoStart }: { piece: Piece; rectoStart?: boolean }) {
  const { pieces } = manuscript
  const number = piece.section === 'chapters' ? chapterNumber(pieces, piece) : 0
  const part = startsPart(pieces, piece)
  const bare = isBare(piece)
  return (
    <>
      {(part || rectoStart) && <Blank />}
      {part && (
        <section className="leaf-section built part" data-kind="plain">
          <h1>{piece.part}</h1>
          <Ornament />
        </section>
      )}
      <section className={`leaf-section piece ${piece.section}${bare ? ' bare' : ''}`} id={piece.key} data-kind={bare ? 'plain' : 'piece'} data-key={piece.key} data-title={piece.title} data-section={piece.section}>
        <header className="opener">
          {number > 0 && !namesItsNumber(piece.title) && <p className="chapter-number">{number}</p>}
          <h1>{piece.title}</h1>
          <Ornament />
        </header>
        <div className="text" dangerouslySetInnerHTML={{ __html: mdToHtml(piece.body) }} />
      </section>
    </>
  )
}

/** Half title, title page, copyright page and contents, all from book.json.
    `pageNumbers` maps a piece's key to the page it starts on, once the pages are laid out. */
export function BuiltPages({ pageNumbers = {} }: { pageNumbers?: Record<string, string> }) {
  const { pieces } = manuscript
  return (
    <>
      <section className="leaf-section built half-title" data-kind="plain">
        <h1>{book.title}</h1>
      </section>
      <Blank />
      <section className="leaf-section built title-page" data-kind="plain" data-key="title-page" data-title="Title page">
        <h1>{book.title}</h1>
        {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
        <Ornament />
        <p className="author">{book.author}</p>
        {book.publisher && <p className="imprint">{book.publisher}</p>}
      </section>
      <section className="leaf-section built copyright" data-kind="plain">
        {copyrightLines(book).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
      {pieces.filter(isBare).map((piece) => (
        <PieceView key={piece.key} piece={piece} />
      ))}
      <section className="leaf-section built contents" data-kind="plain" data-key="contents" data-title="Contents">
        <h1>Contents</h1>
        <ol>
          {pieces.filter((piece) => !isBare(piece)).map((piece) => (
            <li key={piece.key} className={piece.section}>
              {startsPart(pieces, piece) && <span className="part-name">{piece.part}</span>}
              <a href={`#${piece.key}`}>
                {piece.section === 'chapters' && <span className="number">{chapterNumber(pieces, piece)}</span>}
                <span className="title">{piece.title}</span>
                <span className="dots" />
                <span className="page-number">{pageNumbers[piece.key]}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
