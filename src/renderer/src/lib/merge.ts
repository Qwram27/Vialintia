import type { Formula, Material } from '@shared/types'

export interface ImportPayload {
  materials?: Material[] // full material import (replaces matching local records)
  refMaterials?: Material[] // materials referenced by an imported formulas file (only added when not found)
  formulas?: Formula[]
}

export interface MergeStats {
  formulasAdded: number
  formulasUpdated: number
  formulasKept: number // local copy was newer
  materialsAdded: number
  materialsUpdated: number
  remapped: number // formula rows pointed from a foreign id to a local material
  missing: number // rows still pointing at an unknown material
}

const key = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Merge an import into the local library instead of replacing it.
 * Materials are matched by id, then alias, then name, then CAS — the same starter material has a
 * different id on every device. Matched foreign ids are stored as aliases and every formula row
 * (local and imported) is re-pointed to the local material, so nothing shows up as "missing".
 * Formulas are matched by id; the newer copy (updatedAt) wins, new ones are added.
 */
export function mergeImport(local: { materials: Material[]; formulas: Formula[] }, data: ImportPayload): { materials: Material[]; formulas: Formula[]; stats: MergeStats } {
  const stats: MergeStats = { formulasAdded: 0, formulasUpdated: 0, formulasKept: 0, materialsAdded: 0, materialsUpdated: 0, remapped: 0, missing: 0 }
  const materials = local.materials.map((m) => ({ ...m }))
  const byId = new Map(materials.map((m) => [m.id, m]))
  const alias = new Map<string, string>() // foreign id -> local id
  for (const m of materials) for (const a of m.aliasIds ?? []) alias.set(a, m.id)

  const find = (m: Material): Material | undefined => {
    const direct = byId.get(m.id) ?? byId.get(alias.get(m.id) ?? '')
    if (direct) return direct
    const n = key(m.name)
    const byName = n ? materials.find((x) => key(x.name) === n) : undefined
    if (byName) return byName
    const cas = key(m.cas)
    return cas ? materials.find((x) => key(x.cas) === cas) : undefined
  }
  const link = (foreignId: string, target: Material) => {
    if (foreignId === target.id) return
    alias.set(foreignId, target.id)
    target.aliasIds = [...new Set([...(target.aliasIds ?? []), foreignId])]
  }
  const addNew = (m: Material) => {
    const copy = { ...m }
    if (byId.has(copy.id)) copy.id = `${copy.id}-${Math.random().toString(36).slice(2, 8)}`
    materials.push(copy)
    byId.set(copy.id, copy)
    if (copy.id !== m.id) link(m.id, copy)
    stats.materialsAdded++
  }

  for (const m of data.materials ?? []) {
    const hit = find(m)
    if (hit) {
      const { id: _foreign, aliasIds: _a, ...fields } = m
      Object.assign(hit, fields, { aliasIds: hit.aliasIds })
      link(m.id, hit)
      stats.materialsUpdated++
    } else addNew(m)
  }
  for (const m of data.refMaterials ?? []) {
    const hit = find(m)
    if (hit) link(m.id, hit)
    else addNew(m)
  }

  const fix = (f: Formula): Formula => ({
    ...f,
    versions: f.versions.map((v) => ({
      ...v,
      rows: v.rows.map((r) => {
        if (byId.has(r.materialId)) return r
        const to = alias.get(r.materialId)
        if (to) {
          stats.remapped++
          return { ...r, materialId: to }
        }
        stats.missing++
        return r
      })
    }))
  })

  const formulas = local.formulas.map(fix)
  const fIndex = new Map(formulas.map((f, i) => [f.id, i]))
  for (const raw of data.formulas ?? []) {
    const f = fix(raw)
    const i = fIndex.get(f.id)
    if (i == null) {
      fIndex.set(f.id, formulas.length)
      formulas.push(f)
      stats.formulasAdded++
    } else if ((f.updatedAt ?? '') >= (formulas[i].updatedAt ?? '')) {
      formulas[i] = f
      stats.formulasUpdated++
    } else stats.formulasKept++
  }
  return { materials, formulas, stats }
}
