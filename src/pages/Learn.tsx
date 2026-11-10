import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { useApp } from '../store'

interface Concept { id: string; term: string; plain: string; example: string; q: string; options: string[]; answer: number; try?: [string, string] }

const CONCEPTS: Concept[] = [
  { id: 'table', term: 'Table', plain: 'A grid that stores one kind of thing. Each row is one item; each column is one piece of information about it.', example: 'employees holds one row per employee; departments holds one row per department.', q: 'Which table should store “Finance”?', options: ['employees', 'departments'], answer: 1 },
  { id: 'field', term: 'Field (column)', plain: 'One named piece of information that every row in a table has, with a data type such as TEXT or DATE.', example: 'email and hire_date are fields of employees. hire_date has type DATE.', q: 'Which of these is a field of employees?', options: ['Finance', 'job_title', 'E1001'], answer: 1 },
  { id: 'pk', term: 'Primary key', plain: 'The field whose value uniquely identifies each row. It can never be blank and never repeat.', example: 'employee_id is the primary key of employees. The sample has E1005 twice — the Data Quality Lab flags it.', q: 'Why is a repeated employee_id a problem?', options: ['It makes the table longer', 'It no longer identifies exactly one person', 'Emails stop working'], answer: 1, try: ['/quality', 'See the duplicate-ID flag'] },
  { id: 'schema', term: 'Schema', plain: 'The design of the database: which tables exist, their fields, types, keys and how they relate.', example: 'employees(employee_id PK, first_name, …, department_id FK) and departments(department_id PK, department_name).', q: 'A schema describes…', options: ['the structure of the data', 'one employee’s details'], answer: 0, try: ['/designer', 'Design a schema'] },
  { id: 'fk', term: 'Foreign key', plain: 'A field that points to the primary key of another table, linking the two.', example: 'employees.department_id points to departments.department_id. Code D99 points to nothing — an “unmatched” reference.', q: 'employees.department_id = "D99" but there is no D99 department. This is…', options: ['a valid row', 'a broken foreign-key reference'], answer: 1 },
  { id: 'rel', term: 'Relationship', plain: 'How rows in two tables connect. “Many-to-one” (N : 1) means many rows on one side can point to one row on the other.', example: 'Many employees belong to one department: employees N : 1 departments.', q: 'Employees to departments is usually…', options: ['N : 1 (many employees, one department)', '1 : 1'], answer: 0 },
  { id: 'er', term: 'ER diagram', plain: 'A picture of the schema: boxes for tables (entities), lines for relationships.', example: 'In the Database Designer the canvas is a live ER diagram — drag tables and connect keys.', q: 'In an ER diagram, a line between two tables shows…', options: ['a relationship', 'a sort order'], answer: 0, try: ['/designer', 'Open the ER canvas'] },
  { id: 'join', term: 'Join', plain: 'Combining rows from two tables where a key matches. INNER JOIN keeps only matches; LEFT JOIN keeps every row from the first table.', example: 'Joining employees to departments on department_id shows each employee with their department_name.', q: 'Which join still shows the D99 employee (with NULL department name)?', options: ['INNER JOIN', 'LEFT JOIN'], answer: 1, try: ['/query', 'Build a join'] },
  { id: 'select', term: 'SQL SELECT', plain: 'The SQL command that reads data. You list the columns you want and the table to read FROM.', example: 'SELECT e.first_name, e.email FROM employees e;', q: 'SELECT chooses…', options: ['which columns to show', 'which rows to delete'], answer: 0 },
  { id: 'where', term: 'SQL WHERE', plain: 'A filter: only rows that meet the condition are kept.', example: "SELECT * FROM employees e WHERE e.department_id = 'D02';  -- Finance only", q: 'WHERE e.department_id = ? keeps…', options: ['every row', 'only rows with that department'], answer: 1 },
  { id: 'null', term: 'NULL', plain: 'A missing value — “unknown”, not zero and not the same as a space. Blank and whitespace-only values cause the same practical problems.', example: 'Row 8 (E1007) has an empty email. The query “Find missing emails” uses IS NULL to find it.', q: 'Is an email made only of spaces a usable value?', options: ['Yes', 'No — treat it as missing'], answer: 1 },
]

function Checkpoint({ c }: { c: Concept }) {
  const done = useApp((s) => !!s.activities[`learn:${c.id}`])
  const complete = useApp((s) => s.completeActivity)
  const [pick, setPick] = useState<number | null>(null)
  return (
    <fieldset className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
      <legend className="sr-only">Checkpoint</legend>
      <p className="font-medium">✏️ Checkpoint: {c.q}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.options.map((o, i) => (
          <button key={o} onClick={() => { setPick(i); if (i === c.answer) complete(`learn:${c.id}`) }} aria-pressed={pick === i}
            className={`rounded-md border px-3 py-1 ${pick === i ? (i === c.answer ? 'border-emerald-500 bg-emerald-100' : 'border-red-400 bg-red-50') : 'border-slate-300 bg-white hover:bg-slate-100'}`}>{o}</button>
        ))}
      </div>
      <p role="status" className="mt-2 text-xs">{pick === null ? (done ? '✅ Completed earlier.' : '') : pick === c.answer ? '✅ Correct!' : '❌ Not quite — read the example and try again.'}</p>
    </fieldset>
  )
}

export default function Learn() {
  const activities = useApp((s) => s.activities)
  const done = CONCEPTS.filter((c) => activities[`learn:${c.id}`]).length
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Learning Centre — Database Concepts" slide="PPT Slide 3 · Learning Microsoft Access" />
      <Card>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="font-semibold">Why Access?</h2>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              <li>Accessible entry point for non-programmers.</li>
              <li>Rapid creation of tables, forms, and queries.</li>
              <li>Enabled hands-on learning without deep developer resources.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Key database concepts learned</h2>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              <li><b>Primary keys</b> — unique record identifiers</li>
              <li><b>Schemas</b> — structuring tables and fields</li>
              <li><b>Table joins</b> — combining related data</li>
              <li><b>ER diagrams</b> — visualizing relationships</li>
              <li><b>Basic SQL</b> — querying and filtering records</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">Emphasis: self-directed learning → technical empowerment.</p>
      </Card>
      <div>
        <div className="mb-1 flex justify-between text-sm"><span>Checkpoints completed</span><span className="tabular-nums">{done} / {CONCEPTS.length}</span></div>
        <div className="h-2 rounded bg-slate-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={CONCEPTS.length}><div className="h-2 rounded bg-emerald-500" style={{ width: `${(done / CONCEPTS.length) * 100}%` }} /></div>
      </div>
      {CONCEPTS.map((c) => (
        <Card key={c.id}>
          <h2 className="text-lg font-semibold">{activities[`learn:${c.id}`] && '✅ '}{c.term}</h2>
          <p className="mt-1 text-slate-700">{c.plain}</p>
          <p className="mt-2 rounded-md border-l-4 border-blue-400 bg-blue-50 px-3 py-2 font-mono text-xs text-slate-800">{c.example}</p>
          {c.try && <Link to={c.try[0]} className="mt-2 inline-block text-sm text-blue-600 underline">{c.try[1]} →</Link>}
          <Checkpoint c={c} />
        </Card>
      ))}
    </div>
  )
}
