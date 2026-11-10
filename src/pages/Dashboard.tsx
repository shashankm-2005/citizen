import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import Workflow from '../components/Workflow'
import { ISSUE_LABELS } from '../lib/quality'
import { useApp } from '../store'

export default function Dashboard() {
  const { source, issues, checksRun, queriesRun, changes, sandbox, schema } = useApp()
  const inspected = new Set(issues.filter((i) => i.status !== 'open').map((i) => i.row)).size
  const cards = [
    { label: 'Records imported', value: source?.employees.length ?? 0, tone: 'text-slate-900' },
    { label: 'Records inspected', value: inspected, tone: 'text-blue-700', hint: 'records with a reviewed issue' },
    { label: 'Issues detected', value: issues.length, tone: 'text-amber-700' },
    { label: 'Issues resolved', value: issues.filter((i) => i.status === 'approved').length, tone: 'text-emerald-700', hint: `${issues.filter((i) => i.status === 'rejected').length} dismissed` },
    { label: 'Issues remaining', value: issues.filter((i) => i.status === 'open').length, tone: 'text-red-700' },
  ]
  const byType = Object.entries(ISSUE_LABELS).map(([t, label]) => {
    const of = issues.filter((i) => i.issue_type === t)
    return { label, n: of.length, open: of.filter((i) => i.status === 'open').length }
  })
  const max = Math.max(1, ...byType.map((b) => b.n))
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="!p-4">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${c.tone}`} data-testid={c.label}>{c.value}</p>
            {c.hint && <p className="text-[11px] text-slate-400">{c.hint}</p>}
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {[['/workspace', '⬆️ Import Data'], ['/quality', '🔍 Open Data Quality Lab'], ['/designer', '🧩 Design Database'], ['/query', '⚡ Open Query Builder']].map(([to, l]) => (
            <Link key={to} to={to} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{l}</Link>
          ))}
        </div>
      </Card>
      <Card><h2 className="mb-3 font-semibold">Workflow progress</h2><Workflow /></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Issues by rule</h2>
          {issues.length === 0 ? <p className="text-sm text-slate-500">{checksRun ? 'No issues found.' : 'Run the checks in the Data Quality Lab to see results.'}</p> : (
            <ul className="space-y-2">
              {byType.map((b) => (
                <li key={b.label} className="text-sm">
                  <div className="flex justify-between"><span>{b.label}</span><span className="tabular-nums text-slate-500">{b.open} open / {b.n}</span></div>
                  <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-amber-400" style={{ width: `${(b.n / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Activity</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {([['Quality checks run', checksRun], ['Queries run', queriesRun], ['Sandbox changes', changes.length], ['Sandbox resets', sandbox?.reset_count ?? 0], ['Tables designed', schema.tables.length], ['Relationships', schema.relationships.length]] as const).map(([k, v]) => (
              <div key={k} className="rounded-md bg-slate-50 p-3"><dt className="text-slate-500">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}
