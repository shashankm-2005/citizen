import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../store'
import { DialogHost, Toasts } from './ui'

export const NAV = [
  { to: '/', label: 'Welcome / Case Study', icon: '🏠', slide: 'Slides 1–2' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/learn', label: 'Learning Centre', icon: '🎓', slide: 'Slide 3' },
  { to: '/workspace', label: 'HR Data Workspace', icon: '🗂️', slide: 'Slide 4' },
  { to: '/quality', label: 'Data Quality Lab', icon: '🔍', slide: 'Slide 4' },
  { to: '/designer', label: 'Database Designer', icon: '🧩', slide: 'Slide 3' },
  { to: '/query', label: 'Query Builder & SQL Lab', icon: '⚡', slide: 'Slides 3–4' },
  { to: '/sandbox', label: 'Sandbox / Change Review', icon: '🧪', slide: 'Slide 5' },
  { to: '/benefits', label: 'Benefits & Career Value', icon: '🌱', slide: 'Slides 6–7' },
  { to: '/takeaways', label: 'Key Takeaways', icon: '🏁', slide: 'Slide 8' },
]

export default function Layout() {
  const { pathname } = useLocation()
  const openModule = useApp((s) => s.openModule)
  const [menu, setMenu] = useState(false)
  useEffect(() => { openModule(pathname); setMenu(false) }, [pathname, openModule])
  const current = NAV.find((n) => n.to === pathname)

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
      <aside className={`${menu ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-slate-900 text-slate-200 lg:sticky lg:top-0 lg:block lg:h-screen`}>
        <div className="px-5 py-5">
          <p className="text-lg font-bold text-white">🗄️ CitizenDB</p>
          <p className="text-xs text-slate-400">HR Data Quality Lab</p>
        </div>
        <nav aria-label="Main">
          <ul className="space-y-0.5 px-2 pb-6">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end className={({ isActive }) => `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                  <span aria-hidden>{n.icon}</span>{n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="px-5 pb-5 text-[11px] leading-snug text-slate-500">Educational recreation of a case study. Not an official Merck product. Synthetic data only.</p>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenu(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <button className="rounded-md border px-2 py-1 lg:hidden" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
          <span className="text-sm font-semibold text-slate-700">{current?.label ?? 'CitizenDB'}</span>
          {current?.slide && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">PPT {current.slide}</span>}
          <span className="ml-auto hidden text-xs text-slate-500 sm:inline">Local demo mode · data stored in this browser</span>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">
          <Outlet />
        </main>
      </div>
      <Toasts />
      <DialogHost />
    </div>
  )
}
