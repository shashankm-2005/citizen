import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../components/DataTable'
import { Button, Card, Empty, PageHeader, SandboxBanner, confirmDialog, toast } from '../components/ui'
import { SAMPLE_EMPLOYEES, toCsv } from '../data/sample'
import { autoMap, checkFile, MAX_FILE_BYTES, parseCsv, REQUIRED_HEADERS, toRows, validateImport, type ParsedCsv } from '../lib/csv'
import type { EmployeeField } from '../lib/types'
import { EMPLOYEE_FIELDS } from '../lib/types'
import { loadSample, useApp } from '../store'

type Pending = { name: string; parsed: ParsedCsv; mapping: Record<EmployeeField, string> }

export default function Workspace() {
  const { source, sandbox, batches, importBatch, runChecks } = useApp()
  const [pending, setPending] = useState<Pending | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'source' | 'sandbox'>('source')

  const replaceOk = async () =>
    !source || (await confirmDialog({ title: 'Replace current data?', body: 'This creates a new protected source snapshot and a fresh sandbox. Existing sandbox changes and issue reviews for the old batch will be cleared. Earlier batches stay in the import history.', confirm: 'Replace' })) !== null

  const onSample = async () => {
    if (!(await replaceOk())) return
    loadSample()
    runChecks()
    toast(`Loaded ${SAMPLE_EMPLOYEES.length} synthetic sample rows and ran the data-quality checks.`)
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(SAMPLE_EMPLOYEES)], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'citizendb_sample_employees.csv' }).click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | undefined) => {
    setPending(null)
    setFileError(null)
    if (!file) return
    const err = checkFile(file.name, file.size, file.type)
    if (err) return setFileError(err)
    setLoading(true)
    try {
      const parsed = parseCsv(await file.text())
      setPending({ name: file.name, parsed, mapping: autoMap(parsed.headers) })
    } catch {
      setFileError('The file could not be read as CSV text.')
    } finally {
      setLoading(false)
    }
  }

  const errors = pending ? validateImport(pending.parsed, pending.mapping) : []
  const confirmImport = async () => {
    if (!pending || errors.length || !(await replaceOk())) return
    const rows = toRows(pending.parsed, pending.mapping)
    importBatch(pending.name, rows, `${rows.length} rows accepted, 0 rejected; mapped ${Object.values(pending.mapping).filter(Boolean).length}/${EMPLOYEE_FIELDS.length} fields`)
    runChecks()
    setPending(null)
    toast(`Imported ${rows.length} rows from ${pending.name}. Data-quality checks ran automatically.`)
  }

  const rows = view === 'source' ? source?.employees : sandbox?.employees

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="HR Data Workspace" slide="PPT Slide 4 · HR Data" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold">1 · Use the synthetic sample</h2>
          <p className="mt-1 text-sm text-slate-600">{SAMPLE_EMPLOYEES.length} made-up employees with deliberately seeded problems: duplicates, blanks, bad emails, formatting and a broken department reference.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onSample}>Load sample dataset</Button>
            <Button onClick={download}>⬇ Download sample CSV</Button>
          </div>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="font-semibold">2 · Or upload your own CSV</h2>
          <p className="mt-1 text-sm text-slate-600">.csv only, up to {MAX_FILE_BYTES / 1024} KB. Required columns: {REQUIRED_HEADERS.join(', ')}. Please use synthetic data — never real employee records.</p>
          <label className="mt-3 block">
            <span className="sr-only">Choose CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-medium file:text-blue-700" />
          </label>
          {loading && <p className="mt-2 text-sm text-slate-500" role="status">Reading file…</p>}
          {fileError && <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">⛔ {fileError}</p>}
        </Card>
      </div>

      {pending && (
        <Card className="border-blue-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Preview & map columns — {pending.name}</h2>
            <span className="text-sm text-slate-500">{pending.parsed.data.length} data rows · {pending.parsed.headers.length} columns</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {EMPLOYEE_FIELDS.map((f) => (
              <label key={f} className="text-sm">
                <span className="font-medium">{f}{REQUIRED_HEADERS.includes(f) && <span className="text-red-600"> *</span>}</span>
                <select value={pending.mapping[f]} onChange={(e) => setPending({ ...pending, mapping: { ...pending.mapping, [f]: e.target.value } })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1">
                  <option value="">(not mapped)</option>
                  {pending.parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded border">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50"><tr>{pending.parsed.headers.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{pending.parsed.data.slice(0, 8).map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="whitespace-pre px-2 py-1">{c}</td>)}</tr>)}</tbody>
            </table>
            {pending.parsed.data.length > 8 && <p className="px-2 py-1 text-xs text-slate-500">Showing first 8 rows.</p>}
          </div>
          {errors.length > 0 ? (
            <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Import blocked — fix these problems first (nothing has been imported):</p>
              <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">✅ Structure is valid. Values are imported exactly as-is into a protected raw snapshot; the Data Quality Lab will flag problems for review.</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="primary" disabled={errors.length > 0} onClick={confirmImport}>Confirm import</Button>
            <Button onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Employee records</h2>
          <div role="tablist" className="flex rounded-lg border p-0.5 text-sm">
            {(['source', 'sandbox'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 ${view === v ? 'bg-slate-800 text-white' : ''}`}>{v === 'source' ? '🔒 Protected source' : '🧪 Sandbox'}</button>
            ))}
          </div>
        </div>
        {rows ? (<><SandboxBanner mode={view} /><DataTable rows={rows} /></>) : (
          <Empty title="No data yet">Load the synthetic sample or upload a CSV above to get started.</Empty>
        )}
        {source && <p className="mt-3 text-sm"><Link className="text-blue-600 underline" to="/quality">Next: review issues in the Data Quality Lab →</Link></p>}
      </Card>

      {batches.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Import history</h2>
          <ul className="divide-y text-sm">
            {batches.map((b) => (
              <li key={b.batch_id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{b.file_name}</b> · {b.row_count} rows · {b.validation_summary}</span>
                <span className="text-slate-500">{new Date(b.imported_at).toLocaleString()} {b.batch_id === source?.batch_id && '· current'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
