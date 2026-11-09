import { notes } from '../book/load.ts'
import { mdToHtml } from '../book/html.ts'

/** Everything in notes/: the outline, the style sheet, chapter summaries, and anything else the book needs. */
export function NotesView() {
  if (notes.length === 0) return <p className="empty">No notes yet. Notes are Markdown files in notes/.</p>
  return (
    <main className="notes">
      <nav className="note-index">
        {notes.map((note) => (
          <a key={note.slug} href={`#${note.slug}`}>
            {note.slug}
          </a>
        ))}
      </nav>
      {notes.map((note) => (
        <article key={note.slug} id={note.slug} className="note">
          <p className="note-file">notes/{note.slug}.md</p>
          <div dangerouslySetInnerHTML={{ __html: mdToHtml(note.body) }} />
        </article>
      ))}
    </main>
  )
}
