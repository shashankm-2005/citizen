import type { Department, EmployeeField, EmployeeRow, Issue, IssueType } from './types'
import { EMPLOYEE_FIELDS } from './types'

export const REQUIRED_FIELDS: EmployeeField[] = ['employee_id', 'first_name', 'last_name', 'email', 'department_id']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const ISSUE_LABELS: Record<IssueType, string> = {
  duplicate_id: 'Duplicate employee ID',
  duplicate_row: 'Duplicate full row',
  missing_value: 'Missing required value',
  invalid_email: 'Invalid email format',
  inconsistent_format: 'Inconsistent formatting',
  unmatched_fk: 'Unmatched department (foreign key)',
}

const isBlank = (v: string | undefined) => v == null || v.trim() === ''
const titleCase = (v: string) => v.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
const rowKey = (r: EmployeeRow) => `${r.employee_id.trim() || '(blank)'} · row ${r._row}`

type Draft = Omit<Issue, 'issue_id' | 'batch_id' | 'table_name' | 'record_key' | 'status' | 'created_at' | 'updated_at'>

/**
 * Pure rule engine. Flags *possible* issues; a human reviews every correction.
 * Issue ids are deterministic (type:row:field) so review status survives re-running checks.
 */
export function detectIssues(rows: readonly EmployeeRow[], departments: readonly Department[], batchId: string, now = new Date().toISOString()): Issue[] {
  const drafts: Draft[] = []
  const active = rows.filter((r) => !r._excluded)

  // Duplicate IDs vs duplicate full rows
  const byId = new Map<string, EmployeeRow[]>()
  for (const r of active) {
    const id = r.employee_id.trim()
    if (!id) continue
    byId.set(id, [...(byId.get(id) ?? []), r])
  }
  const sig = (r: EmployeeRow) => EMPLOYEE_FIELDS.map((f) => r[f].trim()).join('\u0001')
  for (const [id, group] of byId) {
    if (group.length < 2) continue
    const seen = new Map<string, EmployeeRow>()
    const variants = new Set(group.map(sig))
    for (const r of group) {
      const first = seen.get(sig(r))
      if (first) {
        drafts.push({
          row: r._row, field_name: '*', issue_type: 'duplicate_row', current_value: id,
          rule: 'All configured fields match another row exactly.',
          explanation: `Row ${r._row} is an exact copy of row ${first._row} (every field matches).`,
          suggested_value: null, fix_action: 'exclude',
          recommended_fix: `Exclude this copy from the sandbox; row ${first._row} is kept.`,
        })
      } else seen.set(sig(r), r)
    }
    if (variants.size > 1) {
      const others = group.map((g) => g._row)
      for (const r of [...seen.values()]) {
        drafts.push({
          row: r._row, field_name: 'employee_id', issue_type: 'duplicate_id', current_value: id,
          rule: 'employee_id must be unique (primary key).',
          explanation: `employee_id ${id} is used by rows ${others.join(', ')} with different values, so it cannot identify one person.`,
          suggested_value: null, fix_action: 'none',
          recommended_fix: 'Confirm with the record owner which person keeps this ID, then assign a new ID to the other (edit in the sandbox).',
        })
      }
    }
  }

  const deptIds = new Set(departments.map((d) => d.department_id))
  for (const r of active) {
    for (const f of REQUIRED_FIELDS) {
      if (isBlank(r[f])) {
        drafts.push({
          row: r._row, field_name: f, issue_type: 'missing_value', current_value: r[f],
          rule: `${f} is required and must not be null, empty or whitespace-only.`,
          explanation: r[f] === '' ? `${f} is empty.` : `${f} contains only whitespace.`,
          suggested_value: null, fix_action: 'none',
          recommended_fix: `Look up the correct ${f} and enter it in the sandbox.`,
        })
      }
    }

    // Formatting: whitespace on any field (non-blank)
    for (const f of EMPLOYEE_FIELDS) {
      const v = r[f]
      if (!isBlank(v) && v !== v.trim()) {
        drafts.push({
          row: r._row, field_name: f, issue_type: 'inconsistent_format', current_value: v,
          rule: 'Values must not have leading or trailing whitespace.',
          explanation: `"${v}" has extra spaces, which breaks matching and joins.`,
          suggested_value: f === 'email' ? v.trim().toLowerCase() : v.trim(), fix_action: 'update',
          recommended_fix: 'Trim the surrounding spaces.',
        })
      }
    }
    for (const f of ['first_name', 'last_name'] as const) {
      const v = r[f].trim()
      if (v && v === v.trim() && titleCase(v) !== v && r[f] === v) {
        drafts.push({
          row: r._row, field_name: f, issue_type: 'inconsistent_format', current_value: r[f],
          rule: 'Names use consistent Title Case.',
          explanation: `"${v}" has inconsistent capitalisation.`,
          suggested_value: titleCase(v), fix_action: 'update', recommended_fix: `Change to "${titleCase(v)}".`,
        })
      }
    }
    const email = r.email
    if (!isBlank(email) && email === email.trim()) {
      if (!EMAIL_RE.test(email)) {
        drafts.push({
          row: r._row, field_name: 'email', issue_type: 'invalid_email', current_value: email,
          rule: 'Email must look like name@domain.tld.',
          explanation: `"${email}" fails the basic format check. (A format check cannot prove an address exists.)`,
          suggested_value: null, fix_action: 'none', recommended_fix: 'Confirm the correct address and edit it in the sandbox.',
        })
      } else if (email !== email.toLowerCase()) {
        drafts.push({
          row: r._row, field_name: 'email', issue_type: 'inconsistent_format', current_value: email,
          rule: 'Email addresses are stored in lowercase.',
          explanation: `"${email}" mixes upper and lower case.`,
          suggested_value: email.toLowerCase(), fix_action: 'update', recommended_fix: 'Convert to lowercase.',
        })
      }
    }
    const dept = r.department_id
    if (!isBlank(dept) && dept === dept.trim() && !deptIds.has(dept)) {
      const upper = dept.toUpperCase()
      if (deptIds.has(upper)) {
        drafts.push({
          row: r._row, field_name: 'department_id', issue_type: 'inconsistent_format', current_value: dept,
          rule: 'Department codes use the exact form in the departments table (e.g. D02).',
          explanation: `"${dept}" differs only by case from "${upper}", so a join will miss it.`,
          suggested_value: upper, fix_action: 'update', recommended_fix: `Change to "${upper}".`,
        })
      } else {
        drafts.push({
          row: r._row, field_name: 'department_id', issue_type: 'unmatched_fk', current_value: dept,
          rule: 'employees.department_id must reference an existing departments.department_id.',
          explanation: `Department "${dept}" does not exist in the departments table.`,
          suggested_value: null, fix_action: 'none', recommended_fix: 'Find the employee’s real department and enter its code in the sandbox.',
        })
      }
    }
    const hd = r.hire_date
    if (!isBlank(hd) && hd === hd.trim() && !ISO_DATE_RE.test(hd)) {
      const m = hd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      const iso = m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
      drafts.push({
        row: r._row, field_name: 'hire_date', issue_type: 'inconsistent_format', current_value: hd,
        rule: 'Dates use the ISO format YYYY-MM-DD.',
        explanation: `"${hd}" uses a different date format${iso ? ' (read as MM/DD/YYYY)' : ''}.`,
        suggested_value: iso, fix_action: iso ? 'update' : 'none',
        recommended_fix: iso ? `Change to ${iso}.` : 'Re-enter the date as YYYY-MM-DD.',
      })
    }
  }

  const byRow = new Map(rows.map((r) => [r._row, r]))
  return drafts.map((d) => ({
    ...d,
    issue_id: `${d.issue_type}:${d.row}:${d.field_name}`,
    batch_id: batchId,
    table_name: 'employees',
    record_key: rowKey(byRow.get(d.row)!),
    status: 'open',
    created_at: now,
    updated_at: now,
  }))
}

/** Re-detect while keeping review decisions for issues that still exist. */
export function mergeIssues(previous: Issue[], fresh: Issue[]): Issue[] {
  const old = new Map(previous.map((i) => [i.issue_id, i]))
  return fresh.map((i) => {
    const p = old.get(i.issue_id)
    return p && p.batch_id === i.batch_id ? { ...i, status: p.status, reason: p.reason, created_at: p.created_at, updated_at: p.updated_at } : i
  })
}
