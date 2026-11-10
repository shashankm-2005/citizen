import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SAMPLE_DEPARTMENTS, SAMPLE_EMPLOYEES } from './data/sample'
import { detectIssues, mergeIssues } from './lib/quality'
import { createSandbox, editField, resetSandbox, setExcluded, uid } from './lib/sandbox'
import type { Schema } from './lib/schema'
import type { Department, EmployeeField, EmployeeRow, ImportBatch, Issue, SandboxChange, SandboxSession } from './lib/types'

interface Source { batch_id: string; employees: EmployeeRow[] }

interface State {
  departments: Department[]
  batches: ImportBatch[]
  /** Protected, immutable import snapshot. Only `importBatch` replaces it (with a new snapshot); nothing edits it. */
  source: Source | null
  sandbox: SandboxSession | null
  changes: SandboxChange[]
  issues: Issue[]
  checksRun: number
  queriesRun: number
  schema: Schema
  schemaSavedAt: string | null
  modulesOpened: string[]
  activities: Record<string, string> // activity id -> completed_at

  importBatch: (fileName: string, rows: EmployeeRow[], summary: string) => void
  runChecks: () => void
  reviewIssue: (id: string, decision: 'approved' | 'rejected', reason?: string) => void
  reopenIssue: (id: string) => void
  editSandbox: (row: number, field: EmployeeField, value: string, issueId?: string) => void
  excludeSandboxRow: (row: number, excluded: boolean, issueId?: string) => void
  resetSandbox: () => void
  saveSchema: (s: Schema) => void
  openModule: (id: string) => void
  completeActivity: (id: string) => void
  countQuery: () => void
  resetAll: () => void
}

const initial = {
  departments: SAMPLE_DEPARTMENTS, batches: [], source: null, sandbox: null, changes: [], issues: [],
  checksRun: 0, queriesRun: 0, schema: { tables: [], relationships: [] }, schemaSavedAt: null, modulesOpened: [], activities: {},
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      importBatch: (fileName, rows, summary) => {
        const batch: ImportBatch = { batch_id: uid('batch'), file_name: fileName, imported_at: new Date().toISOString(), row_count: rows.length, validation_summary: summary }
        const employees = structuredClone(rows)
        set((s) => ({
          batches: [batch, ...s.batches],
          source: { batch_id: batch.batch_id, employees },
          sandbox: createSandbox(employees, batch.batch_id),
          changes: [],
          issues: [],
        }))
      },
      runChecks: () => {
        const { source, departments, issues } = get()
        if (!source) return
        set((s) => ({ issues: mergeIssues(issues, detectIssues(source.employees, departments, source.batch_id)), checksRun: s.checksRun + 1 }))
      },
      reviewIssue: (id, decision, reason) => {
        const s = get()
        const issue = s.issues.find((i) => i.issue_id === id)
        if (!issue || !s.sandbox) return
        let session = s.sandbox
        const newChanges: SandboxChange[] = []
        if (decision === 'approved' && issue.fix_action === 'update' && issue.suggested_value != null && issue.field_name !== '*') {
          const r = editField(session, issue.row, issue.field_name, issue.suggested_value, id)
          session = r.session
          if (r.change) newChanges.push(r.change)
        }
        if (decision === 'approved' && issue.fix_action === 'exclude') {
          const r = setExcluded(session, issue.row, true, id)
          session = r.session
          newChanges.push(r.change)
        }
        set({
          sandbox: session,
          changes: [...newChanges, ...s.changes],
          issues: s.issues.map((i) => (i.issue_id === id ? { ...i, status: decision, reason, updated_at: new Date().toISOString() } : i)),
        })
      },
      reopenIssue: (id) => set((s) => ({ issues: s.issues.map((i) => (i.issue_id === id ? { ...i, status: 'open', reason: undefined, updated_at: new Date().toISOString() } : i)) })),
      editSandbox: (row, field, value, issueId) => {
        const s = get()
        if (!s.sandbox) return
        const r = editField(s.sandbox, row, field, value, issueId)
        if (r.change) set({ sandbox: r.session, changes: [r.change, ...s.changes] })
      },
      excludeSandboxRow: (row, excluded, issueId) => {
        const s = get()
        if (!s.sandbox) return
        const r = setExcluded(s.sandbox, row, excluded, issueId)
        set({ sandbox: r.session, changes: [r.change, ...s.changes] })
      },
      resetSandbox: () => {
        const s = get()
        if (!s.sandbox || !s.source) return
        // Reviews that changed sandbox data go back to "open" because their effect is undone.
        const touched = new Set(s.changes.map((c) => c.issue_id).filter(Boolean))
        set({
          sandbox: resetSandbox(s.sandbox, s.source.employees),
          changes: [],
          issues: s.issues.map((i) => (touched.has(i.issue_id) && i.status === 'approved' ? { ...i, status: 'open', updated_at: new Date().toISOString() } : i)),
        })
      },
      saveSchema: (schema) => set({ schema: structuredClone(schema), schemaSavedAt: new Date().toISOString() }),
      openModule: (id) => set((s) => (s.modulesOpened.includes(id) ? s : { modulesOpened: [...s.modulesOpened, id] })),
      completeActivity: (id) => set((s) => ({ activities: { ...s.activities, [id]: s.activities[id] ?? new Date().toISOString() } })),
      countQuery: () => set((s) => ({ queriesRun: s.queriesRun + 1 })),
      resetAll: () => set({ ...initial }),
    }),
    { name: 'citizendb-v1' },
  ),
)

export const loadSample = () => useApp.getState().importBatch('citizendb_sample_employees.csv (built-in)', SAMPLE_EMPLOYEES, `${SAMPLE_EMPLOYEES.length} rows accepted, 0 rejected`)
