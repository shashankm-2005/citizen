import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import {
  Background, ConnectionMode, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, applyNodeChanges,
  useReactFlow, type Connection, type Edge, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button, Card, PageHeader, confirmDialog, toast } from '../components/ui'
import { DATA_TYPES, TEMPLATES, checkName, checkRelationship, describeRel, newTable, toDdl, type DataType, type FieldDef, type Schema, type TableDef } from '../lib/schema'
import { uid } from '../lib/sandbox'
import { useApp } from '../store'

type TableNode = Node<{ table: TableDef; pkLinked: Set<string> }, 'table'>
const DND_TYPE = 'application/x-citizendb-table'

function TableCard({ data, selected }: NodeProps<TableNode>) {
  return (
    <div className={`min-w-52 rounded-lg border-2 bg-white text-xs shadow ${selected ? 'border-blue-500' : 'border-slate-300'}`}>
      <div className="rounded-t-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">▦ {data.table.name}</div>
      <ul>
        {data.table.fields.map((f) => (
          <li key={f.id} className="relative flex items-center gap-2 border-t border-slate-100 px-3 py-1">
            <Handle type="target" position={Position.Left} id={`${f.id}-t`} className="!h-2.5 !w-2.5 !bg-blue-500" />
            <span className="w-5 text-[10px] font-bold text-amber-600">{f.pk ? 'PK' : data.pkLinked.has(f.id) ? 'FK' : ''}</span>
            <span className={f.pk ? 'font-semibold' : ''}>{f.name}</span>
            <span className="ml-auto pl-3 text-slate-400">{f.type}{f.required && !f.pk ? ' *' : ''}{f.unique && !f.pk ? ' U' : ''}</span>
            <Handle type="source" position={Position.Right} id={`${f.id}-s`} className="!h-2.5 !w-2.5 !bg-emerald-500" />
          </li>
        ))}
      </ul>
    </div>
  )
}
const nodeTypes = { table: TableCard }

function useHistory(initial: Schema) {
  const [h, setH] = useState({ stack: [initial], i: 0 })
  const commit = useCallback((next: Schema) => setH((s) => {
    const stack = [...s.stack.slice(0, s.i + 1), next].slice(-50)
    return { stack, i: stack.length - 1 }
  }), [])
  return {
    schema: h.stack[h.i], commit,
    undo: () => setH((s) => ({ ...s, i: Math.max(0, s.i - 1) })),
    redo: () => setH((s) => ({ ...s, i: Math.min(s.stack.length - 1, s.i + 1) })),
    canUndo: h.i > 0, canRedo: h.i < h.stack.length - 1,
  }
}

