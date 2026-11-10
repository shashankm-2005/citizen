import type { EmployeeField, EmployeeRow, SandboxChange, SandboxSession } from './types'

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** Recursively freezes so any accidental write to the protected source throws (in strict mode). */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}

export function createSandbox(source: readonly EmployeeRow[], batchId: string): SandboxSession {
  return { session_id: uid('sbx'), baseline_batch_id: batchId, created_at: new Date().toISOString(), status: 'active', reset_count: 0, employees: structuredClone(source) as EmployeeRow[] }
}

export function resetSandbox(s: SandboxSession, source: readonly EmployeeRow[]): SandboxSession {
  return { ...s, employees: structuredClone(source) as EmployeeRow[], reset_count: s.reset_count + 1, last_reset_at: new Date().toISOString() }
}

const recordKey = (r: EmployeeRow) => `${r.employee_id.trim() || '(blank)'} · row ${r._row}`

/** Returns a new session plus the audit record. Never touches the source array. */
export function editField(s: SandboxSession, row: number, field: EmployeeField, value: string, issueId?: string): { session: SandboxSession; change: SandboxChange | null } {
  const target = s.employees.find((r) => r._row === row)
  if (!target) throw new Error(`Row ${row} is not in the sandbox.`)
  if (target[field] === value) return { session: s, change: null }
  const change: SandboxChange = {
    change_id: uid('chg'), session_id: s.session_id, table_name: 'employees', row, record_key: recordKey(target),
    field_name: field, before_value: target[field], after_value: value, action: 'update', issue_id: issueId, timestamp: new Date().toISOString(),
  }
  return { session: { ...s, employees: s.employees.map((r) => (r._row === row ? { ...r, [field]: value } : r)) }, change }
}

export function setExcluded(s: SandboxSession, row: number, excluded: boolean, issueId?: string): { session: SandboxSession; change: SandboxChange } {
  const target = s.employees.find((r) => r._row === row)
  if (!target) throw new Error(`Row ${row} is not in the sandbox.`)
  const change: SandboxChange = {
    change_id: uid('chg'), session_id: s.session_id, table_name: 'employees', row, record_key: recordKey(target), field_name: '*',
    before_value: target._excluded ? 'excluded' : 'included', after_value: excluded ? 'excluded' : 'included',
    action: excluded ? 'exclude' : 'restore', issue_id: issueId, timestamp: new Date().toISOString(),
  }
  return { session: { ...s, employees: s.employees.map((r) => (r._row === row ? { ...r, _excluded: excluded } : r)) }, change }
}

/** Small stable fingerprint used in the UI to show the protected source never changed. */
export function fingerprint(rows: readonly unknown[]): string {
  const s = JSON.stringify(rows)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0')
}
