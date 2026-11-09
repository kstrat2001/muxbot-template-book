// The manuscript as the reader app sees it. Vite reloads the page when any
// of these files changes, so the preview follows every edit.
import bookData from '../../book.json'
import { assemble, type BookInfo } from './parse.ts'

const manuscriptFiles = import.meta.glob('/manuscript/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const noteFiles = import.meta.glob('/notes/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const files: Record<string, string> = {}
for (const [path, text] of Object.entries(manuscriptFiles)) {
  files[path.replace(/^\/manuscript\//, '').replace(/\.md$/, '')] = text
}

export const book = bookData as BookInfo
export const manuscript = assemble(book, files)

export const notes = Object.entries(noteFiles)
  .map(([path, body]) => ({ slug: path.replace(/^\/notes\//, '').replace(/\.md$/, ''), body }))
  .sort((a, b) => a.slug.localeCompare(b.slug))
