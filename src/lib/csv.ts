import Papa from 'papaparse'
import type { EmployeeField, EmployeeRow } from './types'
import { EMPLOYEE_FIELDS } from './types'

export const MAX_FILE_BYTES = 1024 * 1024
export const MAX_ROWS = 5000
export const REQUIRED_HEADERS: EmployeeField[] = ['employee_id', 'first_name', 'last_name', 'email', 'department_id']

export interface ParsedCsv {
  headers: string[]
  data: string[][]
  rowErrors: { row: number; message: string }[]
}

/** File-level validation that does not need the content. Returns an error message or null. */
export function checkFile(name: string, size: number, type: string): string | null {
  if (!/\.csv$/i.test(name)) return `“${name}” is not a .csv file. Only CSV files are supported.`
  if (type && !['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'].includes(type)) return `Unsupported file type (${type}).`
  if (size === 0) return 'The file is empty.'
  if (size > MAX_FILE_BYTES) return `The file is ${(size / 1024).toFixed(0)} KB; the limit is ${MAX_FILE_BYTES / 1024} KB.`
  return null
}

export function parseCsv(text: string): ParsedCsv {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const [headers = [], ...data] = res.data
  const rowErrors = res.errors.map((e) => ({ row: (e.row ?? 0) + 1, message: e.message }))
  data.forEach((r, i) => {
    if (r.length !== headers.length) rowErrors.push({ row: i + 2, message: `Expected ${headers.length} columns, found ${r.length}.` })
  })
  return { headers: headers.map((h) => h.trim()), data, rowErrors }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Guess a header for each target field by normalised name. */
export function autoMap(headers: string[]): Record<EmployeeField, string> {
  return Object.fromEntries(
    EMPLOYEE_FIELDS.map((f) => [f, headers.find((h) => norm(h) === norm(f)) ?? headers.find((h) => norm(f).includes(norm(h)) && norm(h).length > 3) ?? '']),
  ) as Record<EmployeeField, string>
}

/** Structural validation. Any error blocks the whole import: no partial, silent imports. */
export function validateImport(p: ParsedCsv, mapping: Record<EmployeeField, string>): string[] {
  const errs: string[] = []
  if (p.headers.length === 0 || p.headers.every((h) => !h)) errs.push('No header row found.')
  const dupHeaders = p.headers.filter((h, i) => h && p.headers.indexOf(h) !== i)
  if (dupHeaders.length) errs.push(`Duplicate column headers: ${[...new Set(dupHeaders)].join(', ')}.`)
  for (const f of REQUIRED_HEADERS) if (!mapping[f]) errs.push(`Required field “${f}” is not mapped to a column.`)
  const used = Object.values(mapping).filter(Boolean)
  if (new Set(used).size !== used.length) errs.push('Two fields are mapped to the same column.')
  if (p.data.length === 0) errs.push('The file has a header but no data rows.')
  if (p.data.length > MAX_ROWS) errs.push(`The file has ${p.data.length} rows; the limit is ${MAX_ROWS}.`)
  for (const e of p.rowErrors.slice(0, 20)) errs.push(`Row ${e.row}: ${e.message}`)
  if (p.rowErrors.length > 20) errs.push(`…and ${p.rowErrors.length - 20} more row errors.`)
  return errs
}

/** Values are kept exactly as provided (raw/staging); quality rules flag problems later. */
export function toRows(p: ParsedCsv, mapping: Record<EmployeeField, string>): EmployeeRow[] {
  const idx = Object.fromEntries(EMPLOYEE_FIELDS.map((f) => [f, mapping[f] ? p.headers.indexOf(mapping[f]) : -1]))
  return p.data.map((r, i) => ({
    _row: i + 1,
    ...(Object.fromEntries(EMPLOYEE_FIELDS.map((f) => [f, idx[f] >= 0 ? r[idx[f]] ?? '' : ''])) as Record<EmployeeField, string>),
  }))
}
