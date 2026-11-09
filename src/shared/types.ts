export type NoteLevel = 'top' | 'heart' | 'base'
export type MaterialType = 'natural' | 'synthetic' | 'base' | 'other'
export type AmountUnit = 'g' | 'drops' | 'parts'
export type FormulaStatus = 'testing' | 'final'
export type ProductType = 'parfum' | 'edp' | 'edt' | 'edc' | 'custom'

export interface Material {
  id: string
  name: string
  cas?: string
  family: string // Family id
  note: NoteLevel
  tenacityHours?: number | null // approximate life on blotter
  defaultDilution: number // % of material in the stock solution (100 = neat)
  solvent?: string
  pricePerKg?: number | null // price of neat material
  supplier?: string
  ifraLimit?: number | null // max % in finished product (IFRA Cat. 4)
  description?: string
  type: MaterialType
  accordFormulaId?: string // set when this material is an accord built from a formula
  aliasIds?: string[] // ids the same material had on another device (resolved on import)
  createdAt: string
  updatedAt: string
}

export interface FormulaRow {
  id: string
  materialId: string
  amount: number // in the formula's unit
  dilution: number // % of material in what is weighed (100 = neat)
  solvent?: string
  /** A divider starts above this row (e.g. an accord or a layer); the label may be empty. */
  section?: string
}

export interface FormulaVersion {
  id: string
  label: string
  createdAt: string
  comment?: string
  rows: FormulaRow[]
}

export type TestStage = 'blotter' | 'skin' | 'fabric'
export type TestPhase = 'opening' | 'heart' | 'drydown'

export interface TestNote {
  id: string
  date: string
  versionId: string
  stage: TestStage
  phase: TestPhase
  rating: number // 0..5
  text: string
}

export interface Batch {
  mode: 'bottles' | 'mass'
  bottles: number
  bottleMl: number
  massG: number // target concentrate mass when mode = 'mass'
}

export interface Formula {
  id: string
  name: string
  description: string
  tags: string[]
  status: FormulaStatus
  unit: AmountUnit
  productType: ProductType
  concentration: number // % of concentrate in finished product
  batch: Batch
  macerationStart?: string
  versions: FormulaVersion[]
  currentVersionId: string
  notes: TestNote[]
  assemblies?: Assembly[] // weighing sessions; the last one without finishedAt is in progress
  createdAt: string
  updatedAt: string
}

export interface AssemblyRow {
  rowId: string
  materialId: string
  dilution: number
  target: number // g to weigh (already rounded to the balance step)
  actual: number | null // g actually weighed
}

export interface Assembly {
  id: string
  versionId: string
  startedAt: string
  finishedAt?: string
  concentrateG: number // target concentrate mass
  alcoholG: number // target alcohol mass
  alcoholActual: number | null
  rows: AssemblyRow[]
  note?: string
}

export interface Family {
  id: string
  name: string
  color: string
  builtin: boolean
}

export interface Settings {
  dropMassG: number
  productDensity: number // g/ml of finished perfume
  ethanolDensity: number // g/ml
  alcoholPricePerL: number
  currency: string
  nearLimitRatio: number // 0..1, warn when usage >= ratio * limit
  noteColors: Record<NoteLevel, string>
  families: Family[]
  solvents: string[]
  prefsVersion?: number // settings migrations already applied
  balanceStep: number // resolution of the user's scale in g (0.1 / 0.01 / 0.001)
  seedVersion?: number // starter-library version already merged into this library
}

export interface AppData {
  materials: Material[]
  formulas: Formula[]
  settings: Settings
}

export interface StoreApi {
  load(): Promise<Partial<AppData>>
  save(key: keyof AppData, data: unknown): Promise<void>
  exportJson(data: string, defaultName: string): Promise<string | null>
  importJson(): Promise<string | null>
  exportText(data: string, defaultName: string, ext: string): Promise<string | null>
  importText(ext: string): Promise<string | null>
  printPdf(html: string, defaultName: string): Promise<string | null>
  openDataFolder(): Promise<void>
  dataPath(): Promise<string>
}
