import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Chip, Empty, NeedData, PageHeader, confirmDialog, toast } from '../components/ui'
import Workflow from '../components/Workflow'
import { ISSUE_LABELS } from '../lib/quality'
import type { Issue, IssueStatus, IssueType } from '../lib/types'
import { EMPLOYEE_FIELDS } from '../lib/types'
import { useApp } from '../store'

const show = (v: string) => (v === '' ? '(empty)' : v.trim() === '' ? `(whitespace ×${v.length})` : `"${v}"`)

export default function QualityLab() {
  const { source, sandbox, issues, checksRun, runChecks, reviewIssue, reopenIssue } = useApp()
  const [type, setType] = useState<IssueType | ''>('')
  const [status, setStatus] = useState<IssueStatus | ''>('open')
  const [open, setOpen] = useState<string | null>(null)
  if (!source) return <div className="mx-auto max-w-6xl"><PageHeader title="Data Quality Lab" slide="PPT Slide 4 · Targeted queries" /><NeedData /></div>

  const list = issues.filter((i) => (!type || i.issue_type === type) && (!status || i.status === status))
  const dupGroups = [...new Set(issues.filter((i) => i.issue_type === 'duplicate_id' || i.issue_type === 'duplicate_row').map((i) => i.current_value))]

  const approve = async (i: Issue) => {
    const what =
      i.fix_action === 'update' ? <>Sandbox row {i.row}, <b>{i.field_name}</b>: <code className="rounded bg-red-50 px-1">{show(i.current_value)}</code> → <code className="rounded bg-emerald-50 px-1">{show(i.suggested_value!)}</code></>
      : i.fix_action === 'exclude' ? <>Sandbox row {i.row} will be <b>excluded</b> (not deleted). You can restore it in the Sandbox.</>
      : <>No automatic value change. The issue is marked reviewed; make the actual edit in the <b>Sandbox</b>.</>
    if ((await confirmDialog({ title: 'Approve correction in the sandbox?', body: <div className="space-y-2"><p>{what}</p><p className="text-xs">The protected source dataset is not changed.</p></div>, confirm: 'Approve' })) === null) return
    reviewIssue(i.issue_id, 'approved')
    toast(i.fix_action === 'none' ? 'Marked as reviewed. Edit the value in the Sandbox.' : 'Correction applied to the sandbox and logged.')
  }
  const reject = async (i: Issue) => {
    const reason = await confirmDialog({ title: 'Dismiss this flag?', body: 'Explain why this is not a real problem (kept in the audit trail).', input: 'Reason', confirm: 'Dismiss' })
    if (reason === null) return
    reviewIssue(i.issue_id, 'rejected', reason)
    toast('Issue dismissed with reason.', 'info')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Data Quality Lab" slide="PPT Slide 4 · Targeted queries find duplicates, nulls and inconsistent entries">
        <Button variant="primary" onClick={() => { runChecks(); toast('Checks re-run on the protected source snapshot. Earlier review decisions were kept.') }}>▶ Run checks</Button>
      </PageHeader>
      <Card className="!p-4"><Workflow /></Card>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        ℹ️ Automated checks flag <b>possible</b> issues on the protected source. A human reviews each one. Approving applies the correction to the <Link className="underline" to="/sandbox">sandbox</Link> only — records are never deleted and the source is never rewritten.
      </p>

      {checksRun === 0 ? <Empty title="Checks have not run yet">Press <b>Run checks</b> to scan {source.employees.length} records.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {(Object.keys(ISSUE_LABELS) as IssueType[]).map((t) => {
              const n = issues.filter((i) => i.issue_type === t).length
              return (
                <button key={t} onClick={() => setType(type === t ? '' : t)} aria-pressed={type === t} className={`rounded-lg border p-3 text-left ${type === t ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <div className="text-2xl font-bold tabular-nums">{n}</div><div className="text-xs text-slate-600">{ISSUE_LABELS[t]}</div>
                </button>
              )
            })}
          </div>

          {dupGroups.length > 0 && (
            <Card>
              <h2 className="font-semibold">Duplicate groups</h2>
              <p className="text-sm text-slate-500">Rule: rows are grouped by employee_id; any group with more than one row is shown in full. Identical copies are “duplicate rows”; different people sharing an ID are “duplicate IDs”.</p>
              <div className="mt-3 space-y-3">
                {dupGroups.map((id) => (
                  <div key={id} className="overflow-x-auto rounded border">
                    <p className="bg-slate-50 px-3 py-1 text-sm font-semibold">employee_id {id}</p>
                    <table className="min-w-full text-xs"><tbody>
                      {source.employees.filter((r) => r.employee_id.trim() === id).map((r) => (
                        <tr key={r._row} className="border-t"><td className="px-2 py-1 text-slate-400">row {r._row}</td>{EMPLOYEE_FIELDS.map((f) => <td key={f} className="px-2 py-1">{r[f]}</td>)}</tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">Issues ({list.length})</h2>
              <label className="text-sm">Type <select value={type} onChange={(e) => setType(e.target.value as IssueType)} className="ml-1 rounded border px-2 py-1"><option value="">All</option>{Object.entries(ISSUE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="text-sm">Status <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className="ml-1 rounded border px-2 py-1"><option value="">All</option><option value="open">Open</option><option value="approved">Approved</option><option value="rejected">Dismissed</option></select></label>
            </div>
            {list.length === 0 ? <Empty title={issues.length ? 'Nothing matches these filters' : 'No issues detected 🎉'}>{status === 'open' && issues.length > 0 && 'All issues in this view have been reviewed.'}</Empty> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                    <tr><th className="px-2 py-2">Issue</th><th className="px-2 py-2">Table</th><th className="px-2 py-2">Record</th><th className="px-2 py-2">Field</th><th className="px-2 py-2">Value</th><th className="px-2 py-2">Explanation</th><th className="px-2 py-2">Recommended fix</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const sbx = sandbox?.employees.find((r) => r._row === i.row)
                      const src = source.employees.find((r) => r._row === i.row)!
                      return (
                        <Fragment key={i.issue_id}>
                          <tr className="border-t align-top">
                            <td className="px-2 py-2 font-medium">{ISSUE_LABELS[i.issue_type]}</td>
                            <td className="px-2 py-2">{i.table_name}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{i.record_key}</td>
                            <td className="px-2 py-2"><code>{i.field_name}</code></td>
                            <td className="px-2 py-2 whitespace-pre"><code className="text-xs">{show(i.current_value)}</code></td>
                            <td className="max-w-xs px-2 py-2">{i.explanation}<p className="mt-1 text-xs text-slate-500">Rule: {i.rule}</p></td>
                            <td className="max-w-xs px-2 py-2">{i.recommended_fix}{i.suggested_value != null && <p className="mt-1 text-xs">Suggested: <code className="rounded bg-emerald-50 px-1">{show(i.suggested_value)}</code></p>}</td>
                            <td className="px-2 py-2"><Chip tone={i.status}>{i.status === 'rejected' ? 'dismissed' : i.status}</Chip>{i.reason && <p className="mt-1 text-xs text-slate-500">“{i.reason}”</p>}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-col gap-1">
                                <Button variant="ghost" aria-expanded={open === i.issue_id} onClick={() => setOpen(open === i.issue_id ? null : i.issue_id)}>Inspect</Button>
                                {i.status === 'open' ? (<>
                                  <Button variant="primary" onClick={() => approve(i)}>Approve</Button>
                                  <Button onClick={() => reject(i)}>Dismiss</Button>
                                </>) : <Button variant="ghost" onClick={() => reopenIssue(i.issue_id)}>Reopen</Button>}
                              </div>
                            </td>
                          </tr>
                          {open === i.issue_id && (
                            <tr className="bg-slate-50"><td colSpan={9} className="px-4 py-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                {[['🔒 Protected source (row ' + i.row + ')', src], ['🧪 Sandbox copy', sbx]].map(([label, r]) => (
                                  <div key={label as string}>
                                    <p className="text-xs font-semibold">{label as string}{r && (r as typeof src)._excluded ? ' — excluded' : ''}</p>
                                    {r ? (
                                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
                                        {EMPLOYEE_FIELDS.map((f) => <Fragment key={f}><dt className={f === i.field_name ? 'font-bold text-amber-700' : 'text-slate-500'}>{f}</dt><dd className="whitespace-pre">{show((r as typeof src)[f])}</dd></Fragment>)}
                                      </dl>
                                    ) : <p className="text-xs">Not available</p>}
                                  </div>
                                ))}
                              </div>
                            </td></tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
