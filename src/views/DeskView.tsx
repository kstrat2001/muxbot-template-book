import { book, manuscript } from '../book/load.ts'
import { pieceHref } from './BookView.tsx'

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

  return (
    <main className="desk">
      <section className="totals">
        <p>
          <strong>{words.toLocaleString()}</strong> words{goal > 0 && <> of {goal.toLocaleString()}</>}
        </p>
        {goal > 0 && <progress max={goal} value={Math.min(words, goal)} />}
        <p>
          <strong>{tks}</strong> open [TK]
        </p>
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
            <th>Piece</th>
            <th>Status</th>
            <th>Drafted by</th>
            <th className="num">Words</th>
            <th className="num">[TK]</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((piece) => (
            <tr key={piece.key}>
              <td>
                <a href={pieceHref(piece)}>{piece.title}</a>
                <small>{piece.key}.md</small>
              </td>
              <td>
                <span className={`status ${piece.status}`}>{piece.status}</span>
              </td>
              <td>{piece.draftedBy}</td>
              <td className="num">{piece.words.toLocaleString()}</td>
              <td className="num">{piece.tks || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
