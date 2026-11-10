import { uid } from './sandbox'

export const DATA_TYPES = ['TEXT', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN'] as const
export type DataType = (typeof DATA_TYPES)[number]

export interface FieldDef { id: string; name: string; type: DataType; pk: boolean; required: boolean; unique: boolean }
export interface TableDef { id: string; name: string; x: number; y: number; fields: FieldDef[] }
export interface Relationship { id: string; fromTable: string; fromField: string; toTable: string; toField: string }
export interface Schema { tables: TableDef[]; relationships: Relationship[] }

type Spec = [name: string, type: DataType, pk?: boolean, required?: boolean, unique?: boolean]
const f = ([name, type, pk = false, required = pk, unique = pk]: Spec): FieldDef => ({ id: uid('fld'), name, type, pk, required, unique })

export const TEMPLATES: Record<string, Spec[]> = {
  employees: [['employee_id', 'TEXT', true], ['first_name', 'TEXT', false, true], ['last_name', 'TEXT', false, true], ['email', 'TEXT', false, true, true], ['department_id', 'TEXT', false, true], ['job_title', 'TEXT'], ['hire_date', 'DATE']],
  departments: [['department_id', 'TEXT', true], ['department_name', 'TEXT', false, true, true]],
  data_quality_issues: [['issue_id', 'TEXT', true], ['batch_id', 'TEXT', false, true], ['table_name', 'TEXT', false, true], ['record_key', 'TEXT', false, true], ['field_name', 'TEXT'], ['issue_type', 'TEXT', false, true], ['explanation', 'TEXT'], ['suggested_correction', 'TEXT'], ['status', 'TEXT', false, true], ['created_at', 'DATE'], ['updated_at', 'DATE']],
  import_batches: [['batch_id', 'TEXT', true], ['file_name', 'TEXT', false, true], ['imported_at', 'DATE', false, true], ['row_count', 'INTEGER'], ['validation_summary', 'TEXT']],
  sandbox_sessions: [['session_id', 'TEXT', true], ['batch_id', 'TEXT', false, true], ['created_at', 'DATE'], ['status', 'TEXT'], ['reset_count', 'INTEGER']],
  sandbox_changes: [['change_id', 'TEXT', true], ['session_id', 'TEXT', false, true], ['table_name', 'TEXT'], ['record_key', 'TEXT'], ['field_name', 'TEXT'], ['before_value', 'TEXT'], ['after_value', 'TEXT'], ['action', 'TEXT'], ['changed_at', 'DATE']],
  learning_progress: [['activity_id', 'TEXT', true], ['module_id', 'TEXT', false, true], ['completed', 'BOOLEAN'], ['completed_at', 'DATE']],
  blank_table: [['id', 'INTEGER', true]],
}

export function newTable(template: string, existing: TableDef[], x: number, y: number): TableDef {
  let name = template === 'blank_table' ? 'new_table' : template
  for (let n = 2; existing.some((t) => t.name === name); n++) name = `${template === 'blank_table' ? 'new_table' : template}_${n}`
  return { id: uid('tbl'), name, x, y, fields: (TEMPLATES[template] ?? TEMPLATES.blank_table).map(f) }
}

export const NAME_RE = /^[a-z_][a-z0-9_]*$/

/** Returns an error message, or null when the name is acceptable. */
export function checkName(name: string, siblings: string[]): string | null {
  if (!name.trim()) return 'Name cannot be empty.'
  if (!NAME_RE.test(name)) return 'Use lowercase letters, numbers and underscores, starting with a letter (e.g. hire_date).'
  if (siblings.includes(name)) return `“${name}” already exists here.`
  return null
}

/**
 * A relationship links a foreign key to a primary key. Either end may be dragged first;
 * the result is normalised so `to*` is always the primary-key side ("one" side).
 */
export function checkRelationship(s: Schema, a: { table: string; field: string }, b: { table: string; field: string }): { error: string } | { rel: Relationship } {
  const ta = s.tables.find((t) => t.id === a.table), tb = s.tables.find((t) => t.id === b.table)
  const fa = ta?.fields.find((x) => x.id === a.field), fb = tb?.fields.find((x) => x.id === b.field)
  if (!ta || !tb || !fa || !fb) return { error: 'Both ends must be fields on the canvas.' }
  if (ta.id === tb.id) return { error: 'Connect fields from two different tables.' }
  if (fa.type !== fb.type) return { error: `Incompatible types: ${ta.name}.${fa.name} is ${fa.type} but ${tb.name}.${fb.name} is ${fb.type}.` }
  if (!fa.pk && !fb.pk) return { error: 'One end must be a primary key (PK). A foreign key points at a primary key.' }
  const [fk, pk] = fb.pk && !fa.pk ? [a, b] : fa.pk && !fb.pk ? [b, a] : [a, b]
  if (s.relationships.some((r) => r.fromField === fk.field && r.toField === pk.field)) return { error: 'That relationship already exists.' }
  return { rel: { id: uid('rel'), fromTable: fk.table, fromField: fk.field, toTable: pk.table, toField: pk.field } }
}

export function describeRel(s: Schema, r: Relationship) {
  const t = (id: string) => s.tables.find((x) => x.id === id)
  const fa = t(r.fromTable)?.fields.find((x) => x.id === r.fromField), fb = t(r.toTable)?.fields.find((x) => x.id === r.toField)
  const fkUnique = !!fa?.unique || !!fa?.pk
  return { from: `${t(r.fromTable)?.name}.${fa?.name}`, to: `${t(r.toTable)?.name}.${fb?.name}`, cardinality: fkUnique ? '1 : 1' : 'N : 1' }
}

/** CREATE TABLE text so learners can see the schema as SQL. */
export function toDdl(s: Schema): string {
  return s.tables.map((t) => {
    const cols = t.fields.map((x) => `  ${x.name} ${x.type}${x.required && !x.pk ? ' NOT NULL' : ''}${x.unique && !x.pk ? ' UNIQUE' : ''}`)
    const pks = t.fields.filter((x) => x.pk).map((x) => x.name)
    if (pks.length) cols.push(`  PRIMARY KEY (${pks.join(', ')})`)
    for (const r of s.relationships.filter((r) => r.fromTable === t.id)) {
      const d = describeRel(s, r)
      cols.push(`  FOREIGN KEY (${d.from.split('.')[1]}) REFERENCES ${d.to.split('.')[0]}(${d.to.split('.')[1]})`)
    }
    return `CREATE TABLE ${t.name} (\n${cols.join(',\n')}\n);`
  }).join('\n\n')
}
