import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import Workflow from '../components/Workflow'
import { NAV } from '../components/Layout'
import { useApp } from '../store'

export default function Welcome() {
  const opened = useApp((s) => s.modulesOpened)
  const journey = NAV.filter((n) => n.to !== '/dashboard')
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 p-8 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-200">My LC/NC Introduction to Databases — A Citizen Development Case Study</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">CitizenDB — HR Data Quality Lab</h1>
        <p className="mt-3 max-w-2xl text-blue-100">
          A hands-on, low-code/no-code style lab that recreates how one HR specialist used Microsoft Access to build database skills
          and solve real workplace data problems. Learn tables, keys, joins, ER diagrams and basic SQL by cleaning a synthetic HR dataset.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/learn" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-blue-800 shadow hover:bg-blue-50">Start Learning</Link>
          <Link to="/workspace" className="rounded-lg border border-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">Open Workspace</Link>
        </div>
        <p className="mt-6 text-xs text-blue-200">Individual-level benefits of citizen development · Low-Code/No-Code (LC/NC) · Microsoft Access · Merck, 1998</p>
      </section>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">PPT Slide 2</p>
        <h2 className="text-xl font-bold">Background of the case</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Context (1998)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Joined Merck as an HR specialist.</li>
              <li>Observed widespread issues with internal data and systems.</li>
              <li>HR data quality: incomplete, inconsistent, and with duplicates.</li>
              <li>Needed a practical way to identify and manage data problems.</li>
            </ul>
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Immediate operational pain — day-to-day HR tasks were slowed by poor data.</p>
          </div>
          <ol className="flex flex-col items-center justify-center gap-2" aria-label="Case problem flow">
            {[['👤', 'HR Employee'], ['⚠️', 'Data Problems'], ['💡', 'Need for a Solution']].map(([icon, t], k) => (
              <li key={t} className="flex flex-col items-center">
                <div className="w-56 rounded-lg border-2 border-blue-200 bg-blue-50 p-3 text-center font-semibold"><span aria-hidden>{icon}</span> {t}</div>
                {k < 2 && <span aria-hidden className="text-2xl text-blue-400">↓</span>}
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">PPT Slide 4 · live status</p>
        <h2 className="mb-3 text-xl font-bold">From learning to problem solving</h2>
        <Workflow />
        <p className="mt-2 text-xs text-slate-500">Each stage turns green when you complete it in the app.</p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold">Your learning journey</h2>
        <p className="text-sm text-slate-500">{journey.filter((j) => opened.includes(j.to)).length} of {journey.length} modules opened</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {journey.map((j, i) => (
            <li key={j.to}>
              <Link to={j.to} className={`flex items-center gap-3 rounded-lg border p-3 hover:border-blue-400 ${opened.includes(j.to) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${opened.includes(j.to) ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>{opened.includes(j.to) ? '✓' : i + 1}</span>
                <span className="text-sm"><b>{j.label}</b><br /><span className="text-xs text-slate-500">PPT {j.slide}</span></span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      <p className="text-center text-xs text-slate-500">CitizenDB is an educational recreation of the case study in the accompanying presentation. It is not an official Merck product, and the original specialist did not use this app. All employee data is synthetic.</p>
    </div>
  )
}
