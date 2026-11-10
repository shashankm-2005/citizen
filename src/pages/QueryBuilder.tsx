import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { Button, Card, NeedData, PageHeader, SandboxBanner } from '../components/ui'
import { FILTER_OPS, QUERY_TABLES, QueryError, runQuery, type ColumnRef, type FilterOp, type QueryDef, type QueryResult, type TableName } from '../lib/query'
import { uid } from '../lib/sandbox'
import { useApp } from '../store'

const DND = 'application/x-citizendb-field'
const EMPTY: QueryDef = { join: null, columns: [], filters: [], orderBy: [], limit: 50 }
const c = (table: TableName, field: string): ColumnRef => ({ table, field })
const PRESETS: { label: string; def: QueryDef }[] = [
  { label: 'Employees with department names (JOIN)', def: { join: { type: 'INNER' }, columns: [c('employees', 'employee_id'), c('employees', 'first_name'), c('employees', 'last_name'), c('departments', 'department_name')], filters: [], orderBy: [{ ...c('employees', 'last_name'), dir: 'ASC' }], limit: 50 } },
  { label: 'Find missing emails (NULL)', def: { join: null, columns: [c('employees', 'employee_id'), c('employees', 'first_name'), c('employees', 'email')], filters: [{ id: 'p1', ...c('employees', 'email'), op: 'is null', value: '' }], orderBy: [], limit: 50 } },
  { label: 'Find broken department references (LEFT JOIN)', def: { join: { type: 'LEFT' }, columns: [c('employees', 'employee_id'), c('employees', 'department_id'), c('departments', 'department_name')], filters: [{ id: 'p2', ...c('departments', 'department_name'), op: 'is null', value: '' }], orderBy: [], limit: 50 } },
]
const label = (r: ColumnRef) => `${r.table}.${r.field}`
const same = (a: ColumnRef, b: ColumnRef) => a.table === b.table && a.field === b.field

