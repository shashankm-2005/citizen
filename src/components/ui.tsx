import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { create } from 'zustand'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const V: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
}
export function Button({ variant = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...p} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${V[variant]} ${className}`} />
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>
)

const CHIP: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-slate-200 text-slate-700',
  update: 'bg-blue-100 text-blue-800', exclude: 'bg-red-100 text-red-800', restore: 'bg-emerald-100 text-emerald-800',
}
export const Chip = ({ children, tone }: { children: ReactNode; tone?: string }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[tone ?? String(children)] ?? 'bg-slate-100 text-slate-700'}`}>{children}</span>
)

export function PageHeader({ title, slide, children }: { title: string; slide?: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {slide && <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{slide}</p>}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <div className="mt-2 text-sm text-slate-500">{children}</div>
    </div>
  )
}

export const NeedData = () => (
  <Empty title="No HR data loaded yet">
    Load the synthetic sample or upload a CSV in the <Link className="text-blue-600 underline" to="/workspace">HR Data Workspace</Link>.
  </Empty>
)

export function SandboxBanner({ mode }: { mode: 'sandbox' | 'source' }) {
  return mode === 'sandbox' ? (
    <div role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      🧪 <b>Sandbox (experimental copy).</b> Changes here are safe and can be reset. The protected source dataset is never modified.
    </div>
  ) : (
    <div role="note" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
      🔒 <b>Protected source dataset (read-only).</b> This is the original import snapshot. Practise corrections in the sandbox.
    </div>
  )
}

/* ---------- Toasts ---------- */
interface Toast { id: number; text: string; tone: 'success' | 'error' | 'info' }
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (t) => { const id = Date.now() + Math.random(); set((s) => ({ list: [...s.list, { ...t, id }] })); setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 4500) },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}))
export const toast = (text: string, tone: Toast['tone'] = 'success') => useToasts.getState().push({ text, tone })
export function Toasts() {
  const { list, drop } = useToasts()
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {list.map((t) => (
        <div key={t.id} className={`flex items-start justify-between gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.tone === 'error' ? 'bg-red-600' : t.tone === 'info' ? 'bg-slate-700' : 'bg-emerald-600'}`}>
          <span>{t.text}</span>
          <button aria-label="Dismiss" onClick={() => drop(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}

/* ---------- Confirm / prompt dialog ---------- */
interface Ask { title: string; body?: ReactNode; confirm: string; danger?: boolean; input?: string; resolve: (v: string | null) => void }
const useAsk = create<{ ask: Ask | null; set: (a: Ask | null) => void }>((set) => ({ ask: null, set: (ask) => set({ ask }) }))

/** Resolves to '' (or the typed text when `input` is given) on confirm, null on cancel. */
export const confirmDialog = (o: Omit<Ask, 'resolve'>) => new Promise<string | null>((resolve) => useAsk.getState().set({ ...o, resolve }))

export function DialogHost() {
  const { ask, set } = useAsk()
  const [text, setText] = useState('')
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ask) { setText(''); ref.current?.showModal() } else ref.current?.close()
  }, [ask])
  if (!ask) return <dialog ref={ref} />
  const done = (v: string | null) => { ask.resolve(v); set(null) }
  const needsText = ask.input != null && !text.trim()
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); done(null) }} className="m-auto w-[min(28rem,92vw)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40">
      <form method="dialog" className="p-6" onSubmit={(e) => { e.preventDefault(); if (!needsText) done(text.trim()) }}>
        <h2 className="text-lg font-semibold">{ask.title}</h2>
        {ask.body && <div className="mt-2 text-sm text-slate-600">{ask.body}</div>}
        {ask.input != null && (
          <label className="mt-3 block text-sm font-medium">
            {ask.input}
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => done(null)}>Cancel</Button>
          <button type="submit" disabled={needsText} className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${ask.danger ? 'bg-red-600' : 'bg-blue-600'}`}>{ask.confirm}</button>
        </div>
      </form>
    </dialog>
  )
}
