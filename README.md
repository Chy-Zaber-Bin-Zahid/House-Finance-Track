# Bills and Rent

A house ledger: what each unit paid in rent, what the bills came to, and what was left over.
Ported from the Claude Design canvas `Bills and Rent v2.dc.html` to Next.js and Tailwind.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run typecheck
```

## The screens

| Route | What it is |
| --- | --- |
| `/` | The year — three totals, a rent-vs-bills chart, and the whole sheet |
| `/month/1` … `/month/12` | One month — type the amounts, mark each paid or upcoming |
| `/units` | Units and tenants |
| `/units/[key]` | One tenant — photo, contact, documents, rent by month, notes |

The four screens were one canvas with a `screen` state field. They are real routes here, so
the back button, deep links, and the twelve prerendered month pages all work; the sheet itself
lives in one client store that every route shares.

## How it is put together

```
app/          routes and the shell — layout, globals.css, the four pages
components/   screens (year, month, units, tenant) and the pieces they share
lib/          the sheet: types, seed, derived totals, formatting, CSV export
```

- **State** — `components/house-store.tsx`. A reducer over `{ bills, units }`, saved to
  `localStorage` on every change and read back on load. Nothing leaves the browser.
- **Totals** — `lib/derive.ts`, pure functions over the state. Nothing is stored twice.
- **Design tokens** — the palette, radii, and card shadow are Tailwind theme variables in
  `app/globals.css`, carried over from the canvas so `bg-brand` and `text-muted` mean what they
  meant there.

## What the port added

The canvas had three placeholders. They do their job here:

- **Export to Excel** writes the sheet as UTF-8 CSV, which Excel and Sheets both open.
- **Documents** take real files. Anything up to 1.5 MB is kept whole, so *Open* works after a
  reload; past that only the file's details are stored and *Open* says so. The seeded sample
  entries have details but no bytes.
- **The tenant photo** accepts a drop or a click, and is re-encoded to at most 1024px so a
  house full of them still fits in the browser's store.

If the browser ever runs out of room, the sheet is saved without the file bodies and a note
appears under the header rather than the save failing silently.

## Configuration

Currency, house name, and year were editable props on the canvas. They live in `lib/config.ts`.
