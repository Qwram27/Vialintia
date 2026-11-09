import { create } from 'zustand'
import { DEFAULT_FAMILIES, DEFAULT_NOTE_COLORS, DEFAULT_SETTINGS, LEGACY_DEFAULT_COLORS, PRODUCT_PRESETS } from '@shared/defaults'
import type { AppData, Formula, FormulaRow, FormulaVersion, Material, Settings } from '@shared/types'
import { SEED_VERSION, seedMaterials, upgradeSeedLibrary } from '@/data/seedMaterials'
import { uid } from '@/lib/id'

interface History {
  past: Formula[]
  future: Formula[]
}

interface State {
  ready: boolean
  materials: Material[]
  formulas: Formula[]
  settings: Settings
  history: Record<string, History>

  init(): Promise<void>

  addMaterial(partial?: Partial<Material>): Material
  updateMaterial(id: string, patch: Partial<Material>): void
  deleteMaterial(id: string): void
  importMaterials(list: Partial<Material>[]): number

  createFormula(name?: string): Formula
  updateFormula(id: string, updater: (f: Formula) => Formula, opts?: { history?: boolean }): void
  deleteFormula(id: string): void
  duplicateFormula(id: string): Formula | null
  undo(id: string): void
  redo(id: string): void

  updateSettings(patch: Partial<Settings>): void
  replaceAll(data: Partial<AppData>): void
}

const HISTORY_LIMIT = 150
const now = () => new Date().toISOString()

export function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const base = { ...DEFAULT_SETTINGS, ...(s ?? {}) }
  // Colours still on an old built-in default move to the current palette; user picks are kept.
  const legacy = (c: string | undefined) => !c || LEGACY_DEFAULT_COLORS.has(c.toLowerCase())
  const families = Array.isArray(s?.families)
    ? s!.families.map((f) => {
        const def = DEFAULT_FAMILIES.find((d) => d.id === f.id)
        return def && legacy(f.color) ? { ...f, color: def.color } : f
      })
    : DEFAULT_FAMILIES.map((f) => ({ ...f }))
  const storedNotes: Partial<Settings['noteColors']> = s?.noteColors ?? {}
  const noteColors = { ...DEFAULT_NOTE_COLORS }
  for (const k of Object.keys(noteColors) as (keyof typeof noteColors)[]) {
    const c = storedNotes[k]
    if (c && !legacy(c)) noteColors[k] = c
  }
  // Make sure every built-in family exists (e.g. after an update adds new ones).
  for (const def of DEFAULT_FAMILIES) {
    if (!families.some((f) => f.id === def.id)) families.push({ ...def })
  }
  // prefs v1: IFRA "near limit" warning default moved 80% → 90% (keep any value the user chose).
  const prefsVersion = s?.prefsVersion ?? 0
  const nearLimitRatio = s && prefsVersion < 1 && s.nearLimitRatio === 0.8 ? 0.9 : base.nearLimitRatio
  return {
    ...base,
    prefsVersion: 1,
    nearLimitRatio,
    noteColors,
    families,
    solvents: Array.isArray(s?.solvents) && s!.solvents.length ? s!.solvents : DEFAULT_SETTINGS.solvents
  }
}

function normalizeFormula(f: Formula): Formula {
  const versions = f.versions?.length
    ? f.versions
    : [{ id: uid(), label: 'V1', createdAt: f.createdAt ?? now(), rows: [] }]
  return {
    ...f,
    // Earlier versions were labelled "Mod 1", "Mod 2"… — now "V1", "V2"…
    versions: versions.map((v) => {
      const m = /^mod\s*(\d+)$/i.exec(v.label.trim())
      return m ? { ...v, label: `V${m[1]}` } : v
    }),
    tags: f.tags ?? [],
    notes: f.notes ?? [],
    description: f.description ?? '',
    batch: { ...{ mode: 'bottles' as const, bottles: 1, bottleMl: 50, massG: 10 }, ...(f.batch ?? {}) },
    currentVersionId: versions.some((v) => v.id === f.currentVersionId) ? f.currentVersionId : versions[versions.length - 1].id
  }
}

export function currentVersion(f: Formula): FormulaVersion {
  return f.versions.find((v) => v.id === f.currentVersionId) ?? f.versions[f.versions.length - 1]
}

