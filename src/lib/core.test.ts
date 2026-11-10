import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SAMPLE_DEPARTMENTS, SAMPLE_EMPLOYEES, toCsv } from '../data/sample'
import { autoMap, checkFile, parseCsv, toRows, validateImport } from './csv'
import { detectIssues, mergeIssues } from './quality'
import { QueryError, runQuery, toSql, type QueryDef } from './query'
import { createSandbox, deepFreeze, editField, fingerprint, resetSandbox, setExcluded } from './sandbox'
import { checkName, checkRelationship, newTable, type Schema } from './schema'
import type { EmployeeRow } from './types'

const issues = detectIssues(SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS, 'b1')
const find = (type: string, row?: number, field?: string) =>
  issues.filter((i) => i.issue_type === type && (row == null || i.row === row) && (field == null || i.field_name === field))

describe('data-quality rules on the seeded sample', () => {
  it('flags both rows of a duplicate employee ID with different values', () => {
    const d = find('duplicate_id')
    expect(d.map((i) => i.row).sort()).toEqual([5, 6])
    expect(d[0].explanation).toMatch(/rows 5, 6/)
  })
  it('distinguishes an exact duplicate row from a repeated ID', () => {
    expect(find('duplicate_row').map((i) => i.row)).toEqual([14])
    expect(find('duplicate_id', 13)).toHaveLength(0)
  })
  it('flags missing, empty and whitespace-only required values', () => {
    expect(find('missing_value', 8, 'email')).toHaveLength(1)
    expect(find('missing_value', 9, 'last_name')[0].explanation).toMatch(/whitespace/)
    expect(find('missing_value', 19, 'department_id')).toHaveLength(1)
    expect(find('missing_value', 22, 'employee_id')).toHaveLength(1)
  })
  it('flags invalid emails without claiming the address exists', () => {
    expect(find('invalid_email').map((i) => i.row).sort((a, b) => a - b)).toEqual([10, 11])
    expect(find('invalid_email')[0].explanation).toMatch(/cannot prove/)
  })
  it('flags formatting problems and suggests corrections', () => {
    expect(find('inconsistent_format', 12, 'first_name')[0].suggested_value).toBe('Logan')
    expect(find('inconsistent_format', 15, 'first_name')[0].suggested_value).toBe('Noah')
    expect(find('inconsistent_format', 16, 'email')[0].suggested_value).toBe('oakley.grant@example.com')
    expect(find('inconsistent_format', 17, 'department_id')[0].suggested_value).toBe('D02')
    expect(find('inconsistent_format', 20, 'hire_date')[0].suggested_value).toBe('1997-03-15')
    expect(find('inconsistent_format', 23, 'email')[0].suggested_value).toBe('val.bishop@example.com')
  })
  it('flags unmatched department references', () => {
    expect(find('unmatched_fk').map((i) => i.row)).toEqual([18])
  })
  it('produces exactly the 16 flags documented in sample-data/SEEDED_ISSUES.md', () => {
    expect(issues).toHaveLength(16)
    expect(readFileSync('sample-data/employees_sample.csv', 'utf8')).toBe(toCsv(SAMPLE_EMPLOYEES) + '\n')
  })
  it('does not flag clean rows', () => {
    expect(issues.filter((i) => [1, 2, 3, 4, 7, 21, 24].includes(i.row))).toEqual([])
  })
  it('does not treat two people with the same name as duplicates', () => {
    const rows: EmployeeRow[] = [
      { ...SAMPLE_EMPLOYEES[0], _row: 1 },
      { ...SAMPLE_EMPLOYEES[0], _row: 2, employee_id: 'E9999', email: 'other@example.com' },
    ]
    expect(detectIssues(rows, SAMPLE_DEPARTMENTS, 'b')).toEqual([])
  })
  it('keeps review decisions when checks are re-run', () => {
    const reviewed = issues.map((i) => (i.row === 18 ? { ...i, status: 'rejected' as const, reason: 'known' } : i))
    const merged = mergeIssues(reviewed, detectIssues(SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS, 'b1'))
    expect(merged.find((i) => i.row === 18)?.status).toBe('rejected')
  })
})

