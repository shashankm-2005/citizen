# CitizenDB — HR Data Quality Lab

A low-code/no-code-style web app that recreates the case study in
*My LC/NC Introduction to Databases — A Citizen Development Case Study* (HR specialist, Merck, 1998, Microsoft Access).
Learners load synthetic HR data, find duplicates / missing / inconsistent records, design a schema by drag-and-drop,
build queries visually, and practise corrections in a sandbox that can never change the protected source.

> Educational recreation. Not an official Merck product. All data is synthetic.

## Run it (Windows)

Prerequisite: Node.js 20+ (tested with Node 24).

```powershell
cd C:\Users\Shashank.M\Desktop\LCNC\citizendb
npm install
npm run dev        # open http://localhost:5173
npm test           # unit/integration tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the built app
```

No configuration or credentials are needed. `.env.example` only holds placeholders for a possible hosted mode.

## Demo script (spec §14)

1. **Welcome** – case background (slide 2) and the live workflow (slide 4).
2. **HR Data Workspace** → *Load sample dataset* (checks run automatically). Or upload `sample-data/employees_sample.csv`; try `sample-data/bad_malformed.csv` to see the import blocked.
3. **Data Quality Lab** – 16 flags; duplicate groups shown in full; *Inspect* compares source vs sandbox; *Approve* / *Dismiss (with reason)*.
4. **Database Designer** – drag `employees` and `departments` from the palette, move cards, drag from `employees.department_id`'s dot to `departments.department_id`'s dot. Undo/redo, *Show SQL*, *Save*.
5. **Query Builder** – drag fields into *Output*, *Filters*, *Sort*; drop one `department_id` on the other to join. SQL, parameters, explanation and results update live.
6. **Sandbox** – before/after change log, edit cells, exclude/restore rows, *Reset* (confirmation). Source fingerprint never changes.
7. **Dashboard**, **Benefits & Career Value**, **Key Takeaways**.

## Architecture

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript + Vite, Tailwind CSS 4, HashRouter (static hosting friendly) |
| Diagram / drag-drop | `@xyflow/react` (React Flow) for table cards and relationship edges; native HTML5 drag-and-drop for the palette and query zones |
| State / persistence | Zustand with `localStorage` persistence (key `citizendb-v1`) — local demo mode, no server |
| CSV | `papaparse`, plus header/row/size validation in `src/lib/csv.ts` |
| Tests | Vitest (`src/lib/core.test.ts`) |

### Data storage (local mode)
Entities from spec §5 are kept in the persisted store (`src/store.ts`):
`departments`, `batches` (import_batches), `source` (immutable raw/staging snapshot of employees),
`sandbox` (sandbox_sessions + its working copy), `changes` (sandbox_changes), `issues` (data_quality_issues),
`modulesOpened` / `activities` (learning_progress), `schema` (designer). Raw data keeps duplicates exactly as imported;
nothing is forced into a constrained table. Use **Key Takeaways → Restart guided demo** to clear everything.

### Safety
- Source snapshot is only replaced by a new, confirmed import; every edit goes through pure sandbox functions that copy (`src/lib/sandbox.ts`). A test deep-freezes the source and proves edits/resets don't touch it.
- Queries are built from a structured definition against a whitelist of tables/columns; filter values are parameters (`?`) and never concatenated into SQL. Execution is read-only, in memory. There is no free-text SQL editor.
- No secrets anywhere; no network calls.

## Key files
```
src/lib/quality.ts   data-quality rules        src/lib/query.ts   query definition → SQL + execution
src/lib/csv.ts       CSV validation/mapping     src/lib/sandbox.ts isolation, audit, fingerprint
src/lib/schema.ts    designer model/validation  src/store.ts       app state
src/pages/*          one file per screen        sample-data/       CSVs + SEEDED_ISSUES.md
```

## Deployment
`npm run build` produces a static `dist/` folder (relative asset paths, hash routing), deployable to any static host
(GitHub Pages, Netlify, Vercel, Azure Static Web Apps). Not deployed yet. A hosted multi-user version would need
Supabase/PostgreSQL with auth and row-level security; that is **not implemented**.

## Feature checklist (mapped to the 8 slides)

| Slide | Feature | Status |
|---|---|---|
| 1 | Welcome page, title, LC/NC case-study framing, disclaimer | Implemented, checked in browser |
| 2 | Background (1998 context) + HR Employee → Data Problems → Need for a Solution | Implemented, checked in browser |
| 3 | Learning Centre: Why Access, 11 concepts with examples + checkpoints | Implemented, opened in browser |
| 3 | Database Designer: palette drag, move, field editor, PK/required/unique, relationships, undo/redo, save, reset layout, DDL | Implemented; drag, connect, invalid-type rejection, undo, save+reload checked in browser; logic unit-tested |
| 4 | Stateful workflow HR Data → Workspace → Queries → Issues identified | Implemented, checked in browser |
| 4 | CSV import with validation, preview, mapping, confirm; sample load/download | Implemented; validation unit-tested; sample load checked in browser; **file upload not exercised in browser** |
| 4 | Data Quality Lab: 6 rules, duplicate groups, inspect, approve/dismiss | Implemented; rules unit-tested; approve checked in browser |
| 3–4 | Query builder: drag fields, filters, sort, join, SQL, results, explanation | Implemented; unit-tested; drag/join/filter/sort checked in browser |
| 5 | Sandbox: banner, training-wheels comparison, edits, before/after log, exclude, reset w/ confirm | Implemented; isolation unit-tested; reset checked in browser |
| 6 | Hub-and-spoke benefits with activity counts | Implemented, checked in browser |
| 7 | Career progression Access → Database Skills → Technical Literacy → Long-Term Career Value | Implemented |
| 8 | Five takeaways + Thank you + restart | Implemented |

## Known limitations
- Drag-and-drop on touch devices is **untested**; palette and query-zone drags use HTML5 DnD, which most mobile browsers don't support. Every drag has a button/keyboard alternative (＋, ⧩, ⇅, *Connect* form, *Join* select).
- The query engine supports one join (employees ↔ departments on department_id), as the spec requires; it is an in-memory executor that mirrors the generated SQL, not a real SQL database.
- Name casing rule flags any non-Title-Case name (e.g. "McDonald" would be flagged); a human dismisses such false positives.
- Designer edits are lost if you leave the page without pressing *Save* (an "Unsaved changes" badge shows this).
- No end-to-end test suite (e.g. Playwright); the demo flow was walked through manually in Chrome.