export function withRows(f: Formula, rows: FormulaRow[]): Formula {
  return {
    ...f,
    versions: f.versions.map((v) => (v.id === f.currentVersionId ? { ...v, rows } : v))
  }
}

export function newFormula(name = 'Untitled formula'): Formula {
  const v: FormulaVersion = { id: uid(), label: 'V1', createdAt: now(), rows: [] }
  return {
    id: uid(),
    name,
    description: '',
    tags: [],
    status: 'draft',
    unit: 'g',
    productType: 'edp',
    concentration: PRODUCT_PRESETS.edp.concentration,
    batch: { mode: 'bottles', bottles: 1, bottleMl: 50, massG: 10 },
    versions: [v],
    currentVersionId: v.id,
    notes: [],
    createdAt: now(),
    updatedAt: now()
  }
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  materials: [],
  formulas: [],
  settings: normalizeSettings(undefined),
  history: {},

  async init() {
    const data = await window.vialintia.load()
    const firstRun = !Array.isArray(data.materials)
    const seedFrom = data.settings?.seedVersion ?? 1
    const upgrade = !firstRun && seedFrom < SEED_VERSION
    set({
      materials: firstRun ? seedMaterials() : upgrade ? upgradeSeedLibrary(data.materials!, seedFrom) : data.materials!,
      formulas: Array.isArray(data.formulas) ? data.formulas.map(normalizeFormula) : [],
      settings: { ...normalizeSettings(data.settings), seedVersion: SEED_VERSION },
      ready: true
    })
    if (firstRun || upgrade) {
      const s = get()
      window.vialintia.save('materials', s.materials)
      window.vialintia.save('formulas', s.formulas)
      window.vialintia.save('settings', s.settings)
    }
  },

  addMaterial(partial = {}) {
    const m: Material = {
      id: uid(),
      name: 'New material',
      family: 'other',
      note: 'heart',
      tenacityHours: null,
      defaultDilution: 100,
      pricePerKg: null,
      ifraLimit: null,
      supplier: '',
      description: '',
      type: 'synthetic',
      createdAt: now(),
      ...partial,
      updatedAt: now()
    }
    set((s) => ({ materials: [...s.materials, m] }))
    return m
  },

  updateMaterial(id, patch) {
    set((s) => ({
      materials: s.materials.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: now() } : m))
    }))
  },

  deleteMaterial(id) {
    set((s) => ({ materials: s.materials.filter((m) => m.id !== id) }))
  },

  importMaterials(list) {
    const existing = new Map(get().materials.map((m) => [m.name.trim().toLowerCase(), m]))
    let count = 0
    const updated = [...get().materials]
    for (const item of list) {
      if (!item.name) continue
      const key = item.name.trim().toLowerCase()
      const found = existing.get(key)
      if (found) {
        const idx = updated.findIndex((m) => m.id === found.id)
        updated[idx] = { ...found, ...item, id: found.id, updatedAt: now() }
      } else {
        updated.push({
          id: uid(),
          family: 'other',
          note: 'heart',
          defaultDilution: 100,
          type: 'other',
          createdAt: now(),
          ...item,
          name: item.name.trim(),
          updatedAt: now()
        } as Material)
      }
      count++
    }
    set({ materials: updated })
    return count
  },

  createFormula(name) {
    const f = newFormula(name)
    set((s) => ({ formulas: [f, ...s.formulas] }))
    return f
  },

  updateFormula(id, updater, opts = { history: true }) {
    const s = get()
    const prev = s.formulas.find((f) => f.id === id)
    if (!prev) return
    const next = { ...updater(prev), updatedAt: now() }
    const history = { ...s.history }
    if (opts.history !== false) {
      const h = history[id] ?? { past: [], future: [] }
      history[id] = { past: [...h.past, prev].slice(-HISTORY_LIMIT), future: [] }
    }
    set({ formulas: s.formulas.map((f) => (f.id === id ? next : f)), history })
  },

  deleteFormula(id) {
    set((s) => {
      const history = { ...s.history }
      delete history[id]
      return { formulas: s.formulas.filter((f) => f.id !== id), history }
    })
  },

  duplicateFormula(id) {
    const src = get().formulas.find((f) => f.id === id)
    if (!src) return null
    const idMap = new Map<string, string>()
    const versions = src.versions.map((v) => {
      const nid = uid()
      idMap.set(v.id, nid)
      return { ...v, id: nid, rows: v.rows.map((r) => ({ ...r, id: uid() })) }
    })
    const copy: Formula = {
      ...src,
      id: uid(),
      name: `${src.name} (copy)`,
      versions,
      currentVersionId: idMap.get(src.currentVersionId) ?? versions[0].id,
      notes: src.notes.map((n) => ({ ...n, id: uid(), versionId: idMap.get(n.versionId) ?? n.versionId })),
      status: 'draft',
      createdAt: now(),
      updatedAt: now()
    }
    set((s) => ({ formulas: [copy, ...s.formulas] }))
    return copy
  },

  undo(id) {
    const s = get()
    const h = s.history[id]
    const cur = s.formulas.find((f) => f.id === id)
    if (!h || !h.past.length || !cur) return
    const prev = h.past[h.past.length - 1]
    set({
      formulas: s.formulas.map((f) => (f.id === id ? prev : f)),
      history: { ...s.history, [id]: { past: h.past.slice(0, -1), future: [cur, ...h.future] } }
    })
  },

  redo(id) {
    const s = get()
    const h = s.history[id]
    const cur = s.formulas.find((f) => f.id === id)
    if (!h || !h.future.length || !cur) return
    const next = h.future[0]
    set({
      formulas: s.formulas.map((f) => (f.id === id ? next : f)),
      history: { ...s.history, [id]: { past: [...h.past, cur], future: h.future.slice(1) } }
    })
  },

  updateSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
  },

  replaceAll(data) {
    set({
      // Backups from older versions also receive the newer starter materials.
      materials: Array.isArray(data.materials) ? upgradeSeedLibrary(data.materials, data.settings?.seedVersion ?? 1) : get().materials,
      formulas: Array.isArray(data.formulas) ? data.formulas.map(normalizeFormula) : get().formulas,
      settings: { ...(data.settings ? normalizeSettings(data.settings) : get().settings), seedVersion: SEED_VERSION },
      history: {}
    })
  }
}))

