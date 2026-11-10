import { book, notes } from '../book/load.ts'
import { mdToHtml } from '../book/html.ts'

/** Everything in notes/: the outline, the style sheet, chapter summaries, and anything else the book needs. */
export function NotesView() {
  if (notes.length === 0) return <p className="empty">No notes yet. Notes are Markdown files in notes/.</p>
  return (
    <main className="notes">
      <header className="sheet-head">
        <p className="caps">Notes</p>
        <h1>{book.title}</h1>
      </header>
      <nav className="note-index" aria-label="Notes">
        {notes.map((note) => (
          <a key={note.slug} href={`#${note.slug}`}>
            {note.slug.replace(/-/g, ' ')}
          </a>
        ))}
      </nav>
      <div>
        {notes.map((note) => (
          <article key={note.slug} id={note.slug} className="note">
            <p className="note-file caps">notes/{note.slug}.md</p>
            <div dangerouslySetInnerHTML={{ __html: mdToHtml(note.body) }} />
          </article>
        ))}
      </div>
    </main>
  )
}