describe('query builder', () => {
  const base: QueryDef = { join: { type: 'INNER' }, columns: [{ table: 'employees', field: 'employee_id' }, { table: 'departments', field: 'department_name' }], filters: [], orderBy: [], limit: 100 }
  it('joins employees to departments by department_id', () => {
    const r = runQuery(base, SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS)
    expect(r.rows[0]).toEqual(['E1001', 'Human Resources'])
    expect(r.rows.some((x) => x[0] === 'E1016')).toBe(false) // D99 has no match under INNER JOIN
    expect(r.sql).toContain('INNER JOIN departments d ON e.department_id = d.department_id')
  })
  it('LEFT JOIN shows NULL for unmatched departments', () => {
    const r = runQuery({ ...base, join: { type: 'LEFT' } }, SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS)
    expect(r.rows.find((x) => x[0] === 'E1016')).toEqual(['E1016', 'NULL'])
  })
  it('applies parameterised filters and ordering', () => {
    const def: QueryDef = { ...base, filters: [{ id: 'f', table: 'departments', field: 'department_name', op: '=', value: "Finance' OR 1=1 --" }], orderBy: [] }
    expect(toSql(def).sql).not.toContain('OR 1=1')
    expect(toSql(def).params).toEqual(["Finance' OR 1=1 --"])
    expect(runQuery(def, SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS).rows).toEqual([])
    const fin = runQuery({ ...def, filters: [{ ...def.filters[0], value: 'finance' }], orderBy: [{ table: 'employees', field: 'employee_id', dir: 'DESC' }] }, SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS)
    expect(fin.rows.map((x) => x[0])).toEqual(['E1020', 'E1009', 'E1005', 'E1002'])
    expect(fin.sql).toMatch(/WHERE d.department_name = \?\nORDER BY e.employee_id DESC/)
  })
  it('finds null/blank values', () => {
    const r = runQuery({ join: null, columns: [{ table: 'employees', field: 'employee_id' }], filters: [{ id: 'f', table: 'employees', field: 'email', op: 'is null', value: '' }], orderBy: [], limit: 10 }, SAMPLE_EMPLOYEES, SAMPLE_DEPARTMENTS)
    expect(r.rows).toEqual([['E1007']])
  })
  it('rejects unknown columns and department columns without a join', () => {
    expect(() => runQuery({ ...base, columns: [{ table: 'employees', field: 'salary' }] }, [], [])).toThrow(QueryError)
    expect(() => runQuery({ ...base, join: null }, [], [])).toThrow(/not joined/)
    expect(() => runQuery({ ...base, columns: [] }, [], [])).toThrow(/at least one/)
  })
})

describe('sandbox isolation', () => {
  it('sandbox edits, exclusions and resets never modify the protected source', () => {
    const source = deepFreeze(structuredClone(SAMPLE_EMPLOYEES))
    const before = fingerprint(source)
    let s = createSandbox(source, 'b1')
    const e1 = editField(s, 15, 'first_name', 'Noah')
    s = e1.session
    s = editField(s, 1, 'email', 'changed@example.com').session
    s = setExcluded(s, 14, true).session
    expect(e1.change).toMatchObject({ before_value: 'nOAH', after_value: 'Noah', row: 15 })
    expect(s.employees.find((r) => r._row === 15)?.first_name).toBe('Noah')
    expect(source[14].first_name).toBe('nOAH')
    expect(fingerprint(source)).toBe(before)
    s = resetSandbox(s, source)
    expect(fingerprint(s.employees)).toBe(before)
    expect(s.reset_count).toBe(1)
    // Mutating the sandbox copy directly also cannot reach the source
    s.employees[0].email = 'x'
    expect(source[0].email).toBe('avery.stone@example.com')
  })
})

describe('CSV import', () => {
  it('rejects unsupported and oversized files', () => {
    expect(checkFile('data.xlsx', 100, '')).toMatch(/not a .csv/)
    expect(checkFile('a.csv', 2 * 1024 * 1024, 'text/csv')).toMatch(/limit/)
    expect(checkFile('a.csv', 10, 'text/csv')).toBeNull()
  })
  it('round-trips the sample CSV, preserving raw values', () => {
    const p = parseCsv(toCsv(SAMPLE_EMPLOYEES))
    const m = autoMap(p.headers)
    expect(validateImport(p, m)).toEqual([])
    expect(toRows(p, m)).toEqual(SAMPLE_EMPLOYEES)
  })
  it('blocks malformed CSV with row-level errors', () => {
    const p = parseCsv('employee_id,first_name,last_name,email,department_id\nE1,A,B,a@b.co,D01\nE2,only,three')
    expect(validateImport(p, autoMap(p.headers)).join(' ')).toMatch(/Row 3: Expected 5 columns, found 3/)
  })
  it('requires required headers to be mapped', () => {
    const p = parseCsv('id,name\n1,x')
    expect(validateImport(p, autoMap(p.headers)).join(' ')).toMatch(/employee_id/)
  })
})

describe('schema designer rules', () => {
  const emp = newTable('employees', [], 0, 0), dep = newTable('departments', [emp], 300, 0)
  const s: Schema = { tables: [emp, dep], relationships: [] }
  const fld = (t: typeof emp, n: string) => ({ table: t.id, field: t.fields.find((x) => x.name === n)!.id })
  it('connects a foreign key to a primary key in either drag direction', () => {
    const r = checkRelationship(s, fld(dep, 'department_id'), fld(emp, 'department_id'))
    expect('rel' in r && r.rel.fromTable).toBe(emp.id)
  })
  it('rejects incompatible or keyless connections', () => {
    expect(checkRelationship(s, fld(emp, 'hire_date'), fld(dep, 'department_id'))).toMatchObject({ error: expect.stringMatching(/Incompatible/) })
    expect(checkRelationship(s, fld(emp, 'email'), fld(dep, 'department_name'))).toMatchObject({ error: expect.stringMatching(/primary key/) })
    expect(checkRelationship(s, fld(emp, 'email'), fld(emp, 'employee_id'))).toMatchObject({ error: expect.stringMatching(/different tables/) })
  })
  it('validates names', () => {
    expect(checkName('email', ['email'])).toMatch(/already exists/)
    expect(checkName('Hire Date', [])).toMatch(/lowercase/)
    expect(newTable('employees', [emp], 0, 0).name).toBe('employees_2')
  })
})
