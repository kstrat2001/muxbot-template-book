import { BookView } from './views/BookView.tsx'
import { DeskView } from './views/DeskView.tsx'
import { NotesView } from './views/NotesView.tsx'
import { book } from './book/load.ts'

// Paths: / (the book as printed pages), /ebook (reflowed, as an e-reader
// shows it), /desk (status and word counts), /notes, and one piece on its
// own: /chapter/<slug>, /front/<slug>, /back/<slug>.
const SECTION_PATHS: Record<string, string> = { chapter: 'chapters', front: 'front', back: 'back' }

const VIEWS = [
  { path: '/', label: 'Book' },
  { path: '/ebook', label: 'Ebook' },
  { path: '/desk', label: 'Desk' },
  { path: '/notes', label: 'Notes' },
]

function page(path: string) {
  if (path === '/') return <BookView mode="print" />
  if (path === '/ebook') return <BookView mode="ebook" />
  if (path === '/desk') return <DeskView />
  if (path === '/notes') return <NotesView />
  const match = path.match(/^\/(chapter|front|back)\/([\w-]+)$/)
  if (match) return <BookView mode="print" only={`${SECTION_PATHS[match[1]]}/${match[2]}`} />
  return <p className="empty">Nothing here. Try the <a href="/">book</a>.</p>
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  document.title = book.title
  return (
    <>
      <nav className="bar" aria-label="Views">
        <a className="bar-title" href="/">
          {book.title}
        </a>
        <div className="bar-views">
          {VIEWS.map((view) => (
            <a key={view.path} href={view.path} aria-current={view.path === path ? 'page' : undefined}>
              {view.label}
            </a>
          ))}
        </div>
        <div className="bar-side">
          {path === '/' && (
            <button type="button" onClick={() => window.print()}>
              Print
            </button>
          )}
        </div>
      </nav>
      {page(path)}
    </>
  )
}
