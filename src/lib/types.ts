export const EMPLOYEE_FIELDS = [
  'employee_id',
  'first_name',
  'last_name',
  'email',
  'department_id',
  'job_title',
  'hire_date',
] as const
export type EmployeeField = (typeof EMPLOYEE_FIELDS)[number]

/** A raw/staging employee row. `_row` is the 1-based source row number: the stable identity, since employee_id may repeat in raw data. */
export type EmployeeRow = { _row: number; _excluded?: boolean } & Record<EmployeeField, string>

export interface Department {
  department_id: string
  department_name: string
}

export interface ImportBatch {
  batch_id: string
  file_name: string
  imported_at: string
  row_count: number
  validation_summary: string
}

export type IssueType =
  | 'duplicate_id'
  | 'duplicate_row'
  | 'missing_value'
  | 'invalid_email'
  | 'inconsistent_format'
  | 'unmatched_fk'

export type IssueStatus = 'open' | 'approved' | 'rejected'

export interface Issue {
  issue_id: string
  batch_id: string
  table_name: 'employees'
  row: number
  record_key: string
  field_name: EmployeeField | '*'
  issue_type: IssueType
  rule: string
  explanation: string
  current_value: string
  /** A concrete corrected value, or null when a human must decide. */
  suggested_value: string | null
  /** What approving does in the sandbox. */
  fix_action: 'update' | 'exclude' | 'none'
  recommended_fix: string
  status: IssueStatus
  reason?: string
  created_at: string
  updated_at: string
}

export interface SandboxSession {
  session_id: string
  baseline_batch_id: string
  created_at: string
  status: 'active'
  reset_count: number
  last_reset_at?: string
  employees: EmployeeRow[]
}

export interface SandboxChange {
  change_id: string
  session_id: string
  table_name: 'employees'
  row: number
  record_key: string
  field_name: string
  before_value: string
  after_value: string
  action: 'update' | 'exclude' | 'restore'
  issue_id?: string
  timestamp: string
}
