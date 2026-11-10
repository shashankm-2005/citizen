import { Link } from 'react-router-dom'
import { Button, Card, PageHeader, confirmDialog, toast } from '../components/ui'
import { useApp } from '../store'

const TAKEAWAYS = [
  ['🙋', 'Participation', 'Citizen development lets business users contribute to technology solutions.'],
  ['🚪', 'Accessibility', 'LC/NC tools lower barriers to technical learning.'],
  ['🔬', 'Learning Opportunity', 'Real problems become practical learning labs.'],
  ['🧪', 'Safe Experimentation', 'Sandboxed work reduces risk and builds confidence.'],
  ['📈', 'Long-Term Value', 'Skills gained via LC/NC support careers beyond the original role.'],
]

export default function Takeaways() {
  const { issues, checksRun, queriesRun, changes, resetAll } = useApp()
  const restart = async () => {
    if ((await confirmDialog({ title: 'Restart the guided demo?', body: 'Clears all data, reviews, schema and progress stored in this browser.', confirm: 'Restart', danger: true })) === null) return
    resetAll()
    toast('Demo reset. Start again from the Welcome page.', 'info')
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Key Takeaways" slide="PPT Slide 8" />
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TAKEAWAYS.map(([icon, title, text], i) => (
          <li key={title}>
            <Card className="h-full">
              <p className="text-3xl" aria-hidden>{icon}</p>
              <h2 className="mt-2 font-bold">{i + 1}. {title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Card>
          </li>
        ))}
      </ol>
      <p className="rounded-xl bg-blue-700 p-5 text-center text-lg font-semibold text-white">Citizen development is not only about building applications — it is also about building technical capability.</p>
      <Card className="text-center">
        <p className="text-4xl font-bold text-slate-900">Thank you 🎉</p>
        <p className="mt-2 text-sm text-slate-600">
          In this session you ran {checksRun} quality check(s), reviewed {issues.filter((i) => i.status !== 'open').length} of {issues.length} flagged issue(s), built {queriesRun} query/queries and made {changes.length} safe sandbox change(s) — without touching the protected source.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link to="/dashboard" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Back to dashboard</Link>
          <Button onClick={restart}>Restart guided demo</Button>
        </div>
      </Card>
    </div>
  )
}