function DropZone({ title, hint, onDropField, children }: { title: string; hint: string; onDropField: (r: ColumnRef) => void; children: ReactNode }) {
  const [over, setOver] = useState(false)
  const drop = (e: DragEvent) => {
    e.preventDefault(); setOver(false)
    const raw = e.dataTransfer.getData(DND)
    if (raw) onDropField(JSON.parse(raw))
  }
  return (
    <section aria-label={title} onDragEnter={(e) => { e.preventDefault(); setOver(true) }} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}
      className={`rounded-lg border-2 border-dashed p-3 transition ${over ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </section>
  )
}

export default function QueryBuilder() {
  const { source, sandbox, departments, countQuery } = useApp()
  const [def, setDef] = useState<QueryDef>(EMPTY)
  const [dataset, setDataset] = useState<'sandbox' | 'source'>('sandbox')
  const [showSql, setShowSql] = useState(true)
  const rows = dataset === 'source' ? source?.employees : sandbox?.employees

  const result = useMemo((): QueryResult | { error: string } | null => {
    if (!rows || def.columns.length === 0) return null
    try { return runQuery(def, rows, departments) } catch (e) { return { error: e instanceof QueryError ? e.message : 'The query could not be run.' } }
  }, [def, rows, departments])
  const ok = result && !('error' in result)
  useEffect(() => { if (!ok) return; const t = setTimeout(countQuery, 800); return () => clearTimeout(t) }, [def, ok, countQuery])

  if (!rows) return <div className="mx-auto max-w-6xl"><PageHeader title="Visual Query Builder & SQL Lab" /><NeedData /></div>

  const addCol = (r: ColumnRef) => setDef((d) => (d.columns.some((x) => same(x, r)) ? d : { ...d, columns: [...d.columns, r] }))
  const addFilter = (r: ColumnRef) => setDef((d) => ({ ...d, filters: [...d.filters, { id: uid('flt'), ...r, op: '=', value: '' }] }))
  const addSort = (r: ColumnRef) => setDef((d) => (d.orderBy.some((x) => same(x, r)) ? d : { ...d, orderBy: [...d.orderBy, { ...r, dir: 'ASC' }] }))
  const setJoin = (type: '' | 'INNER' | 'LEFT') => setDef((d) => ({ ...d, join: type ? { type } : null }))
  const moveCol = (i: number, dir: number) => setDef((d) => { const cols = [...d.columns]; const [x] = cols.splice(i, 1); cols.splice(i + dir, 0, x); return { ...d, columns: cols } })

  const dropOnField = (e: DragEvent, target: ColumnRef) => {
    const raw = e.dataTransfer.getData(DND)
    if (!raw) return
    const src: ColumnRef = JSON.parse(raw)
    // Dropping department_id from one table onto the other creates the join.
    if (src.field === 'department_id' && target.field === 'department_id' && src.table !== target.table) { e.preventDefault(); e.stopPropagation(); setJoin(def.join?.type ?? 'INNER') }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader title="Visual Query Builder & SQL Lab" slide="PPT Slides 3–4 · Joins and basic SQL">
        <div role="tablist" className="flex rounded-lg border bg-white p-0.5 text-sm">
          {(['sandbox', 'source'] as const).map((v) => <button key={v} role="tab" aria-selected={dataset === v} onClick={() => setDataset(v)} className={`rounded-md px-3 py-1 ${dataset === v ? 'bg-slate-800 text-white' : ''}`}>{v === 'sandbox' ? '🧪 Sandbox' : '🔒 Source'}</button>)}
        </div>
        <Button onClick={() => setDef(EMPTY)}>Clear</Button>
      </PageHeader>
      <SandboxBanner mode={dataset} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Examples:</span>
        {PRESETS.map((p) => <Button key={p.label} variant="ghost" className="border border-slate-200" onClick={() => setDef(structuredClone(p.def))}>{p.label}</Button>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          {(Object.keys(QUERY_TABLES) as TableName[]).map((t, ti) => (
            <div key={t}>
              <Card className="!p-3">
                <h2 className="mb-2 text-sm font-semibold">▦ {t} <span className="font-normal text-slate-400">({QUERY_TABLES[t].alias})</span></h2>
                <ul className="space-y-1">
                  {QUERY_TABLES[t].columns.map((f) => {
                    const r = c(t, f)
                    const joinKey = f === 'department_id'
                    return (
                      <li key={f} draggable onDragStart={(e) => { e.dataTransfer.setData(DND, JSON.stringify(r)); e.dataTransfer.effectAllowed = 'copy' }}
                        onDragOver={joinKey ? (e) => e.preventDefault() : undefined} onDragEnter={joinKey ? (e) => e.preventDefault() : undefined} onDrop={joinKey ? (e) => dropOnField(e, r) : undefined}
                        className={`flex cursor-grab select-none items-center gap-1 rounded border px-2 py-1 text-xs ${joinKey ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="flex-1">⠿ {f}{f === 'department_id' && t === 'departments' ? ' 🔑' : f === 'employee_id' ? ' 🔑' : ''}</span>
                        <button aria-label={`Select ${label(r)}`} title="Add to output" onClick={() => addCol(r)} className="rounded px-1 hover:bg-blue-100">＋</button>
                        <button aria-label={`Filter on ${label(r)}`} title="Add filter" onClick={() => addFilter(r)} className="rounded px-1 hover:bg-blue-100">⧩</button>
                        <button aria-label={`Sort by ${label(r)}`} title="Add sort" onClick={() => addSort(r)} className="rounded px-1 hover:bg-blue-100">⇅</button>
                      </li>
                    )
                  })}
                </ul>
              </Card>
              {ti === 0 && (
                <div className={`my-2 rounded-lg border-2 p-2 text-center text-xs ${def.join ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-amber-400 bg-amber-50'}`}>
                  <label className="font-semibold">🔗 Join
                    <select aria-label="Join type" value={def.join?.type ?? ''} onChange={(e) => setJoin(e.target.value as '' | 'INNER' | 'LEFT')} className="ml-2 rounded border px-1 py-0.5">
                      <option value="">not joined</option><option value="INNER">INNER JOIN</option><option value="LEFT">LEFT JOIN</option>
                    </select>
                  </label>
                  <p className="mt-1 text-slate-600">ON e.department_id = d.department_id</p>
                  {!def.join && <p className="text-slate-500">Tip: drag one <b>department_id</b> onto the other to join.</p>}
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">Drag fields into the boxes, or use ＋ (select), ⧩ (filter), ⇅ (sort).</p>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <DropZone title="① Output columns (SELECT)" hint="Drop fields here" onDropField={addCol}>
              {def.columns.map((r, i) => (
                <div key={label(r)} className="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs">
                  <span className="flex-1">{label(r)}</span>
                  <button aria-label={`Move ${label(r)} left`} disabled={i === 0} onClick={() => moveCol(i, -1)} className="disabled:opacity-30">↑</button>
                  <button aria-label={`Move ${label(r)} right`} disabled={i === def.columns.length - 1} onClick={() => moveCol(i, 1)} className="disabled:opacity-30">↓</button>
                  <button aria-label={`Remove ${label(r)}`} onClick={() => setDef((d) => ({ ...d, columns: d.columns.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
            </DropZone>
            <DropZone title="② Filters (WHERE)" hint="Drop a field to filter on it" onDropField={addFilter}>
              {def.filters.map((f) => (
                <div key={f.id} className="rounded bg-violet-100 px-2 py-1 text-xs">
                  <div className="flex items-center justify-between"><span>{label(f)}</span><button aria-label={`Remove filter on ${label(f)}`} onClick={() => setDef((d) => ({ ...d, filters: d.filters.filter((x) => x.id !== f.id) }))}>✕</button></div>
                  <div className="mt-1 flex gap-1">
                    <select aria-label="Operator" value={f.op} onChange={(e) => setDef((d) => ({ ...d, filters: d.filters.map((x) => (x.id === f.id ? { ...x, op: e.target.value as FilterOp } : x)) }))} className="rounded border px-1">{FILTER_OPS.map((o) => <option key={o}>{o}</option>)}</select>
                    {!['is null', 'is not null'].includes(f.op) && <input aria-label={`Value for ${label(f)}`} value={f.value} onChange={(e) => setDef((d) => ({ ...d, filters: d.filters.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)) }))} className="w-full min-w-0 rounded border px-1" placeholder="value" />}
                  </div>
                </div>
              ))}
            </DropZone>
            <DropZone title="③ Sort (ORDER BY)" hint="Drop a field to sort by it" onDropField={addSort}>
              {def.orderBy.map((s, i) => (
                <div key={label(s)} className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs">
                  <span className="flex-1">{label(s)}</span>
                  <button onClick={() => setDef((d) => ({ ...d, orderBy: d.orderBy.map((x, j) => (j === i ? { ...x, dir: x.dir === 'ASC' ? 'DESC' : 'ASC' } : x)) }))} className="rounded bg-white px-1">{s.dir}</button>
                  <button aria-label={`Remove sort on ${label(s)}`} onClick={() => setDef((d) => ({ ...d, orderBy: d.orderBy.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
            </DropZone>
          </div>
          <label className="block text-xs">Row limit <input type="number" min={1} max={1000} value={def.limit} onChange={(e) => setDef({ ...def, limit: Number(e.target.value) })} className="ml-1 w-20 rounded border px-1" /></label>

          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Generated SQL <span className="text-xs font-normal text-slate-500">(read-only, parameterised)</span></h2>
              <Button variant="ghost" onClick={() => setShowSql(!showSql)} aria-expanded={showSql}>{showSql ? 'Hide' : 'Show'}</Button>
            </div>
            {showSql && (ok ? (
              <>
                <pre data-testid="sql" className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-emerald-200">{result.sql}</pre>
                {result.params.length > 0 && <p className="mt-1 text-xs text-slate-600">Parameters (sent separately, never pasted into the SQL): {result.params.map((p, i) => <code key={i} className="mr-1 rounded bg-slate-100 px-1">?{i + 1} = “{p}”</code>)}</p>}
              </>
            ) : <p className="mt-2 text-sm text-slate-500">Add an output column to see the SQL.</p>)}
          </Card>

          {result && 'error' in result && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">⚠️ {result.error}</p>}
          {ok && (
            <>
              <Card className="!p-4">
                <h2 className="mb-1 font-semibold">What this query did</h2>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-700">{result.explanation.map((e) => <li key={e}>{e}</li>)}</ol>
              </Card>
              <Card className="!p-4">
                <h2 className="mb-2 font-semibold">Results ({result.rows.length})</h2>
                {result.rows.length === 0 ? <p className="text-sm text-slate-500">No rows matched. Try removing or changing a filter.</p> : (
                  <div className="max-h-96 overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-slate-100"><tr>{result.headers.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                      <tbody>{result.rows.map((r, i) => <tr key={i} className="border-t">{r.map((v, j) => <td key={j} className={`whitespace-pre px-2 py-1 ${v === 'NULL' ? 'italic text-red-500' : ''}`}>{v}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
