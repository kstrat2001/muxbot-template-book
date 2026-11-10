import { book, manuscript } from '../book/load.ts'
import { chapterNumber, STATUSES, type Piece, type Section } from '../book/parse.ts'
import { pieceHref } from './BookView.tsx'

const SECTION_NAMES: Record<Section, string> = { front: 'Front matter', chapters: 'Chapters', back: 'Back matter' }

/** The writer's desk: every piece's status, who drafted it, words, open [TK]s, and what needs fixing. */
export function DeskView() {
  const { pieces, missing, unlisted } = manuscript
  const words = pieces.reduce((sum, piece) => sum + piece.words, 0)
  const tks = pieces.reduce((sum, piece) => sum + piece.tks, 0)
  const goal = book.word_goal || 0
  const problems = [
    ...missing.map((key) => `${key}.md is listed in book.json but there is no such file in manuscript/.`),
    ...unlisted.map((key) => `manuscript/${key}.md is not listed in book.json, so it is not in the book.`),
    ...pieces.flatMap((piece) => piece.problems.map((problem) => `${piece.key}.md: ${problem}.`)),
  ]
  const sections = (['front', 'chapters', 'back'] as Section[]).filter((section) => pieces.some((piece) => piece.section === section))

  return (
    <main className="desk">
      <header className="sheet-head">
        <p className="caps">The desk</p>
        <h1>{book.title}</h1>
        <p className="byline">{book.author}</p>
      </header>
      <section className="totals" aria-label="Progress">
        <p>
          <strong>{words.toLocaleString()}</strong> {goal > 0 ? `of ${goal.toLocaleString()} words` : 'words'}
        </p>
        <p className="open-tks">
          <strong>{tks}</strong> open [TK]
        </p>
        {goal > 0 && (
          <div className="goal" role="progressbar" aria-label="Words toward the goal" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(words, goal)}>
            <span style={{ width: `${Math.min(100, (words / goal) * 100)}%` }} />
          </div>
        )}
      </section>
      {problems.length > 0 && (
        <ul className="problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <table>
        <thead>
          <tr>
            <th colSpan={2}>Piece</th>
            <th>Status</th>
            <th className="wide">Drafted by</th>
            <th className="num">Words</th>
            <th className="num">[TK]</th>
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody key={section}>
            <tr>
              <th colSpan={6} scope="rowgroup">
                {SECTION_NAMES[section]}
              </th>
            </tr>
            {pieces
              .filter((piece) => piece.section === section)
              .map((piece) => (
                <tr key={piece.key}>
                  <td className="chapter-no">{section === 'chapters' ? chapterNumber(pieces, piece) : ''}</td>
                  <td className="piece-name">
                    <a href={pieceHref(piece)}>{piece.title}</a>
                    <small>{piece.key}.md</small>
                  </td>
                  <td>
                    <Status piece={piece} />
                  </td>
                  <td className="wide quiet">{piece.draftedBy}</td>
                  <td className="num">{piece.words.toLocaleString()}</td>
                  <td className="num">{piece.tks > 0 && <span className="tk-count">{piece.tks}</span>}</td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </main>
  )
}

/** Four dots from idea to final, filled as far as the piece has come, then the word. */
function Status({ piece }: { piece: Piece }) {
  const reached = STATUSES.indexOf(piece.status)
  return (
    <span className={`status ${piece.status}`}>
      <span className="steps" aria-hidden="true">
        {STATUSES.map((status, index) => (
          <i key={status} className={index <= reached ? 'done' : undefined} />
        ))}
      </span>
      <span className="label">{piece.status}</span>
    </span>
  )
}