// ---------- persistence: debounced write per collection ----------
const timers: Partial<Record<keyof AppData, ReturnType<typeof setTimeout>>> = {}
const pending: Partial<Record<keyof AppData, unknown>> = {}

/** Tiny store for the "saving / saved" indicator. */
export const useSaveState = create<{ saving: boolean; error: boolean }>(() => ({ saving: false, error: false }))
let inflight = 0

function schedule(key: keyof AppData, value: unknown) {
  useSaveState.setState({ saving: true })
  pending[key] = value
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => flush(key), 400)
}

function flush(key: keyof AppData) {
  if (!(key in pending)) return
  const value = pending[key]
  delete pending[key]
  clearTimeout(timers[key])
  inflight++
  window.vialintia
    .save(key, value)
    .then(() => useSaveState.setState({ error: false }))
    .catch((err) => {
      console.error('Save failed', err)
      useSaveState.setState({ error: true })
    })
    .finally(() => {
      inflight--
      if (inflight === 0 && Object.keys(pending).length === 0) setTimeout(() => useSaveState.setState({ saving: false }), 350)
    })
}

export function flushAll() {
  ;(['materials', 'formulas', 'settings'] as const).forEach(flush)
}

useStore.subscribe((s, prev) => {
  if (!s.ready || !prev.ready) return
  if (s.materials !== prev.materials) schedule('materials', s.materials)
  if (s.formulas !== prev.formulas) schedule('formulas', s.formulas)
  if (s.settings !== prev.settings) schedule('settings', s.settings)
})

window.addEventListener('beforeunload', flushAll)

// ---------- selectors / helpers ----------
export function useMaterialMap(): Map<string, Material> {
  const materials = useStore((s) => s.materials)
  return useMemoMap(materials)
}

let lastList: Material[] | null = null
let lastMap = new Map<string, Material>()
function useMemoMap(list: Material[]): Map<string, Material> {
  if (list !== lastList) {
    lastList = list
    lastMap = new Map(list.map((m) => [m.id, m]))
  }
  return lastMap
}

export function familyById(settings: Settings, id: string) {
  return settings.families.find((f) => f.id === id) ?? settings.families.find((f) => f.id === 'other')!
}
