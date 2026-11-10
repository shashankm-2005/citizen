import type { Department, EmployeeRow } from './types'
import { EMPLOYEE_FIELDS } from './types'

/** The SQL Lab only knows these tables/columns. Anything else is rejected before execution. */
export const QUERY_TABLES = {
  employees: { alias: 'e', columns: [...EMPLOYEE_FIELDS] as string[] },
  departments: { alias: 'd', columns: ['department_id', 'department_name'] as string[] },
} as const
export type TableName = keyof typeof QUERY_TABLES

export interface ColumnRef { table: TableName; field: string }
export type FilterOp = '=' | '!=' | 'contains' | 'starts with' | '>' | '<' | 'is null' | 'is not null'
export const FILTER_OPS: FilterOp[] = ['=', '!=', 'contains', 'starts with', '>', '<', 'is null', 'is not null']
export interface Filter extends ColumnRef { id: string; op: FilterOp; value: string }
export interface Sort extends ColumnRef { dir: 'ASC' | 'DESC' }
export interface QueryDef {
  join: null | { type: 'INNER' | 'LEFT' } // employees.department_id = departments.department_id
  columns: ColumnRef[]
  filters: Filter[]
  orderBy: Sort[]
  limit: number
}

export interface QueryResult {
  sql: string
  params: string[]
  headers: string[]
  rows: string[][]
  explanation: string[]
}

export class QueryError extends Error {}

const q = (c: ColumnRef) => `${QUERY_TABLES[c.table].alias}.${c.field}`
const NO_VALUE: FilterOp[] = ['is null', 'is not null']

export function validate(def: QueryDef) {
  const refs = [...def.columns, ...def.filters, ...def.orderBy]
  for (const c of refs) {
    const t = QUERY_TABLES[c.table]
    if (!t) throw new QueryError(`Unknown table "${c.table}". Available: employees, departments.`)
    if (!t.columns.includes(c.field)) throw new QueryError(`Unknown column "${c.field}" in table ${c.table}.`)
  }
  for (const f of def.filters) if (!FILTER_OPS.includes(f.op)) throw new QueryError(`Unsupported operator "${f.op}".`)
  if (!def.join && refs.some((c) => c.table === 'departments'))
    throw new QueryError('This query uses a departments column but the tables are not joined. Add the join on department_id first.')
  if (def.columns.length === 0) throw new QueryError('Drag at least one field into the output columns.')
  if (!Number.isInteger(def.limit) || def.limit < 1 || def.limit > 1000) throw new QueryError('Limit must be between 1 and 1000.')
}

/** Parameterised, read-only SQL text that mirrors the visual definition. Values never get concatenated in. */
export function toSql(def: QueryDef): { sql: string; params: string[] } {
  const params: string[] = []
  const lines = [`SELECT ${def.columns.map(q).join(', ')}`, 'FROM employees e']
  if (def.join) lines.push(`${def.join.type} JOIN departments d ON e.department_id = d.department_id`)
  if (def.filters.length) {
    const parts = def.filters.map((f) => {
      if (f.op === 'is null') return `(${q(f)} IS NULL OR TRIM(${q(f)}) = '')`
      if (f.op === 'is not null') return `(${q(f)} IS NOT NULL AND TRIM(${q(f)}) <> '')`
      if (f.op === 'contains') { params.push(`%${f.value}%`); return `${q(f)} LIKE ?` }
      if (f.op === 'starts with') { params.push(`${f.value}%`); return `${q(f)} LIKE ?` }
      params.push(f.value)
      return `${q(f)} ${f.op === '!=' ? '<>' : f.op} ?`
    })
    lines.push(`WHERE ${parts.join('\n  AND ')}`)
  }
  if (def.orderBy.length) lines.push(`ORDER BY ${def.orderBy.map((s) => `${q(s)} ${s.dir}`).join(', ')}`)
  lines.push(`LIMIT ${def.limit};`)
  return { sql: lines.join('\n'), params }
}

type Joined = { e: EmployeeRow; d: Department | null }
const get = (r: Joined, c: ColumnRef): string | null =>
  c.table === 'employees' ? r.e[c.field as keyof EmployeeRow] as string : r.d ? r.d[c.field as keyof Department] : null

function matches(v: string | null, f: Filter) {
  const blank = v == null || v.trim() === ''
  if (f.op === 'is null') return blank
  if (f.op === 'is not null') return !blank
  if (v == null) return false // SQL: comparisons with NULL are not true
  const a = v.toLowerCase(), b = f.value.toLowerCase()
  switch (f.op) {
    case '=': return a === b
    case '!=': return a !== b
    case 'contains': return a.includes(b)
    case 'starts with': return a.startsWith(b)
    case '>': return a > b
    case '<': return a < b
  }
}

/** Executes the structured definition in memory against read-only inputs. */
export function runQuery(def: QueryDef, employees: readonly EmployeeRow[], departments: readonly Department[]): QueryResult {
  validate(def)
  const { sql, params } = toSql(def)
  const byId = new Map(departments.map((d) => [d.department_id, d]))
  let rows: Joined[] = employees.filter((e) => !e._excluded).map((e) => ({ e, d: byId.get(e.department_id) ?? null }))
  if (def.join?.type === 'INNER') rows = rows.filter((r) => r.d)
  rows = rows.filter((r) => def.filters.every((f) => matches(get(r, f), f)))
  if (def.orderBy.length) {
    rows = [...rows].sort((x, y) => {
      for (const s of def.orderBy) {
        const a = get(x, s) ?? '', b = get(y, s) ?? ''
        const c = a.localeCompare(b, undefined, { numeric: true })
        if (c) return s.dir === 'ASC' ? c : -c
      }
      return 0
    })
  }
  const total = rows.length
  rows = rows.slice(0, def.limit)
  return { sql, params, headers: def.columns.map(q), rows: rows.map((r) => def.columns.map((c) => get(r, c) ?? 'NULL')), explanation: explain(def, total) }
}

function explain(def: QueryDef, total: number): string[] {
  const out = [`SELECT picks ${def.columns.length} column(s) to show: ${def.columns.map(q).join(', ')}.`, 'FROM employees e reads the employees table (nicknamed “e”).']
  if (def.join?.type === 'INNER') out.push('INNER JOIN keeps only employees whose department_id matches a row in departments, and adds that department’s columns.')
  if (def.join?.type === 'LEFT') out.push('LEFT JOIN keeps every employee; when no department matches, the department columns are NULL — a quick way to spot broken references.')
  for (const f of def.filters) out.push(`WHERE keeps rows where ${q(f)} ${f.op}${NO_VALUE.includes(f.op) ? '' : ` “${f.value}”`} (text comparisons ignore case here).`)
  for (const s of def.orderBy) out.push(`ORDER BY sorts by ${q(s)} ${s.dir === 'ASC' ? 'ascending (A→Z, low→high)' : 'descending (Z→A, high→low)'}.`)
  out.push(total === 0 ? 'No rows matched. Try removing a filter.' : `${total} row(s) matched${total > def.limit ? `; LIMIT shows the first ${def.limit}` : ''}.`)
  return out
}