function DesignerInner() {
  const saved = useApp((s) => s.schema)
  const savedAt = useApp((s) => s.schemaSavedAt)
  const saveSchema = useApp((s) => s.saveSchema)
  const { schema, commit, undo, redo, canUndo, canRedo } = useHistory(saved)
  const [nodes, setNodes] = useState<TableNode[]>([])
  const [selTable, setSelTable] = useState<string | null>(null)
  const [selEdge, setSelEdge] = useState<string | null>(null)
  const [showDdl, setShowDdl] = useState(false)
  const flow = useReactFlow()
  const dirty = JSON.stringify(schema) !== JSON.stringify(saved)

  const fkFields = useMemo(() => new Set(schema.relationships.map((r) => r.fromField)), [schema.relationships])
  useEffect(() => {
    setNodes((prev) => schema.tables.map((t) => {
      const old = prev.find((n) => n.id === t.id)
      return { ...old, id: t.id, type: 'table', position: { x: t.x, y: t.y }, data: { table: t, pkLinked: fkFields }, selected: t.id === selTable }
    }))
  }, [schema.tables, fkFields, selTable])

  const edges: Edge[] = schema.relationships.map((r) => ({
    id: r.id, source: r.fromTable, sourceHandle: `${r.fromField}-s`, target: r.toTable, targetHandle: `${r.toField}-t`,
    label: describeRel(schema, r).cardinality, selected: r.id === selEdge, type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: r.id === selEdge ? 3 : 1.5, stroke: r.id === selEdge ? '#2563eb' : '#64748b' },
    labelStyle: { fontWeight: 700 }, labelBgStyle: { fill: '#fef3c7' },
  }))

  const update = (fn: (s: Schema) => Schema) => commit(fn(structuredClone(schema)))
  const updateTable = (id: string, fn: (t: TableDef) => void) => update((s) => { fn(s.tables.find((t) => t.id === id)!); return s })

  const addTable = (template: string, x?: number, y?: number) => {
    const t = newTable(template, schema.tables, x ?? 40 + (schema.tables.length % 3) * 300, y ?? 40 + Math.floor(schema.tables.length / 3) * 260)
    update((s) => ({ ...s, tables: [...s.tables, t] }))
    setSelTable(t.id)
    toast(`Added table “${t.name}”.`, 'info')
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const template = e.dataTransfer.getData(DND_TYPE)
    if (!TEMPLATES[template]) return
    const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addTable(template, Math.round(p.x), Math.round(p.y))
  }

  const onNodesChange = (changes: NodeChange<TableNode>[]) => {
    setNodes((n) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), n))
    for (const c of changes) if (c.type === 'select' && c.selected) { setSelTable(c.id); setSelEdge(null) }
  }
  const onDragStop = (_: unknown, node: Node) =>
    updateTable(node.id, (t) => { t.x = Math.round(node.position.x); t.y = Math.round(node.position.y) })

  const connect = (a: { table: string; field: string }, b: { table: string; field: string }) => {
    const r = checkRelationship(schema, a, b)
    if ('error' in r) return toast(`Relationship rejected: ${r.error}`, 'error')
    update((s) => ({ ...s, relationships: [...s.relationships, r.rel] }))
    setSelEdge(r.rel.id)
    const d = describeRel({ ...schema, relationships: [r.rel] }, r.rel)
    toast(`Relationship created: ${d.from} → ${d.to} (${d.cardinality}).`)
  }
  const onConnect = (c: Connection) => connect({ table: c.source, field: c.sourceHandle!.slice(0, -2) }, { table: c.target, field: c.targetHandle!.slice(0, -2) })

  const removeRel = async (id: string) => {
    const r = schema.relationships.find((x) => x.id === id)!
    const d = describeRel(schema, r)
    if ((await confirmDialog({ title: 'Delete relationship?', body: `${d.from} → ${d.to}. You can undo this.`, confirm: 'Delete', danger: true })) === null) return
    update((s) => ({ ...s, relationships: s.relationships.filter((x) => x.id !== id) }))
    setSelEdge(null)
  }
  const removeTable = async (t: TableDef) => {
    if ((await confirmDialog({ title: `Remove table “${t.name}”?`, body: 'Its relationships are removed too. You can undo this.', confirm: 'Remove', danger: true })) === null) return
    update((s) => ({ tables: s.tables.filter((x) => x.id !== t.id), relationships: s.relationships.filter((r) => r.fromTable !== t.id && r.toTable !== t.id) }))
    setSelTable(null)
  }
  const removeField = async (t: TableDef, f: FieldDef) => {
    if ((await confirmDialog({ title: `Remove field “${f.name}”?`, body: 'Relationships using it are removed too. You can undo this.', confirm: 'Remove', danger: true })) === null) return
    update((s) => {
      const tt = s.tables.find((x) => x.id === t.id)!
      tt.fields = tt.fields.filter((x) => x.id !== f.id)
      s.relationships = s.relationships.filter((r) => r.fromField !== f.id && r.toField !== f.id)
      return s
    })
  }
  const resetLayout = () => update((s) => ({ ...s, tables: s.tables.map((t, i) => ({ ...t, x: 40 + (i % 3) * 320, y: 40 + Math.floor(i / 3) * 300 })) }))
  const save = () => { saveSchema(schema); toast('Schema and canvas layout saved.') }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target instanceof Element && e.target.closest('input,select,textarea'))) return
      if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if (e.key === 'y') { e.preventDefault(); redo() }
      if (e.key === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const table = schema.tables.find((t) => t.id === selTable)

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader title="Database Designer" slide="PPT Slide 3 · Schemas, primary keys, ER diagrams">
        <Button onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶ Undo</Button>
        <Button onClick={redo} disabled={!canRedo} title="Ctrl+Y">↷ Redo</Button>
        <Button onClick={resetLayout} disabled={!schema.tables.length}>Reset layout</Button>
        <Button onClick={() => setShowDdl(!showDdl)} aria-pressed={showDdl}>{showDdl ? 'Hide' : 'Show'} SQL</Button>
        <Button variant="primary" onClick={save} disabled={!dirty} title="Ctrl+S">💾 Save</Button>
      </PageHeader>
      <p className="text-sm text-slate-600">
        <b>Drag</b> a table from the palette onto the canvas, <b>move</b> cards to arrange them, and <b>connect</b> a field’s dot to a primary key on another table to create a relationship (try employees.department_id → departments.department_id).
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${dirty ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{dirty ? 'Unsaved changes' : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Nothing saved yet'}</span>
      </p>

      <div className="grid gap-4 xl:grid-cols-[200px_1fr_340px]">
        <Card className="!p-3">
          <h2 className="mb-2 text-sm font-semibold">Table palette</h2>
          <ul className="space-y-1.5">
            {Object.keys(TEMPLATES).map((t) => (
              <li key={t} draggable onDragStart={(e) => { e.dataTransfer.setData(DND_TYPE, t); e.dataTransfer.effectAllowed = 'copy' }}
                className="flex cursor-grab select-none items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm active:cursor-grabbing">
                <span>⠿ {t}</span>
                <button className="rounded px-1.5 text-blue-600 hover:bg-blue-100" aria-label={`Add ${t} table`} onClick={() => addTable(t)}>＋</button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Drag onto the canvas, or press ＋ (keyboard friendly).</p>
        </Card>

        <div className="h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white" onDragEnter={(e) => e.preventDefault()} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }} onDrop={onDrop} data-testid="canvas">
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeDragStop={onDragStop} onConnect={onConnect}
            onEdgeClick={(_, e) => { setSelEdge(e.id); setSelTable(null) }} onPaneClick={() => { setSelEdge(null); setSelTable(null) }}
            connectionMode={ConnectionMode.Loose} deleteKeyCode={null} zoomOnScroll={false} preventScrolling={false} fitView={nodes.length > 0} fitViewOptions={{ maxZoom: 1 }} minZoom={0.3}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {schema.tables.length === 0 && <p className="pointer-events-none relative -top-1/2 text-center text-slate-400">Drop tables here</p>}
        </div>

        <div className="space-y-4">
          {table ? <TableEditor key={table.id} table={table} schema={schema} onChange={(fn) => updateTable(table.id, fn)} onRemove={() => removeTable(table)} onRemoveField={(f) => removeField(table, f)} />
            : <Card className="!p-4 text-sm text-slate-500">Select a table card to rename it and edit its fields.</Card>}
          <RelationshipPanel schema={schema} selected={selEdge} onSelect={setSelEdge} onRemove={removeRel} onConnect={connect} />
        </div>
      </div>

      {showDdl && <Card><h2 className="mb-2 font-semibold">Schema as SQL (current canvas)</h2><pre className="overflow-x-auto rounded bg-slate-900 p-4 text-xs text-emerald-200">{toDdl(schema) || '-- no tables yet'}</pre></Card>}
    </div>
  )
}

function NameInput({ value, siblings, label, onCommit }: { value: string; siblings: string[]; label: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  const err = v === value ? null : checkName(v, siblings)
  const commit = () => { if (v !== value && !err) onCommit(v); else if (err) setV(value) }
  return (
    <span className="flex-1">
      <input aria-label={label} aria-invalid={!!err} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={`w-full rounded border px-1.5 py-0.5 ${err ? 'border-red-500' : 'border-slate-300'}`} />
      {err && <span className="block text-[11px] text-red-600">{err}</span>}
    </span>
  )
}

function TableEditor({ table, schema, onChange, onRemove, onRemoveField }: {
  table: TableDef; schema: Schema; onChange: (fn: (t: TableDef) => void) => void; onRemove: () => void; onRemoveField: (f: FieldDef) => void
}) {
  const names = table.fields.map((f) => f.name)
  const set = (id: string, patch: Partial<FieldDef>) => onChange((t) => Object.assign(t.fields.find((f) => f.id === id)!, patch))
  const move = (i: number, d: number) => onChange((t) => { const [f] = t.fields.splice(i, 1); t.fields.splice(i + d, 0, f) })
  return (
    <Card className="!p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-semibold">Table</span>
        <NameInput label="Table name" value={table.name} siblings={schema.tables.filter((t) => t.id !== table.id).map((t) => t.name)} onCommit={(v) => onChange((t) => { t.name = v })} />
        <Button variant="danger" onClick={onRemove} aria-label="Remove table">🗑</Button>
      </div>
      <ul className="space-y-2">
        {table.fields.map((f, i) => (
          <li key={f.id} className="rounded-md border border-slate-200 p-2 text-xs">
            <div className="flex items-center gap-1">
              <NameInput label={`Field ${i + 1} name`} value={f.name} siblings={names.filter((n) => n !== f.name)} onCommit={(v) => set(f.id, { name: v })} />
              <select aria-label={`${f.name} type`} value={f.type} onChange={(e) => set(f.id, { type: e.target.value as DataType })} className="rounded border border-slate-300 px-1 py-0.5">
                {DATA_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <label><input type="checkbox" checked={f.pk} onChange={(e) => set(f.id, e.target.checked ? { pk: true, required: true, unique: true } : { pk: false })} /> PK</label>
              <label><input type="checkbox" checked={f.required} disabled={f.pk} onChange={(e) => set(f.id, { required: e.target.checked })} /> Required</label>
              <label><input type="checkbox" checked={f.unique} disabled={f.pk} onChange={(e) => set(f.id, { unique: e.target.checked })} /> Unique</label>
              <span className="ml-auto flex gap-0.5">
                <button aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-1 hover:bg-slate-100 disabled:opacity-30">↑</button>
                <button aria-label={`Move ${f.name} down`} disabled={i === table.fields.length - 1} onClick={() => move(i, 1)} className="rounded px-1 hover:bg-slate-100 disabled:opacity-30">↓</button>
                <button aria-label={`Remove ${f.name}`} onClick={() => onRemoveField(f)} className="rounded px-1 text-red-600 hover:bg-red-50">✕</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Button className="mt-2" onClick={() => {
        let n = 1
        while (names.includes(`new_field_${n}`)) n++
        onChange((t) => { t.fields.push({ id: uid('fld'), name: `new_field_${n}`, type: 'TEXT', pk: false, required: false, unique: false }) })
      }}>＋ Add field</Button>
    </Card>
  )
}

function RelationshipPanel({ schema, selected, onSelect, onRemove, onConnect }: {
  schema: Schema; selected: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void
  onConnect: (a: { table: string; field: string }, b: { table: string; field: string }) => void
}) {
  const opts = schema.tables.flatMap((t) => t.fields.map((f) => ({ v: `${t.id}|${f.id}`, l: `${t.name}.${f.name}${f.pk ? ' (PK)' : ''}` })))
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const pick = (v: string) => { const [table, field] = v.split('|'); return { table, field } }
  return (
    <Card className="!p-4">
      <h2 className="mb-2 text-sm font-semibold">ER relationships ({schema.relationships.length})</h2>
      {schema.relationships.length === 0 ? <p className="text-xs text-slate-500">None yet. Drag between field dots on the canvas, or use the form below.</p> : (
        <ul className="space-y-1 text-xs">
          {schema.relationships.map((r) => {
            const d = describeRel(schema, r)
            return (
              <li key={r.id} className={`flex items-center gap-2 rounded border px-2 py-1 ${selected === r.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                <button className="flex-1 text-left" onClick={() => onSelect(r.id)}><b>{d.from}</b> → <b>{d.to}</b> <span className="text-slate-500">({d.cardinality}{d.cardinality === 'N : 1' ? ': many rows may point to one' : ''})</span></button>
                <button aria-label={`Delete relationship ${d.from} to ${d.to}`} onClick={() => onRemove(r.id)} className="text-red-600">✕</button>
              </li>
            )
          })}
        </ul>
      )}
      <form className="mt-3 space-y-1.5 border-t pt-3 text-xs" onSubmit={(e) => { e.preventDefault(); if (a && b) onConnect(pick(a), pick(b)) }}>
        <p className="font-medium">Keyboard alternative: connect fields</p>
        <select aria-label="Foreign key field" value={a} onChange={(e) => setA(e.target.value)} className="w-full rounded border px-1 py-1"><option value="">Field (foreign key)…</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        <select aria-label="Primary key field" value={b} onChange={(e) => setB(e.target.value)} className="w-full rounded border px-1 py-1"><option value="">References (primary key)…</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        <Button type="submit" disabled={!a || !b}>Connect</Button>
      </form>
    </Card>
  )
}

export default function Designer() {
  return <ReactFlowProvider><DesignerInner /></ReactFlowProvider>
}
