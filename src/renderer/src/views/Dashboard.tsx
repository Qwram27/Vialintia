import { useMemo, useState } from 'react'
import type { Formula, FormulaStatus } from '@shared/types'
import { csvToFormula } from '@/lib/importFormula'
import { currentVersion, useAccordIndex, useMaterialMap, useStore } from '@/store/store'
import { confirmDialog, navigate, openContextMenu, toast } from '@/store/ui'
import { computeFormula } from '@/lib/calc'
import { catalogNo, seasonCode, shortDate } from '@/lib/archive'
import { NoteBar } from '@/components/Charts'
import { Seg } from '@/components/Seg'
import { IconCopy, IconPlus, IconSearch, IconTrash, IconUpload } from '@/components/Icons'

const STATUS_LABEL: Record<FormulaStatus, string> = { testing: 'Testing', final: 'Final' }

export function Dashboard() {
  const formulas = useStore((s) => s.formulas)
  const settings = useStore((s) => s.settings)
  const createFormula = useStore((s) => s.createFormula)
  const duplicateFormula = useStore((s) => s.duplicateFormula)
  const deleteFormula = useStore((s) => s.deleteFormula)
  const materials = useMaterialMap()
  const accords = useAccordIndex()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<FormulaStatus | 'all'>('all')
  const [sort, setSort] = useState<'updated' | 'name' | 'number'>('updated')
  const [view, setViewState] = useState<'grid' | 'index'>(() => {
    try {
      return localStorage.getItem('vialintia.view') === 'index' ? 'index' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const setView = (v: 'grid' | 'index') => {
    setViewState(v)
    try {
      localStorage.setItem('vialintia.view', v)
    } catch {
      /* ignore */
    }
  }

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return formulas
      .filter((f) => status === 'all' || f.status === status)
      .filter(
        (f) =>
          !query ||
          f.name.toLowerCase().includes(query) ||
          f.tags.some((t) => t.toLowerCase().includes(query)) ||
          f.description.toLowerCase().includes(query) ||
          catalogNo(f, formulas).includes(query)
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'number'
            ? a.createdAt.localeCompare(b.createdAt)
            : b.updatedAt.localeCompare(a.updatedAt)
      )
      .map((f) => {
        const v = currentVersion(f)
        return { f, v, no: catalogNo(f, formulas), calc: computeFormula(f, v.rows, materials, settings, accords) }
      })
  }, [formulas, materials, settings, accords, q, status, sort])

  const updateFormula = useStore((s) => s.updateFormula)
  const remove = async (f: Formula) => {
    if (await confirmDialog('Delete formula', `“${f.name}” and all its versions and notes will be removed.`)) {
      deleteFormula(f.id)
      toast('Formula deleted')
    }
  }
  const cardMenu = (e: React.MouseEvent, f: Formula) =>
    openContextMenu(e, [
      { label: 'Open', onSelect: () => navigate(`/formula/${f.id}`) },
      { label: 'Assemble fragrance', onSelect: () => navigate(`/formula/${f.id}/assemble`) },
      {
        label: 'Duplicate',
        onSelect: () => {
          duplicateFormula(f.id)
          toast(`Duplicated ${f.name}`)
        }
      },
      {
        label: f.status === 'final' ? 'Mark as testing' : 'Mark as final',
        sep: true,
        onSelect: () => updateFormula(f.id, (x) => ({ ...x, status: x.status === 'final' ? 'testing' : 'final' }))
      },
      { label: 'Delete', danger: true, sep: true, onSelect: () => remove(f) }
    ])

  const counts = useMemo(() => {
    const c = { all: formulas.length, testing: 0, final: 0 }
    formulas.forEach((f) => c[f.status]++)
    return c
  }, [formulas])

  const importData = useStore((s) => s.importData)
  const settingsAll = useStore((s) => s.settings)
  /** Import one or more formulas: a Vialintia .json export or a formula .csv. Nothing is replaced. */
  const importFormula = async () => {
    const picked = await window.vialintia.importText('json,csv')
    if (!picked) return
    const text = picked
    try {
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text)
        if (!Array.isArray(data.formulas)) return toast('No formulas in that file')
        const st = importData({ formulas: data.formulas, refMaterials: data.refMaterials ?? data.materials })
        toast(`${st.formulasAdded} added, ${st.formulasUpdated} updated${st.missing ? ` · ${st.missing} rows missing a material` : ''}`)
        if (data.formulas.length === 1) navigate(`/formula/${data.formulas[0].id}`)
      } else {
        const parsed = csvToFormula(text, 'Imported formula', settingsAll)
        if (!parsed) return toast('That CSV is not a formula export')
        importData({ formulas: [parsed.formula], refMaterials: parsed.refMaterials })
        toast('Formula imported from CSV')
        navigate(`/formula/${parsed.formula.id}`)
      }
    } catch {
      toast('Could not read that file')
    }
  }

  const create = () => {
    const f = createFormula()
    navigate(`/formula/${f.id}`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Archive · AV27</div>
          <h1 className="page-title">Formulas</h1>
          <div className="page-sub">
            {String(formulas.length).padStart(3, '0')} entries · {materials.size} materials
          </div>
        </div>
        <div className="btn-group">
          <button className="btn" onClick={importFormula} title="Import a formula (.json from Vialintia or a formula .csv)">
            <IconUpload size={14} /> Import
          </button>
          <button className="btn btn-primary" onClick={create}>
            <IconPlus size={14} /> New formula
          </button>
        </div>
      </div>

      {formulas.length === 0 ? (
        <div className="card empty">
          <div className="mark">N°000</div>
          <h3>The archive is empty</h3>
          <p>Start the first entry. Percentages, dilutions, IFRA and costs are calculated as you compose.</p>
          <button className="btn btn-primary mt" onClick={create}>
            <IconPlus size={14} /> Create formula
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search" style={{ width: 300 }}>
              <IconSearch size={14} />
              <input className="input" placeholder="Search name, tag, N°…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Seg
              value={status}
              onChange={setStatus}
              options={(['all', 'testing', 'final'] as const).map((s) => ({
                value: s,
                label: (
                  <>
                    {s === 'all' ? 'All' : STATUS_LABEL[s]}
                    <span className="faint">{counts[s]}</span>
                  </>
                )
              }))}
            />
            <div className="spacer" />
            <Seg
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'index', label: 'Index' }
              ]}
            />
            <Seg
              value={sort}
              onChange={setSort}
              options={[
                { value: 'updated', label: 'Recent' },
                { value: 'number', label: 'N°' },
                { value: 'name', label: 'A–Z' }
              ]}
            />
          </div>

          {view === 'index' ? (
            <div className="card index-card">
              <table className="ftable itable">
                <thead>
                  <tr>
                    <th className="l">N°</th>
                    <th className="l">Name</th>
                    <th className="l">Status</th>
                    <th className="l">Season</th>
                    <th className="l">Version</th>
                    <th>Mat.</th>
                    <th>Conc.</th>
                    <th className="l" style={{ width: 160 }}>Structure</th>
                    <th>IFRA</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ f, v, no, calc }, i) => (
                    <tr key={f.id} style={{ '--i': i } as React.CSSProperties} onClick={() => navigate(`/formula/${f.id}`)} onContextMenu={(e) => cardMenu(e, f)}>
                      <td className="l idx-no">{no}</td>
                      <td className="l idx-name">{f.name}</td>
                      <td className="l">
                        <span className={`status status-${f.status}`}>{STATUS_LABEL[f.status]}</span>
                      </td>
                      <td className="l muted">{seasonCode(f.createdAt)}</td>
                      <td className="l muted">{v.label}</td>
                      <td className="muted">{calc.materialCount}</td>
                      <td>{f.concentration}%</td>
                      <td className="l">
                        <NoteBar byNote={calc.byNote} settings={settings} />
                      </td>
                      <td>
                        {calc.ifra.worst === 'over' ? (
                          <span className="ifra ifra-over">! Over</span>
                        ) : calc.ifra.worst === 'none' ? (
                          <span className="dim">—</span>
                        ) : (
                          <span className={`ifra ifra-${calc.ifra.worst}`}>{calc.ifra.worst === 'near' ? '◐ Near' : '✓ OK'}</span>
                        )}
                      </td>
                      <td className="muted">{shortDate(f.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <div className="empty">No entries match.</div>}
            </div>
          ) : (
          <div className="formula-grid">
            {list.map(({ f, v, no, calc }, i) => (
              <div key={f.id} className="card fcard" style={{ '--i': i } as React.CSSProperties} onClick={() => navigate(`/formula/${f.id}`)} onContextMenu={(e) => cardMenu(e, f)}>
                <div className="fcard-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Duplicate"
                    onClick={() => {
                      duplicateFormula(f.id)
                      toast(`Duplicated ${f.name}`)
                    }}
                  >
                    <IconCopy size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-danger"
                    title="Delete"
                    onClick={() => remove(f)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
                <div className="fcard-top">
                  <span className="fcard-no">N°{no}</span>
                  <span className="code">
                    {seasonCode(f.createdAt)} / {v.label}
                  </span>
                </div>
                <h3 className="fcard-name">{f.name}</h3>
                <div className="fcard-meta">
                  <span className={`status status-${f.status}`}>{STATUS_LABEL[f.status]}</span>
                  <span>·</span>
                  <span>{calc.materialCount} mat.</span>
                  <span>·</span>
                  <span>{f.concentration}%</span>
                  {calc.ifra.worst === 'over' && <span className="ifra ifra-over">! IFRA</span>}
                </div>
                {f.description ? <div className="fcard-desc">{f.description}</div> : null}
                <div className="fcard-foot">
                  <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                    {f.tags.slice(0, 3).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="faint">{shortDate(f.updatedAt)}</span>
                </div>
                <NoteBar byNote={calc.byNote} settings={settings} />
              </div>
            ))}
            {list.length === 0 && <div className="muted">No entries match.</div>}
          </div>
          )}
        </>
      )}
    </div>
  )
}
