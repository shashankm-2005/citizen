import { Card, PageHeader } from '../components/ui'
import { NAV } from '../components/Layout'
import { useApp } from '../store'

export default function Benefits() {
  const { modulesOpened, activities, checksRun, queriesRun, issues, changes, schema } = useApp()
  const reviewed = issues.filter((i) => i.status !== 'open').length
  const learnDone = Object.keys(activities).filter((k) => k.startsWith('learn:')).length
  const modules = NAV.filter((n) => modulesOpened.includes(n.to)).length

  // Activity evidence per benefit. These are counts of things done in this app, not measurements of skill or confidence.
  const benefits = [
    { icon: '💻', title: 'Technical Literacy', text: 'Comfort with data concepts and tools.', metric: `${modules}/${NAV.length} modules opened · ${learnDone} checkpoints` },
    { icon: '🗄️', title: 'Database Knowledge', text: 'Understanding keys, joins, and schemas.', metric: `${schema.tables.length} tables · ${schema.relationships.length} relationships saved` },
    { icon: '🧩', title: 'Problem-Solving Skills', text: 'Applying methods to real data issues.', metric: `${checksRun} checks run · ${reviewed} issues reviewed` },
    { icon: '💪', title: 'Self-Confidence', text: 'Willingness to use tech independently.', metric: `${queriesRun} queries built · ${changes.length} sandbox changes` },
  ]
  const R = 150, C = 210
  const pos = benefits.map((_, i) => { const a = (-90 + i * 90) * (Math.PI / 180); return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) } })
  const career = ['Microsoft Access', 'Database Skills', 'Technical Literacy', 'Long-Term Career Value']

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Benefits & Career Value" slide="PPT Slides 6–7" />
      <Card>
        <h2 className="text-xl font-bold">Benefits to the individual</h2>
        <div className="mt-4 grid items-center gap-6 lg:grid-cols-2">
          <svg viewBox="0 0 420 420" className="mx-auto w-full max-w-md" role="img" aria-label="Citizen Developer at the centre, connected to Technical Literacy, Database Knowledge, Problem-Solving Skills and Self-Confidence">
            <circle cx={C} cy={C} r={R} fill="none" stroke="#cbd5e1" strokeDasharray="6 6" strokeWidth={2} />
            {pos.map((p, i) => <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke="#93c5fd" strokeWidth={3} />)}
            <circle cx={C} cy={C} r={62} fill="#1d4ed8" />
            <text x={C} y={C - 4} textAnchor="middle" fill="white" fontSize="17" fontWeight="700">Citizen</text>
            <text x={C} y={C + 18} textAnchor="middle" fill="white" fontSize="17" fontWeight="700">Developer</text>
            {pos.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={44} fill="white" stroke="#1d4ed8" strokeWidth={3} />
                <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="32">{benefits[i].icon}</text>
              </g>
            ))}
          </svg>
          <ul className="grid gap-3 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b.title} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold"><span aria-hidden>{b.icon}</span> {b.title}</p>
                <p className="text-sm text-slate-600">{b.text}</p>
                <p className="mt-2 text-xs text-blue-700">Your activity: {b.metric}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Reduced dependence on IT for small projects improves agility and learning. <i>Activity counts show what you have practised in this app; they are not a scientific measure of skill or confidence.</i></p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold">Lasting career value</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          <li>Left Merck in 2000 — skills persisted beyond the job.</li>
          <li>Database concepts proved useful throughout later consulting work.</li>
          <li>LC/NC tools acted as a foundation for ongoing technical growth.</li>
        </ul>
        <ol className="mt-5 flex flex-col items-stretch gap-2 md:flex-row md:items-center" aria-label="Career progression">
          {career.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <div className="flex-1 rounded-lg p-4 text-center font-semibold text-white" style={{ background: `hsl(${220 - i * 25} 70% ${45 - i * 3}%)` }}>{s}</div>
              {i < career.length - 1 && <span aria-hidden className="hidden text-2xl text-slate-400 md:block">→</span>}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-600">This demonstrates that short-term experiments can yield long-term professional advantages.</p>
      </Card>
    </div>
  )
}
