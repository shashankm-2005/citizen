import { useMemo, useState, type ReactNode } from 'react'
import type { EmployeeField, EmployeeRow } from '../lib/types'
import { EMPLOYEE_FIELDS } from '../lib/types'
import { Button } from './ui'

const PAGE = 10

/** Searchable, sortable, paginated employee table with per-column filters. */
export default function DataTable({ rows, renderCell, extra }: {
  rows: readonly EmployeeRow[]
  renderCell?: (r: EmployeeRow, f: EmployeeField) => ReactNode
  extra?: { header: string; cell: (r: EmployeeRow) => ReactNode }
}) {
  const [q, setQ] = useState('')
  const [colFilter, setColFilter] = useState<Partial<Record<EmployeeField, string>>>({})
  const [sort, setSort] = useState<{ f: EmployeeField | '_row'; dir: 1 | -1 }>({ f: '_row', dir: 1 })
  const [page, setPage] = useState(0)

  const view = useMemo(() => {
    const needle = q.toLowerCase().trim()
    const out = rows.filter((r) =>
      (!needle || EMPLOYEE_FIELDS.some((f) => r[f].toLowerCase().includes(needle))) &&
      EMPLOYEE_FIELDS.every((f) => !colFilter[f] || r[f].toLowerCase().includes(colFilter[f]!.toLowerCase())))
    return [...out].sort((a, b) => String(a[sort.f]).localeCompare(String(b[sort.f]), undefined, { numeric: true }) * sort.dir)
  }, [rows, q, colFilter, sort])
  const pages = Math.max(1, Math.ceil(view.length / PAGE))
  const p = Math.min(page, pages - 1)
  const toggle = (f: EmployeeField | '_row') => setSort((s) => ({ f, dir: s.f === f ? (-s.dir as 1 | -1) : 1 }))
  const arrow = (f: string) => (sort.f === f ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Search all columns</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="🔎 Search all columns…" className="w-64 rounded-md border border-slate-300 px-3 py-1.5" />
        </label>
        <span className="text-sm text-slate-500">{view.length} of {rows.length} rows</span>
        {(q || Object.values(colFilter).some(Boolean)) && <Button variant="ghost" onClick={() => { setQ(''); setColFilter({}) }}>Clear filters</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2"><button onClick={() => toggle('_row')}>Row{arrow('_row')}</button></th>
              {EMPLOYEE_FIELDS.map((f) => (
                <th key={f} className="px-3 py-2" aria-sort={sort.f === f ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => toggle(f)} className="font-semibold">{f}{arrow(f)}</button>
                </th>
              ))}
              {extra && <th className="px-3 py-2">{extra.header}</th>}
            </tr>
            <tr>
              <th />
              {EMPLOYEE_FIELDS.map((f) => (
                <th key={f} className="px-2 pb-2">
                  <input aria-label={`Filter ${f}`} value={colFilter[f] ?? ''} onChange={(e) => { setColFilter({ ...colFilter, [f]: e.target.value }); setPage(0) }} placeholder="filter" className="w-full min-w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-normal normal-case" />
                </th>
              ))}
              {extra && <th />}
            </tr>
          </thead>
          <tbody>
            {view.slice(p * PAGE, p * PAGE + PAGE).map((r) => (
              <tr key={r._row} className={`border-t border-slate-100 ${r._excluded ? 'bg-red-50 text-slate-400 line-through' : 'hover:bg-slate-50'}`}>
                <td className="px-3 py-1.5 text-slate-400 tabular-nums">{r._row}</td>
                {EMPLOYEE_FIELDS.map((f) => (
                  <td key={f} className="whitespace-pre px-3 py-1.5">
                    {renderCell ? renderCell(r, f) : r[f].trim() === '' ? <span className="text-xs italic text-red-500">{r[f] === '' ? 'empty' : 'blank'}</span> : r[f]}
                  </td>
                ))}
                {extra && <td className="px-3 py-1.5">{extra.cell(r)}</td>}
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">No rows match the current search/filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="mt-3 flex items-center justify-end gap-2 text-sm">
        <Button disabled={p === 0} onClick={() => setPage(p - 1)}>‹ Prev</Button>
        <span>Page {p + 1} / {pages}</span>
        <Button disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next ›</Button>
      </nav>
    </div>
  )
}
