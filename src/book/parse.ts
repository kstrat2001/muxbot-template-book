// The book's model, shared by the reader app (src/) and the exports
// (scripts/export.ts). Plain functions with no browser or Node APIs.

export type Section = 'front' | 'chapters' | 'back'
export const SECTIONS: Section[] = ['front', 'chapters', 'back']

export const STATUSES = ['idea', 'draft', 'revised', 'final'] as const
export type Status = (typeof STATUSES)[number]

export const DRAFTED_BY = ['author', 'bot', 'mixed'] as const
export type DraftedBy = (typeof DRAFTED_BY)[number]

export interface BookInfo {
  title: string
  subtitle: string
  author: string
  language: string
  edition: string
  year: number
  publisher: string
  isbn: { ebook: string; paperback: string; hardcover: string }
  description: string
  keywords: string[]
  cover: string
  trim: string
  word_goal: number
  rights: string
  disclaimer: string
  credits: string[]
  front: string[]
  chapters: string[]
  back: string[]
}

export interface Piece {
  key: string // "chapters/01-chapter-one"
  section: Section
  slug: string
  title: string
  part: string
  status: Status
  draftedBy: DraftedBy
  body: string
  words: number
  tks: number
  problems: string[]
}

export interface Manuscript {
  pieces: Piece[]
  missing: string[] // listed in book.json, no file
  unlisted: string[] // a file, not listed in book.json
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/

export function splitFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(FRONT_MATTER)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon > 0) meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return { meta, body: raw.slice(match[0].length) }
}

export function countWords(md: string): number {
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(TK, ' ')
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length
}

// A placeholder for something still to come: [TK] or [TK: the date she left].
export const TK = /\[TK\b[^\]]*\]/g

export function countTks(md: string): number {
  return (md.match(TK) ?? []).length
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string, problems: string[]): T {
  if (value === undefined || value === '') return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  problems.push(`${name} "${value}" is not one of: ${allowed.join(', ')}`)
  return fallback
}

export function parsePiece(section: Section, slug: string, raw: string): Piece {
  const { meta, body } = splitFrontMatter(raw)
  const problems: string[] = []
  if (!meta.title) problems.push('no title in its front matter')
  return {
    key: `${section}/${slug}`,
    section,
    slug,
    title: meta.title || slug,
    part: meta.part ?? '',
    status: oneOf(meta.status, STATUSES, 'draft', 'status', problems),
    draftedBy: oneOf(meta.drafted_by, DRAFTED_BY, 'author', 'drafted_by', problems),
    body,
    words: countWords(body),
    tks: countTks(body),
    problems,
  }
}

/** The pieces in reading order. `files` maps "front/dedication" to the file's text. */
export function assemble(book: BookInfo, files: Record<string, string>): Manuscript {
  const pieces: Piece[] = []
  const missing: string[] = []
  const listed = new Set<string>()
  for (const section of SECTIONS) {
    for (const slug of book[section] ?? []) {
      const key = `${section}/${slug}`
      listed.add(key)
      if (files[key] === undefined) missing.push(key)
      else pieces.push(parsePiece(section, slug, files[key]))
    }
  }
  const unlisted = Object.keys(files).filter((key) => !listed.has(key)).sort()
  return { pieces, missing, unlisted }
}

/** Chapter numbers, counted over the chapters only. */
export function chapterNumber(pieces: Piece[], piece: Piece): number {
  return pieces.filter((p) => p.section === 'chapters').indexOf(piece) + 1
}

/** True when this chapter starts a part ("part: Part One" differs from the chapter before). */
export function startsPart(pieces: Piece[], piece: Piece): boolean {
  if (piece.section !== 'chapters' || !piece.part) return false
  const chapters = pieces.filter((p) => p.section === 'chapters')
  const before = chapters[chapters.indexOf(piece) - 1]
  return !before || before.part !== piece.part
}

// Trim sizes in inches (width x height). Common book sizes; 6x9 when unknown.
export const TRIMS: Record<string, [number, number]> = {
  '5x8': [5, 8],
  '5.25x8': [5.25, 8],
  '5.5x8.5': [5.5, 8.5],
  '6x9': [6, 9],
  '7x10': [7, 10],
  '8.5x11': [8.5, 11],
}

export function trimSize(trim: string): [number, number] {
  return TRIMS[trim] ?? TRIMS['6x9']
}

/** The copyright page's lines, in order, from book.json. */
export function copyrightLines(book: BookInfo): string[] {
  const isbns = (['paperback', 'hardcover', 'ebook'] as const)
    .filter((format) => book.isbn?.[format])
    .map((format) => `ISBN ${book.isbn[format]} (${format})`)
  return [
    `Copyright © ${book.year} ${book.author}`,
    book.rights,
    ...isbns,
    book.disclaimer,
    ...(book.credits ?? []),
    book.publisher ? `Published by ${book.publisher}` : '',
    book.edition,
  ].filter(Boolean)
}
