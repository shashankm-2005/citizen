import type { Department, EmployeeRow } from '../lib/types'
import { EMPLOYEE_FIELDS } from '../lib/types'

/** Synthetic records only. No real people. See /sample-data/SEEDED_ISSUES.md for the expected detections. */
export const SAMPLE_DEPARTMENTS: Department[] = [
  { department_id: 'D01', department_name: 'Human Resources' },
  { department_id: 'D02', department_name: 'Finance' },
  { department_id: 'D03', department_name: 'Research' },
  { department_id: 'D04', department_name: 'Manufacturing' },
  { department_id: 'D05', department_name: 'Information Technology' },
]

// employee_id, first_name, last_name, email, department_id, job_title, hire_date
const RAW: string[][] = [
  ['E1001', 'Avery', 'Stone', 'avery.stone@example.com', 'D01', 'HR Specialist', '1998-02-02'],
  ['E1002', 'Blake', 'Rivers', 'blake.rivers@example.com', 'D02', 'Accountant', '1995-06-12'],
  ['E1003', 'Casey', 'Moreno', 'casey.moreno@example.com', 'D03', 'Research Scientist', '1993-09-01'],
  ['E1004', 'Devon', 'Park', 'devon.park@example.com', 'D04', 'Line Supervisor', '1990-01-15'],
  ['E1005', 'Emery', 'Quinn', 'emery.quinn@example.com', 'D05', 'Systems Analyst', '1996-03-20'],
  ['E1005', 'Finley', 'Hart', 'finley.hart@example.com', 'D02', 'Payroll Clerk', '1997-07-07'], // duplicate ID, different person
  ['E1006', 'Gray', 'Lennox', 'gray.lennox@example.com', 'D03', 'Lab Technician', '1994-11-30'],
  ['E1007', 'Harper', 'Ellis', '', 'D01', 'Recruiter', '1997-04-18'], // missing email
  ['E1008', 'Indigo', '   ', 'indigo.v@example.com', 'D04', 'Machinist', '1992-08-08'], // whitespace-only last name
  ['E1009', 'Jordan', 'Blake', 'jordan.blake@example', 'D02', 'Financial Analyst', '1996-12-01'], // invalid email
  ['E1010', 'Kai', 'Morgan', 'kai.morgan.example.com', 'D05', 'Help Desk Technician', '1998-05-05'], // invalid email
  ['E1011', ' Logan', 'Reyes', 'logan.reyes@example.com', 'D03', 'Chemist', '1991-10-10'], // leading whitespace
  ['E1012', 'Morgan', 'Avery', 'morgan.avery@example.com', 'D01', 'Benefits Coordinator', '1995-02-14'],
  ['E1012', 'Morgan', 'Avery', 'morgan.avery@example.com', 'D01', 'Benefits Coordinator', '1995-02-14'], // exact duplicate row
  ['E1013', 'nOAH', 'Sterling', 'noah.sterling@example.com', 'D04', 'Quality Inspector', '1993-03-03'], // inconsistent casing
  ['E1014', 'Oakley', 'Grant', 'Oakley.Grant@Example.COM', 'D05', 'Network Engineer', '1997-09-09'], // email casing
  ['E1015', 'Parker', 'Wells', 'parker.wells@example.com', 'd02', 'Auditor', '1994-04-04'], // department casing
  ['E1016', 'Quinn', 'Hayes', 'quinn.hayes@example.com', 'D99', 'Analyst', '1996-06-06'], // unmatched FK
  ['E1017', 'Reese', 'Lambert', 'reese.lambert@example.com', '', 'Coordinator', '1998-01-20'], // missing department
  ['E1018', 'Sage', 'Whitfield', 'sage.whitfield@example.com', 'D03', 'Research Associate', '03/15/1997'], // date format
  ['E1019', 'Tatum', 'Cole', 'tatum.cole@example.com', 'D04', 'Plant Engineer', '1992-12-12'],
  ['', 'Unity', 'Fox', 'unity.fox@example.com', 'D01', 'HR Assistant', '1998-07-01'], // missing employee_id
  ['E1020', 'Val', 'Bishop', 'val.bishop@example.com ', 'D02', 'Controller', '1990-05-25'], // trailing whitespace
  ['E1021', 'Wren', 'Doyle', 'wren.doyle@example.com', 'D05', 'Database Administrator', '1995-08-18'],
]

export const SAMPLE_EMPLOYEES: EmployeeRow[] = RAW.map((r, i) => ({
  _row: i + 1,
  ...(Object.fromEntries(EMPLOYEE_FIELDS.map((f, j) => [f, r[j]])) as Record<(typeof EMPLOYEE_FIELDS)[number], string>),
}))

export function toCsv(rows: EmployeeRow[]): string {
  const esc = (v: string) => (/[",\n\r]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [EMPLOYEE_FIELDS.join(','), ...rows.map((r) => EMPLOYEE_FIELDS.map((f) => esc(r[f])).join(','))].join('\n')
}
