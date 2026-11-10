// The page-turning Book view. The text is one long flow that CSS columns cut
// into pages (src/styles/pages.css); this file only counts the pages, works
// out what each one is, and moves the flow so the right pages show.
// Wide screens show two facing pages, narrow ones a single page.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { book } from '../book/load.ts'
import { Cover } from './BookContent.tsx'

/** Where something starts: a piece, a built page (title page, contents) or a blank. */
interface Mark {
  page: number
  kind: string // "piece" has a running head and a page number; "plain" has neither
  key: string
  title: string
  section: string
}

interface Layout {
  facing: boolean // two pages side by side
  total: number // pages in the book, not counting the cover
  marks: Mark[]
}

const COVER = -1
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx']

const saved = {
  key: () => `book-page:${window.location.pathname}`,
  read(fallback: number): number {
    try {
      const value = window.sessionStorage.getItem(saved.key())
      return value === null ? fallback : Number(value) || 0
    } catch {
      return fallback
    }
  },
  write(page: number) {
    try {
      window.sessionStorage.setItem(saved.key(), String(page))
    } catch {
      // Private windows may refuse; the book then just reopens at the start.
    }
  },
}

/** Counts the pages and finds where each piece starts. Pages are numbered from 0; even pages are right-hand ones. */
function measure(flow: HTMLElement): Layout {
  const style = getComputedStyle(flow)
  const facing = style.columnCount === '2'
  const gap = parseFloat(style.columnGap) || 0
  const step = (flow.clientWidth + gap) / (facing ? 2 : 1)
  const left = flow.getBoundingClientRect().left
  const pageOf = (element: Element) => Math.round((element.getBoundingClientRect().left - left) / step)

  // A blank left-hand page goes in wherever the next page must start on the right.
  for (const blank of flow.querySelectorAll<HTMLElement>('.blank')) {
    blank.hidden = true
    const next = blank.nextElementSibling
    if (facing && next && pageOf(next) % 2 === 1) blank.hidden = false
  }

  const marks = [...flow.querySelectorAll<HTMLElement>('[data-kind]')]
    .filter((element) => !element.hidden)
    .map((element) => ({ page: pageOf(element), kind: element.dataset.kind ?? 'plain', key: element.dataset.key ?? '', title: element.dataset.title ?? '', section: element.dataset.section ?? '' }))
  return { facing, total: Math.max(1, Math.round((flow.scrollWidth + gap) / step)), marks }
}

/** The page number as printed: roman numerals before the first chapter, 1 from there on. */
function folio(layout: Layout, page: number): string {
  const first = layout.marks.find((mark) => mark.section === 'chapters')?.page ?? 0
  return page < first ? (ROMAN[page] ?? String(page + 1)) : String(page - first + 1)
}

const markAt = (layout: Layout, page: number) => layout.marks.findLast((mark) => mark.page <= page)

