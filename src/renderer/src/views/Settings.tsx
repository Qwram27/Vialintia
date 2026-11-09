import { isWeb } from '@/platform'
import { Seg } from '@/components/Seg'
import { APP_VERSION } from '@shared/version'
import { useEffect, useState } from 'react'
import type { AppData, Material, NoteLevel } from '@shared/types'
import { DEFAULT_FAMILIES, DEFAULT_NOTE_COLORS, DEFAULT_SETTINGS, NOTE_LABELS, NOTE_ORDER } from '@shared/defaults'
import { useStore } from '@/store/store'
import { confirmDialog, toast } from '@/store/ui'
import { uid } from '@/lib/id'
import { NumberInput } from '@/components/NumberInput'
import { ColorSwatch } from '@/components/ColorPicker'
import { FamilyDonut, StructureChart } from '@/components/Charts'
import { IconDownload, IconFolder, IconPlus, IconReset, IconTrash, IconUpload } from '@/components/Icons'

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const materials = useStore((s) => s.materials)
  const formulas = useStore((s) => s.formulas)
  const updateSettings = useStore((s) => s.updateSettings)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)

  /** Import a formulas, materials or settings export (or an old full backup) — merged into what is here, nothing deleted. */
  async function restoreFromFile() {
    const text = await window.vialintia.importJson()
    if (!text) return
    let data: Partial<AppData> & { seedVersion?: number; kind?: string; refMaterials?: Material[] }
    try {
      data = JSON.parse(text)
    } catch {
      return toast('That file is not a Vialintia export')
    }
    const hasMaterials = Array.isArray(data.materials)
    const hasFormulas = Array.isArray(data.formulas)
    const hasSettings = !!data.settings && typeof data.settings === 'object'
    if (!hasMaterials && !hasFormulas && !hasSettings) return toast('That file is not a Vialintia export')
    const parts = [
      hasFormulas ? `${data.formulas!.length} formulas` : null,
      hasMaterials ? `${data.materials!.length} materials` : null,
      hasSettings ? 'settings' : null
    ].filter(Boolean)
    const ok = await confirmDialog(
      'Import from file?',
      `Adds ${parts.join(', ')} from the file to this device. Nothing is deleted: formulas with the same id are updated when the file's copy is newer, materials are matched by name / CAS.${hasSettings ? ' Settings are replaced.' : ''}`,
      'Import'
    )
    if (!ok) return
    const st = importData(data)
    const bits = [
      st.formulasAdded || st.formulasUpdated ? `${st.formulasAdded} formulas added, ${st.formulasUpdated} updated` : null,
      st.materialsAdded || st.materialsUpdated ? `${st.materialsAdded} materials added, ${st.materialsUpdated} updated` : null,
      st.missing ? `${st.missing} rows still missing a material` : null,
      hasSettings ? 'settings restored' : null
    ].filter(Boolean)
    toast(bits.join(' · ') || 'Nothing new in the file')
  }
  const updateMaterial = useStore((s) => s.updateMaterial)
  const [newFamily, setNewFamily] = useState('')
  const [solventText, setSolventText] = useState(settings.solvents.join(', '))
  const [dataPath, setDataPath] = useState('')

  useEffect(() => {
    window.vialintia.dataPath().then(setDataPath)
  }, [])

  const setNoteColor = (n: NoteLevel, c: string) => updateSettings({ noteColors: { ...settings.noteColors, [n]: c } })
  const setFamily = (id: string, patch: { color?: string; name?: string }) =>
    updateSettings({ families: settings.families.map((f) => (f.id === id ? { ...f, ...patch } : f)) })

  const usedFamilies = new Map<string, number>()
  materials.forEach((m) => usedFamilies.set(m.family, (usedFamilies.get(m.family) ?? 0) + 1))

  // Preview data: one share per family so every colour is visible.
  const previewFamilies = settings.families.slice(0, 8).map((f, i) => ({ familyId: f.id, grams: 8 - i }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">System · Preferences</div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      <div className="settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card card-pad">
            <h3 className="card-title">
              Note colours
              <button className="btn btn-ghost btn-sm" onClick={() => updateSettings({ noteColors: { ...DEFAULT_NOTE_COLORS } })}>
                <IconReset size={13} /> Reset
              </button>
            </h3>
            <div className="color-list" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {NOTE_ORDER.map((n) => (
                <div key={n} className="color-item">
                  <ColorSwatch value={settings.noteColors[n]} onChange={(c) => setNoteColor(n, c)} />
                  <span className="name">{NOTE_LABELS[n]}</span>
                  <span className="hex">{settings.noteColors[n]}</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <StructureChart byNote={{ top: 25, heart: 40, base: 35 }} settings={settings} />
          </div>

          <div className="card card-pad">
            <h3 className="card-title">
              Olfactive family colours
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  if (await confirmDialog('Reset family colours?', 'Built-in families go back to their default colours and names. Your custom families stay.', 'Reset')) {
                    updateSettings({
                      families: settings.families.map((f) => {
                        const def = DEFAULT_FAMILIES.find((d) => d.id === f.id)
                        return def ? { ...def } : f
                      })
                    })
                  }
                }}
              >
                <IconReset size={13} /> Reset all
              </button>
            </h3>
            <div className="color-list">
              {settings.families.map((f) => {
                const def = DEFAULT_FAMILIES.find((d) => d.id === f.id)
                const count = usedFamilies.get(f.id) ?? 0
                return (
                  <div key={f.id} className="color-item">
                    <ColorSwatch value={f.color} onChange={(c) => setFamily(f.id, { color: c })} />
                    <FamilyName value={f.name} onCommit={(name) => setFamily(f.id, { name })} />
                    {def && def.color !== f.color && (
                      <button className="btn btn-ghost btn-icon" style={{ width: 22, height: 22 }} title="Reset to default colour" onClick={() => setFamily(f.id, { color: def.color })}>
                        <IconReset size={12} />
                      </button>
                    )}
                    {!f.builtin && (
                      <button
                        className="btn btn-ghost btn-icon btn-danger"
                        style={{ width: 22, height: 22 }}
                        title="Delete family"
                        onClick={async () => {
                          const msg = count ? `${count} material${count > 1 ? 's' : ''} will move to “Other”.` : 'This family is not used by any material.'
                          if (await confirmDialog(`Delete “${f.name}”?`, msg)) {
                            materials.filter((m) => m.family === f.id).forEach((m) => updateMaterial(m.id, { family: 'other' }))
                            updateSettings({ families: settings.families.filter((x) => x.id !== f.id) })
                          }
                        }}
                      >
                        <IconTrash size={12} />
                      </button>
                    )}
                    <span className="hex" title={`${count} materials`}>
                      {count || ''}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="row mt">
              <input
                className="input"
                placeholder="New family name, e.g. Tea, Smoky…"
                value={newFamily}
                onChange={(e) => setNewFamily(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFamily()}
              />
              <button className="btn" onClick={addFamily} disabled={!newFamily.trim()}>
                <IconPlus size={14} /> Add family
              </button>
            </div>
            <div className="divider" />
            <div className="label mb">Preview</div>
            <FamilyDonut byFamily={previewFamilies} settings={settings} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card card-pad">
            <h3 className="card-title">Calculation</h3>
            <div className="field mb">
              <label>Balance resolution</label>
              <Seg
                block
                value={String(settings.balanceStep ?? 0.01)}
                onChange={(v) => updateSettings({ balanceStep: Number(v) })}
                options={['0.1', '0.01', '0.001'].map((v) => ({ value: v, label: `${v} g` }))}
              />
              <span className="hint">Smallest step your scale shows — used to round scaled formulas and the Assemble targets.</span>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Drop mass</label>
                <div className="suffix">
                  <NumberInput value={settings.dropMassG} min={0.001} onCommit={(v) => updateSettings({ dropMassG: v ?? DEFAULT_SETTINGS.dropMassG })} />
                  <span>g</span>
                </div>
                <span className="hint">Weigh 20 drops from your pipette and divide by 20.</span>
              </div>
              <div className="field">
                <label>IFRA warning from</label>
                <div className="suffix">
                  <NumberInput
                    value={Math.round(settings.nearLimitRatio * 100)}
                    min={1}
                    max={100}
                    onCommit={(v) => updateSettings({ nearLimitRatio: (v ?? 90) / 100 })}
                  />
                  <span>%</span>
                </div>
                <span className="hint">of the limit, shown as “Near”.</span>
              </div>
              <div className="field">
                <label>Perfume density</label>
                <div className="suffix">
                  <NumberInput value={settings.productDensity} min={0.5} max={1.5} onCommit={(v) => updateSettings({ productDensity: v ?? DEFAULT_SETTINGS.productDensity })} />
                  <span>g/ml</span>
                </div>
              </div>
              <div className="field">
                <label>Ethanol density</label>
                <div className="suffix">
                  <NumberInput value={settings.ethanolDensity} min={0.5} max={1.5} onCommit={(v) => updateSettings({ ethanolDensity: v ?? DEFAULT_SETTINGS.ethanolDensity })} />
                  <span>g/ml</span>
                </div>
              </div>
              <div className="field">
                <label>Currency symbol</label>
                <input className="input" value={settings.currency} maxLength={4} onChange={(e) => updateSettings({ currency: e.target.value })} />
              </div>
              <div className="field">
                <label>Alcohol price</label>
                <div className="suffix">
                  <NumberInput value={settings.alcoholPricePerL} min={0} onCommit={(v) => updateSettings({ alcoholPricePerL: v ?? 0 })} />
                  <span>/L</span>
                </div>
              </div>
            </div>
            <div className="field mt">
              <label>Solvents</label>
              <input
                className="input"
                value={solventText}
                onChange={(e) => setSolventText(e.target.value)}
                onBlur={() => {
                  const list = solventText.split(',').map((s) => s.trim()).filter(Boolean)
                  updateSettings({ solvents: list.length ? list : DEFAULT_SETTINGS.solvents })
                }}
              />
              <span className="hint">Comma separated, used for dilutions.</span>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="card-title">Data & backups</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              {isWeb
                ? 'Everything is stored on this device, in the browser — no account, works offline. Use Export / Import from file to move data between your computer and phone — importing adds to what is here, nothing is deleted.'
                : 'Everything is stored locally on this computer — no account, no internet. A snapshot is taken automatically every time the app starts (last 10 kept).'}
            </p>
            <div className="small faint mb" style={{ wordBreak: 'break-all' }}>
              {dataPath}
            </div>
            <div className="data-actions">
              <button
                className="btn"
                onClick={async () => {
                  const stamp = new Date().toISOString().slice(0, 10)
                  // carry the materials the formulas use, so another device can match them by name
                  const used = new Set(formulas.flatMap((f) => f.versions.flatMap((v) => v.rows.map((r) => r.materialId))))
                  const refMaterials = materials.filter((m) => used.has(m.id))
                  const file = { app: 'Vialintia', kind: 'formulas', version: 2, formulas, refMaterials }
                  const p = await window.vialintia.exportJson(JSON.stringify(file, null, 2), `vialintia-formulas-${stamp}.json`)
                  if (p) toast('Formulas exported')
                }}
              >
                <IconDownload /> Export formulas
              </button>
              <button
                className="btn"
                onClick={async () => {
                  const stamp = new Date().toISOString().slice(0, 10)
                  const file = { app: 'Vialintia', kind: 'materials', version: 1, seedVersion: settings.seedVersion, materials }
                  const p = await window.vialintia.exportJson(JSON.stringify(file, null, 2), `vialintia-materials-${stamp}.json`)
                  if (p) toast('Materials exported')
                }}
              >
                <IconDownload /> Export materials
              </button>
              <button
                className="btn"
                onClick={async () => {
                  const stamp = new Date().toISOString().slice(0, 10)
                  const file = { app: 'Vialintia', kind: 'settings', version: 1, settings }
                  const p = await window.vialintia.exportJson(JSON.stringify(file, null, 2), `vialintia-settings-${stamp}.json`)
                  if (p) toast('Settings exported')
                }}
              >
                <IconDownload /> Export settings
              </button>
              <button className="btn" onClick={restoreFromFile}>
                <IconUpload /> Import from file
              </button>
              {!isWeb && (
                <button className="btn btn-ghost" onClick={() => window.vialintia.openDataFolder()}>
                  <IconFolder /> Open data folder
                </button>
              )}
            </div>
            <div className="divider" />
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <span className="faint small" style={{ flex: '1 1 220px' }}>
                Reset clears all formulas and settings and reloads the starter library. Export first if you want to keep anything.
              </span>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const ok = await confirmDialog(
                    'Reset the app?',
                    `All ${formulas.length} formulas, your edits to ${materials.length} materials and all settings will be deleted and the starter library reloaded. This cannot be undone.`,
                    'Reset'
                  )
                  if (ok) {
                    resetAll()
                    toast('App reset')
                  }
                }}
              >
                <IconReset /> Reset app
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="card-title">About</h3>
            <div className="muted small" style={{ lineHeight: 1.7 }}>
              Vialintia {APP_VERSION} — fine fragrance formulation archive.
              <br />
              Percentages: <b>Weighed %</b> is the share of what you put on the scale; <b>In product %</b> is the neat material in the finished
              perfume after dilution and the chosen concentration — the figure IFRA limits apply to.
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  function addFamily() {
    const name = newFamily.trim()
    if (!name) return
    const palette = ['#7cc2a6', '#5873a8', '#9fd6d2', '#7d5f8f', '#3d8fa8', '#97c78f']
    updateSettings({
      families: [...settings.families, { id: `fam-${uid().slice(0, 8)}`, name, color: palette[settings.families.length % palette.length], builtin: false }]
    })
    setNewFamily('')
  }
}

function FamilyName({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      className="name-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? v.trim() !== value && onCommit(v.trim()) : setV(value))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
