import { useMemo, useState } from 'react'
import DataTable from '../components/DataTable'
import { Button, Card, Chip, NeedData, PageHeader, SandboxBanner, confirmDialog, toast } from '../components/ui'
import { detectIssues } from '../lib/quality'
import { fingerprint } from '../lib/sandbox'
import type { EmployeeField, EmployeeRow } from '../lib/types'
import { useApp } from '../store'

function EditableCell({ row, field }: { row: EmployeeRow; field: EmployeeField }) {
  const editSandbox = useApp((s) => s.editSandbox)
  const source = useApp((s) => s.source)
  const [draft, setDraft] = useState<string | null>(null)
  const original = source?.employees.find((r) => r._row === row._row)?.[field]
  const changed = original !== row[field]
  if (draft !== null) {
    const commit = () => { if (draft !== row[field]) { editSandbox(row._row, field, draft); toast(`Sandbox row ${row._row} · ${field} updated.`) } setDraft(null) }
    return <input autoFocus aria-label={`Edit ${field} for row ${row._row}`} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(null) }} className="w-full min-w-24 rounded border border-blue-400 px-1" />
  }
  return (
    <button disabled={row._excluded} onClick={() => setDraft(row[field])} title={changed ? `Source value: "${original}"` : 'Click to edit'}
      className={`w-full rounded px-1 text-left hover:bg-blue-50 ${changed ? 'bg-amber-100 font-medium' : ''}`}>
      {row[field].trim() === '' ? <span className="text-xs italic text-red-500">{row[field] === '' ? 'empty' : 'blank'}</span> : row[field]}
    </button>
  )
}

export default function Sandbox() {
  const { source, sandbox, changes, departments, resetSandbox, excludeSandboxRow } = useApp()
  const sourceFp = useMemo(() => (source ? fingerprint(source.employees) : ''), [source])
  const sandboxFp = useMemo(() => (sandbox ? fingerprint(sandbox.employees) : ''), [sandbox])
  const remaining = useMemo(() => (sandbox ? detectIssues(sandbox.employees, departments, sandbox.baseline_batch_id).length : 0), [sandbox, departments])
  const sourceIssues = useMemo(() => (source ? detectIssues(source.employees, departments, source.batch_id).length : 0), [source, departments])
  if (!source || !sandbox) return <div className="mx-auto max-w-6xl"><PageHeader title="Sandbox / Change Review" slide="PPT Slide 5 · Safe experimentation" /><NeedData /></div>

  const reset = async () => {
    if ((await confirmDialog({ title: 'Reset the sandbox?', body: `This discards ${changes.length} sandbox change(s) and restores the baseline copy of the source. Approved corrections that changed data are reopened. The protected source is not affected.`, confirm: 'Reset sandbox', danger: true })) === null) return
    resetSandbox()
    toast('Sandbox restored to its baseline. Source unchanged.')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Sandbox / Change Review" slide="PPT Slide 5 · Safe experimentation">
        <Button variant="danger" onClick={reset}>⟲ Reset sandbox</Button>
      </PageHeader>
      <SandboxBanner mode="sandbox" />

      <Card>
        <h2 className="text-lg font-bold">“Training wheels” approach</h2>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
          <li>Databases kept separate from critical systems.</li>
          <li>Isolated files reduced risk of accidental production changes.</li>
          <li>Permitted rapid iteration and learning from errors.</li>
        </ul>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold">🧪 Experimental database → <span className="text-amber-700">Safe learning</span></p>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <dt>Session</dt><dd className="font-mono text-xs">{sandbox.session_id}</dd>
              <dt>Changes</dt><dd>{changes.length}</dd>
              <dt>Resets</dt><dd>{sandbox.reset_count}{sandbox.last_reset_at && ` (last ${new Date(sandbox.last_reset_at).toLocaleTimeString()})`}</dd>
              <dt>Issues if re-checked now</dt><dd>{remaining}</dd>
              <dt>Fingerprint</dt><dd className="font-mono">{sandboxFp}</dd>
            </dl>
          </div>
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <p className="font-semibold">🔒 Critical source data → <span className="text-emerald-700">Protected</span></p>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <dt>Batch</dt><dd className="font-mono text-xs">{source.batch_id}</dd>
              <dt>Rows</dt><dd>{source.employees.length}</dd>
              <dt>Edits allowed</dt><dd>None (read-only)</dd>
              <dt>Issues detected</dt><dd>{sourceIssues}</dd>
              <dt>Fingerprint</dt><dd className="font-mono">{sourceFp}</dd>
            </dl>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">This approach preserves operational integrity while encouraging experimentation. The source fingerprint never changes, however many sandbox edits or resets you make; the sandbox fingerprint matches it again after a reset.</p>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Sandbox records</h2>
        <p className="mb-3 text-sm text-slate-500">Click a cell to edit (Enter to save, Esc to cancel). Highlighted cells differ from the source — hover to see the original.</p>
        <DataTable rows={sandbox.employees} renderCell={(r, f) => <EditableCell row={r} field={f} />}
          extra={{ header: 'Row', cell: (r) => <Button variant="ghost" onClick={() => { excludeSandboxRow(r._row, !r._excluded); toast(r._excluded ? `Row ${r._row} restored.` : `Row ${r._row} excluded from the sandbox (not deleted).`, 'info') }}>{r._excluded ? 'Restore' : 'Exclude'}</Button> }} />
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Change log — before / after ({changes.length})</h2>
        {changes.length === 0 ? <p className="text-sm text-slate-500">No sandbox changes yet. Approve a correction in the Data Quality Lab or edit a cell above.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600"><tr><th className="px-2 py-2">When</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Record</th><th className="px-2 py-2">Field</th><th className="px-2 py-2">Before</th><th className="px-2 py-2">After</th><th className="px-2 py-2">Source</th></tr></thead>
              <tbody>
                {changes.map((ch) => (
                  <tr key={ch.change_id} className="border-t">
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{new Date(ch.timestamp).toLocaleTimeString()}</td>
                    <td className="px-2 py-1.5"><Chip tone={ch.action}>{ch.action}</Chip></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{ch.record_key}</td>
                    <td className="px-2 py-1.5"><code>{ch.field_name}</code></td>
                    <td className="px-2 py-1.5 whitespace-pre"><code className="rounded bg-red-50 px-1">{ch.before_value || '(empty)'}</code></td>
                    <td className="px-2 py-1.5 whitespace-pre"><code className="rounded bg-emerald-50 px-1">{ch.after_value || '(empty)'}</code></td>
                    <td className="px-2 py-1.5 text-xs text-slate-500">{ch.issue_id ? 'approved issue' : 'manual edit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
