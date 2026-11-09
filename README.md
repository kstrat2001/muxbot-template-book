# Mux Bot book template

A book manuscript to start from: chapters and front and back matter in Markdown, shown as printed pages in a small Vite + React reader, with exports to EPUB and Word.

## How Mux Bot uses it

When you choose **Write a book** in [Mux Bot](https://github.com/kstrat2001/muxbot), it makes you a new bot for your book and has darkmux set up a copy of this template on your Mac. Your bot helps plan, draft and revise when you ask, and you see each change in Mux Bot's live preview.

Two files are for Mux Bot and darkmux:

- `PLAYBOOK.md`: the recipe Mux Bot reads to make the bot (what it asks you first, its persona, and its skills: plan the book, draft a chapter, revise a passage, check the manuscript, add front or back matter, add an image, keep notes, change the look, fill in publishing details, export).
- `.darkmux/preview.json`: how darkmux runs the live preview (install with `npm ci`, then `npm run dev` on the ports darkmux picks).

## Run it yourself

Needs Node.js 22.18 or later.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173.

- **Book** (`/`): the book as pages at its trim size, with a title page, copyright page and contents built from `book.json`. Print it (the Print button, then Save as PDF) for a PDF with a page number on each page.
- **Ebook** (`/ebook`): the same text reflowed, as an e-reader shows it.
- **Desk** (`/desk`): each piece's status, who drafted it, its words and open `[TK]` placeholders, with a word goal and anything wrong with the files.
- **Notes** (`/notes`): everything in `notes/`.

`npm run export` writes an EPUB 3 and a Word manuscript (standard manuscript format) to `export/out/`. `npm run build` checks the types and builds the reader.

## Where things are

- `book.json`: title, author, publishing details, page size, word goal, and the reading order (`front`, `chapters`, `back`).
- `manuscript/front/`, `manuscript/chapters/`, `manuscript/back/`: one Markdown file per piece, each starting with front matter: `title`, `status` (idea, draft, revised, final), `drafted_by` (author, bot, mixed) and, for chapters in parts, `part`.
- `notes/`: the outline, the style sheet, chapter summaries and anything else the book needs.
- `public/images/`: pictures, placed in the text as `![alt text](/images/name.png "caption")`.
- `src/styles.css`: the book's look; the typography is the variables at the top.
- `scripts/export.ts`: the EPUB and Word exports.

The PDF from the browser has page numbers, but the contents page has none yet; a paged layout engine is planned for that.

## License

MIT
