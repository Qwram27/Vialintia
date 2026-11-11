import { useEffect, useMemo, useState } from 'react'
import type { Material, MaterialType, NoteLevel } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER } from '@shared/defaults'
import { familyById, useAccordIndex, useStore } from '@/store/store'
import { confirmDialog, navigate, openContextMenu, toast } from '@/store/ui'
import { catalogNo } from '@/lib/archive'
import { fmt, fmtSmart, fmtTrim, inkOn } from '@/lib/calc'
import { csvToMaterials, materialsToCsv } from '@/lib/exports'
import { NumberInput } from '@/components/NumberInput'
import { Seg } from '@/components/Seg'
import { useIsMobile } from '@/lib/useMobile'
import { Sheet } from '@/components/Sheet'
import { IconDownload, IconPlus, IconSearch, IconTrash, IconUpload, IconX } from '@/components/Icons'

const TYPES: Record<MaterialType, string> = { natural: 'Natural', synthetic: 'Synthetic', base: 'Base / accord', other: 'Other' }
type SortKey = 'name' | 'family' | 'note' | 'ifra' | 'price'

export function Library() {
  const materials = useStore((s) => s.materials)
  const formulas = useStore((s) => s.formulas)
  const settings = useStore((s) => s.settings)
  const addMaterial = useStore((s) => s.addMaterial)
  const importMaterials = useStore((s) => s.importMaterials)
  const [q, setQ] = useState('')
  const [family, setFamily] = useState('all')
  const [note, setNote] = useState<NoteLevel | 'all'>('all')
  const [type, setType] = useState<MaterialType | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [selected, setSelected] = useState<string | null>(null)
  const mobile = useIsMobile()
  const deleteMaterial = useStore((s) => s.deleteMaterial)

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of formulas) {
      const ids = new Set(f.versions.flatMap((v) => v.rows.map((r) => r.materialId)))
      ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1))
    }
    return m
  }, [formulas])

  const rowMenu = (e: React.MouseEvent, m: Material) =>
    openContextMenu(e, [
      { label: 'Edit', onSelect: () => setSelected(m.id) },
      !!m.accordFormulaId && { label: 'Open accord formula', onSelect: () => navigate(`/formula/${m.accordFormulaId}`) },
      {
        label: 'Duplicate',
        onSelect: () => {
          const { id, aliasIds, accordFormulaId, createdAt, updatedAt, ...rest } = m
          const c = addMaterial({ ...rest, name: `${m.name} copy` })
          setSelected(c.id)
          toast(`Duplicated ${m.name}`)
        }
      },
      {
        label: 'Delete',
        danger: true,
        sep: true,
        onSelect: async () => {
          const n = usage.get(m.id) ?? 0
          const msg = n ? `“${m.name}” is used in ${n} formula${n > 1 ? 's' : ''}. Those rows will show as missing.` : `“${m.name}” will be removed from the library.`
          if (await confirmDialog('Delete material?', msg)) {
            deleteMaterial(m.id)
            if (selected === m.id) setSelected(null)
            toast('Material deleted')
          }
        }
      }
    ])

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    const famOrder = new Map(settings.families.map((f, i) => [f.id, i]))
    return materials
      .filter((m) => family === 'all' || m.family === family)
      .filter((m) => note === 'all' || m.note === note)
      .filter((m) => type === 'all' || m.type === type)
      .filter(
        (m) =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.cas?.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query) ||
          m.supplier?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        switch (sort) {
          case 'family':
            return (famOrder.get(a.family) ?? 99) - (famOrder.get(b.family) ?? 99) || a.name.localeCompare(b.name)
          case 'note':
            return NOTE_ORDER.indexOf(a.note) - NOTE_ORDER.indexOf(b.note) || a.name.localeCompare(b.name)
          case 'ifra':
            return (a.ifraLimit ?? Infinity) - (b.ifraLimit ?? Infinity)
          case 'price':
            return (b.pricePerKg ?? -1) - (a.pricePerKg ?? -1)
          default:
            return a.name.localeCompare(b.name)
        }
      })
  }, [materials, settings.families, q, family, note, type, sort])

  const showFilters = q.trim().length > 0 || family !== 'all' || note !== 'all' || type !== 'all'
  const sel = materials.find((m) => m.id === selected)

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cls} style={{ cursor: 'pointer', color: sort === key ? 'var(--accent-hi)' : undefined }} onClick={() => setSort(key)}>
      {label}
    </th>
  )

  return (
    <div className="page page-wide" style={{ maxWidth: 1700 }}>
      <div className="page-head">
        <div>
          <div className="page-kicker">Index · Raw materials</div>
          <h1 className="page-title">Materials</h1>
          <div className="page-sub">{String(materials.length).padStart(3, '0')} entries · IFRA from the IFRA Standards · tenacity from TGSC · prices are yours</div>
        </div>
        <div className="btn-group">
          <button
            className="btn btn-primary"
            onClick={() => {
              const m = addMaterial({ family: family !== 'all' ? family : 'other', note: note !== 'all' ? note : 'heart' })
              setSelected(m.id)
            }}
          >
            <IconPlus /> New material
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search" style={{ width: 300 }}>
          <IconSearch />
          <input className="input" placeholder="Search name, CAS, odour, supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {/* filters only once a search has started (or a filter is set) — keeps the page calm */}
        {showFilters && (
          <>
            <select className="select" style={{ width: 160 }} value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="all">All families</option>
              {settings.families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 150 }} value={type} onChange={(e) => setType(e.target.value as MaterialType | 'all')}>
              <option value="all">All types</option>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Seg
              value={note}
              onChange={setNote}
              options={[{ value: 'all' as const, label: 'All' }, ...NOTE_ORDER.map((n) => ({ value: n, label: NOTE_LABELS[n] }))]}
            />
          </>
        )}
        {showFilters && <span className="faint small">{list.length} shown</span>}
      </div>

      <div className={`lib${sel && !mobile ? ' with-drawer' : ''}`}>
        {mobile ? (
          <div className="m-list">
            {list.map((m) => {
              const f = familyById(settings, m.family)
              return (
                <button key={m.id} className={`m-row${m.id === selected ? ' sel' : ''}`} onClick={() => setSelected(m.id)}>
                  <span className="m-row-main">
                    <span className="m-row-name">
                      <span className="dot" style={{ background: f.color }} />
                      <span className="nm">{m.name}</span>
                    </span>
                    <span className="m-row-meta">
                      <span className="note-pill" style={{ background: settings.noteColors[m.note], color: inkOn(settings.noteColors[m.note]) }}>
                        {NOTE_LABELS[m.note].slice(0, 1)}
                      </span>
                      <span>{f.name}</span>
                      {m.cas && (
                        <>
                          <span>·</span>
                          <span>{m.cas}</span>
                        </>
                      )}
                      {usage.get(m.id) ? (
                        <>
                          <span>·</span>
                          <span>{usage.get(m.id)}×</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="m-row-amt">
                    <span className="v small">{m.ifraLimit != null ? `${fmtTrim(m.ifraLimit)}%` : '—'}</span>
                    <span className="u">{m.pricePerKg ? `${settings.currency}${fmt(m.pricePerKg, 0)}/kg` : 'IFRA'}</span>
                  </span>
                </button>
              )
            })}
            {list.length === 0 && <div className="empty">No materials match your filters.</div>}
          </div>
        ) : (
        <div className="card" style={{ padding: '4px 10px 10px', minWidth: 0 }}>
          <div className="table-wrap">
            <table className="ftable ltable">
              <colgroup>
                <col style={{ width: '27%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr>
                  {th('name', 'Material', 'l')}
                  <th className="l">CAS</th>
                  {th('family', 'Family', 'l')}
                  {th('note', 'Note', 'l')}
                  <th>Tenacity</th>
                  <th>Stock dil.</th>
                  {th('ifra', 'IFRA %')}
                  {th('price', `Price / kg`)}
                  <th>Used in</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const f = familyById(settings, m.family)
                  return (
                    <tr key={m.id} className={m.id === selected ? 'sel' : ''} onClick={() => setSelected(m.id === selected ? null : m.id)} onContextMenu={(e) => rowMenu(e, m)}>
                      <td className="l">
                        <div className="row">
                          <span className="dot" style={{ background: f.color }} />
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td className="l muted small">{m.cas ?? ''}</td>
                      <td className="l">{f.name}</td>
                      <td className="l">
                        <span className="note-pill" style={{ background: settings.noteColors[m.note], color: inkOn(settings.noteColors[m.note]) }}>
                          {NOTE_LABELS[m.note]}
                        </span>
                      </td>
                      <td className="muted">{m.tenacityHours ? `${fmtTrim(m.tenacityHours, 1)} h` : '—'}</td>
                      <td className="muted">{m.defaultDilution < 100 ? `${fmtTrim(m.defaultDilution)}%` : 'neat'}</td>
                      <td>{m.ifraLimit != null ? fmtTrim(m.ifraLimit) : <span className="dim">—</span>}</td>
                      <td>{m.pricePerKg ? `${settings.currency}${fmt(m.pricePerKg, 2)}` : <span className="dim">—</span>}</td>
                      <td className="muted">{usage.get(m.id) ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {list.length === 0 && <div className="empty">No materials match your filters.</div>}
          </div>
        </div>
        )}
        {sel &&
          (mobile ? (
            <Sheet onClose={() => setSelected(null)} className="sheet-drawer">
              <MaterialDrawer key={sel.id} material={sel} usage={usage.get(sel.id) ?? 0} onClose={() => setSelected(null)} />
            </Sheet>
          ) : (
            <MaterialDrawer key={sel.id} material={sel} usage={usage.get(sel.id) ?? 0} onClose={() => setSelected(null)} />
          ))}
      </div>
      <div className="page-foot">
        <button
          className="btn"
          onClick={async () => {
            const text = await window.vialintia.importText('csv')
            if (!text) return
            const items = csvToMaterials(text, settings)
            const n = importMaterials(items)
            toast(n ? `Imported ${n} materials` : 'No materials found — the CSV needs a “name” column')
          }}
        >
          <IconUpload /> Import CSV
        </button>
        <button
          className="btn"
          onClick={async () => {
            const p = await window.vialintia.exportText(materialsToCsv(materials, settings), 'vialintia-materials.csv', 'csv')
            if (p) toast('Library exported')
          }}
        >
          <IconDownload /> Export CSV
        </button>
      </div>
    </div>
  )
}

function MaterialDrawer({ material, usage, onClose }: { material: Material; usage: number; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const updateMaterial = useStore((s) => s.updateMaterial)
  const deleteMaterial = useStore((s) => s.deleteMaterial)
  const [draft, setDraft] = useState({
    name: material.name,
    cas: material.cas ?? '',
    supplier: material.supplier ?? '',
    description: material.description ?? '',
    solvent: material.solvent ?? ''
  })
  useEffect(() => {
    setDraft({
      name: material.name,
      cas: material.cas ?? '',
      supplier: material.supplier ?? '',
      description: material.description ?? '',
      solvent: material.solvent ?? ''
    })
  }, [material.id])

  const set = (patch: Partial<Material>) => updateMaterial(material.id, patch)
  const text = (key: keyof typeof draft, multiline = false, placeholder = '') => {
    const props = {
      className: multiline ? 'textarea' : 'input',
      value: draft[key],
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [key]: e.target.value })),
      onBlur: () => {
        const v = draft[key].trim()
        if (key === 'name' && !v) return setDraft((d) => ({ ...d, name: material.name }))
        if (v !== ((material[key] as string | undefined) ?? '')) set({ [key]: v || undefined })
      }
    }
    return multiline ? <textarea rows={3} {...props} /> : <input {...props} />
  }

  return (
    <div className="card drawer">
      <div className="row mb">
        <span className="page-kicker" style={{ margin: 0 }}>
          Material
        </span>
        <div className="spacer" />
        <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close">
          <IconX />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {material.accordFormulaId && <AccordInfoBox material={material} />}
        <div className="field">
          <label>Name</label>
          {text('name')}
        </div>
        <div className="grid-2">
          <div className="field">
            <label>CAS</label>
            {text('cas', false, '000-00-0')}
          </div>
          <div className="field">
            <label>Type</label>
            <select className="select" value={material.type} onChange={(e) => set({ type: e.target.value as MaterialType })}>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Family</label>
            <div className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ background: familyById(settings, material.family).color }} />
              <select className="select" value={material.family} onChange={(e) => set({ family: e.target.value })}>
                {settings.families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Note</label>
            <Seg block value={material.note} onChange={(n) => set({ note: n })} options={NOTE_ORDER.map((n) => ({ value: n, label: NOTE_LABELS[n] }))} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Tenacity on blotter</label>
            <div className="suffix">
              <NumberInput value={material.tenacityHours} min={0} allowEmpty onCommit={(v) => set({ tenacityHours: v })} placeholder="—" />
              <span>h</span>
            </div>
          </div>
          <div className="field">
            <label>Price (neat)</label>
            <div className="suffix">
              <NumberInput value={material.pricePerKg} min={0} allowEmpty onCommit={(v) => set({ pricePerKg: v })} placeholder="—" />
              <span>/kg</span>
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Default dilution</label>
            <div className="suffix">
              <NumberInput value={material.defaultDilution} min={0.0001} max={100} onCommit={(v) => set({ defaultDilution: v ?? 100 })} />
              <span>%</span>
            </div>
          </div>
          <div className="field">
            <label>Solvent</label>
            <select className="select" value={material.solvent ?? ''} onChange={(e) => set({ solvent: e.target.value || undefined })}>
              <option value="">—</option>
              {settings.solvents.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>IFRA limit · Cat. 4 (fine fragrance)</label>
          <div className="suffix">
            <NumberInput value={material.ifraLimit} min={0} allowEmpty onCommit={(v) => set({ ifraLimit: v })} placeholder="No own IFRA Standard" />
            <span>%</span>
          </div>
          <span className="hint">Max % in the finished product. Check your supplier’s IFRA certificate / the current IFRA Amendment.</span>
        </div>
        <div className="field">
          <label>Supplier</label>
          {text('supplier')}
        </div>
        <div className="field">
          <label>Odour description</label>
          {text('description', true)}
        </div>
        <div className="divider" />
        <div className="row">
          <span className="faint small">{usage ? `Used in ${usage} formula${usage > 1 ? 's' : ''}` : 'Not used in any formula'}</span>
          <div className="spacer" />
          <button
            className="btn btn-sm btn-danger"
            onClick={async () => {
              const msg = usage
                ? `“${material.name}” is used in ${usage} formula${usage > 1 ? 's' : ''}. Those rows will show as missing.`
                : `“${material.name}” will be removed from the library.`
              if (await confirmDialog('Delete material?', msg)) {
                deleteMaterial(material.id)
                onClose()
                toast('Material deleted')
              }
            }}
          >
            <IconTrash size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/** Accord materials: where the composition comes from and what is inside (for IFRA). */
function AccordInfoBox({ material }: { material: Material }) {
  const formulas = useStore((s) => s.formulas)
  const accords = useAccordIndex()
  const f = formulas.find((x) => x.id === material.accordFormulaId)
  const info = accords.get(material.id)
  const parts = [...(info?.parts ?? [])].sort((a, b) => b.fraction - a.fraction)
  return (
    <div className="accord-box">
      <div className="row">
        <span className="label">Accord</span>
        <div className="spacer" />
        {f ? (
          <button className="btn btn-sm" onClick={() => navigate(`/formula/${f.id}`)}>
            Open N°{catalogNo(f, formulas)}
          </button>
        ) : (
          <span className="faint small">linked formula deleted</span>
        )}
      </div>
      {f && (
        <>
          <div className="small muted">
            Built from “{f.name}” — composition, cost and IFRA contributions follow that formula’s current version.
          </div>
          <div className="accord-parts">
            {parts.slice(0, 12).map((p) => (
              <div key={p.material.id} className="stat-row">
                <span className="k">{p.material.name}</span>
                <span className="v">{fmtSmart(p.fraction * 100)}%</span>
              </div>
            ))}
            {parts.length > 12 && <div className="faint small">+ {parts.length - 12} more</div>}
            {(() => {
              const solvent = 1 - parts.reduce((a, p) => a + p.fraction, 0)
              return solvent > 0.0005 ? (
                <div className="stat-row">
                  <span className="k faint">Solvent from dilutions</span>
                  <span className="v faint">{fmtSmart(solvent * 100)}%</span>
                </div>
              ) : null
            })()}
          </div>
        </>
      )}
    </div>
  )
}
