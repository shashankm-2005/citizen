import { Link } from 'react-router-dom'
import { useApp } from '../store'

/** Slide 4 workflow. Stateful: each stage is ticked by what the learner has actually done. */
export default function Workflow() {
  const { source, checksRun, queriesRun, issues } = useApp()
  const found = issues.filter((i) => ['duplicate_id', 'duplicate_row', 'missing_value'].includes(i.issue_type)).length
  const steps = [
    { label: 'HR Data', detail: source ? `${source.employees.length} rows loaded` : 'Not loaded', done: !!source, to: '/workspace' },
    { label: 'Database Workspace', detail: source ? 'Isolated sandbox ready' : 'Waiting for data', done: !!source, to: '/sandbox' },
    { label: 'Queries / Analysis', detail: `${checksRun} checks · ${queriesRun} queries`, done: checksRun > 0 || queriesRun > 0, to: '/query' },
    { label: 'Duplicate & Missing Records Identified', detail: checksRun ? `${found} duplicate/missing flags` : 'Run the checks', done: checksRun > 0 && found > 0, to: '/quality' },
  ]
  return (
    <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center" aria-label="HR data workflow">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-2">
          <Link to={s.to} className={`flex-1 rounded-lg border-2 p-3 text-center transition hover:shadow ${s.done ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="text-sm font-semibold">{s.done ? '✅ ' : '○ '}{s.label}</div>
            <div className="text-xs text-slate-500">{s.detail}</div>
          </Link>
          {i < steps.length - 1 && <span aria-hidden className="hidden text-xl text-slate-400 md:block">→</span>}
        </li>
      ))}
    </ol>
  )
}