export function Pager({ cover, children }: { cover: boolean; children: (pageNumbers: Record<string, string>) => ReactNode }) {
  const flowRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>({ facing: false, total: 1, marks: [] })
  const [page, setPage] = useState(() => saved.read(cover ? COVER : 0))

  const remeasure = useCallback(() => {
    const next = measure(flowRef.current!)
    setLayout((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [])

  // Lay out before the first paint, and again when the window or the fonts change.
  useLayoutEffect(remeasure)
  useEffect(() => {
    const observer = new ResizeObserver(remeasure)
    observer.observe(stageRef.current!)
    document.fonts?.ready.then(remeasure)
    return () => observer.disconnect()
  }, [remeasure])

  const first = cover ? COVER : 0
  const last = layout.total - 1
  // Facing pages show as (odd, even): the page on the right is the even one.
  const right = (p: number) => (layout.facing && p >= 0 ? Math.min(2 * Math.ceil(p / 2), 2 * Math.ceil(last / 2)) : p)
  const at = Math.max(first, Math.min(right(page), right(last)))
  const turn = layout.facing ? 2 : 1

  const go = useCallback((to: number) => {
    setPage(to)
    saved.write(to)
    // A short fade as the page turns, unless the reader asked for less motion.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) windowRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' })
  }, [])
  const back = () => go(at <= 0 ? first : at - turn)
  const forward = () => go(at < 0 ? 0 : Math.min(at + turn, right(last)))

  // The arrow keys turn pages; a link on the contents page (#chapters/01-chapter-one) goes to its piece.
  const keys = useRef({ back, forward })
  keys.current = { back, forward }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement).closest('select, input, textarea')) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') keys.current.forward()
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') keys.current.back()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const onLink = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a[href^="#"]')
    const mark = link && layout.marks.find((m) => `#${m.key}` === link.getAttribute('href'))
    if (!mark) return
    event.preventDefault()
    go(mark.page)
  }

  // A swipe turns the page on a touch screen.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchEnd = (x: number, y: number) => {
    const start = touch.current
    touch.current = null
    if (!start || window.getSelection()?.toString()) return
    const dx = x - start.x
    if (Math.abs(dx) > 48 && Math.abs(dx) > 2 * Math.abs(y - start.y)) (dx < 0 ? forward : back)()
  }

  const shown = at < 0 ? [] : layout.facing ? [at - 1, at] : [at]
  // The place named under the pages: the piece last asked for, if it is one of the pages showing.
  const here = markAt(layout, shown.includes(page) && page <= last ? page : (shown.findLast((p) => p <= last) ?? 0))
  const places = layout.marks.filter((mark) => mark.key)
  const pageNumbers = Object.fromEntries(layout.marks.filter((mark) => mark.kind === 'piece').map((mark) => [mark.key, folio(layout, mark.page)]))
  // How far the flow is moved, in pages. With facing pages, page 0 sits on the right.
  const shift = layout.facing ? Math.max(at, 0) - 1 : Math.max(at, 0)

  return (
    <>
      <div className="stage" ref={stageRef} onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}>
        <div className={`spread${at < 0 ? ' closed' : ''}${cover ? '' : ' no-cover'}`}>
          {at < 0 && <Cover />}
          {shown.map((p) => (
            <Leaf key={p} layout={layout} page={p} />
          ))}
          <div className="window" ref={windowRef} onClick={onLink}>
            <div className="flow" ref={flowRef} style={{ '--shift': shift } as CSSProperties}>
              {children(pageNumbers)}
            </div>
          </div>
        </div>
      </div>
      <nav className="turner" aria-label="Pages">
        <button type="button" onClick={back} disabled={at <= first} aria-label="Previous page">
          <Chevron flip />
        </button>
        <label className="place">
          <span className="visually-hidden">Go to</span>
          <select value={at < 0 ? 'cover' : (here?.key ?? '')} onChange={(e) => go(e.target.value === 'cover' ? COVER : (places.find((mark) => mark.key === e.target.value)?.page ?? 0))}>
            {cover && <option value="cover">Cover</option>}
            {!places.some((mark) => mark.key === (here?.key ?? '')) && <option value="">Front pages</option>}
            {places.map((mark) => (
              <option key={mark.key} value={mark.key}>
                {mark.title}
              </option>
            ))}
          </select>
        </label>
        <span className="count" aria-live="polite">
          {at < 0 ? book.author : `${shown.filter((p) => p >= 0 && p <= last).map((p) => p + 1).join('\u2013')} of ${layout.total}`}
        </span>
        <button type="button" onClick={forward} disabled={at >= right(last)} aria-label="Next page">
          <Chevron />
        </button>
      </nav>
    </>
  )
}

/** The paper under one page of the flow, with its running head and page number. */
function Leaf({ layout, page }: { layout: Layout; page: number }) {
  const side = page % 2 === 0 ? 'recto' : 'verso'
  if (page < 0 || page >= layout.total) return <div className={`leaf ${side} endpaper`} aria-hidden="true" />
  const mark = markAt(layout, page)
  const numbered = mark?.kind === 'piece'
  const opens = mark?.page === page
  return (
    <div className={`leaf ${side}`} aria-hidden="true">
      {numbered && !opens && (
        <p className="running-head">
          <span className="folio">{folio(layout, page)}</span>
          <span className="caps">{side === 'verso' ? book.title : mark.title}</span>
        </p>
      )}
      {numbered && opens && <p className="foot-folio">{folio(layout, page)}</p>}
    </div>
  )
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
