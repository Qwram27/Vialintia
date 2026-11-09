import type { Family, NoteLevel, ProductType, Settings } from './types'

// Archive palette: monochrome structure + muted cool tones. No yellows, oranges or reds.
export const DEFAULT_NOTE_COLORS: Record<NoteLevel, string> = {
  top: '#ededed',
  heart: '#9b9b9b',
  base: '#5c5c5c'
}

export const DEFAULT_FAMILIES: Family[] = [
  { id: 'citrus', name: 'Citrus', color: '#dfe8ee', builtin: true },
  { id: 'green', name: 'Green', color: '#93ab9f', builtin: true },
  { id: 'herbal', name: 'Herbal', color: '#b4c2ba', builtin: true },
  { id: 'aromatic', name: 'Aromatic', color: '#7f9e98', builtin: true },
  { id: 'aquatic', name: 'Aquatic', color: '#7ea3c2', builtin: true },
  { id: 'aldehydic', name: 'Aldehydic', color: '#f5f5f5', builtin: true },
  { id: 'fruity', name: 'Fruity', color: '#c4a3c8', builtin: true },
  { id: 'floral', name: 'Floral', color: '#a99fd6', builtin: true },
  { id: 'powdery', name: 'Powdery', color: '#d2cfe4', builtin: true },
  { id: 'spicy', name: 'Spicy', color: '#7480b4', builtin: true },
  { id: 'woody', name: 'Woody', color: '#767d79', builtin: true },
  { id: 'mossy', name: 'Mossy', color: '#56605a', builtin: true },
  { id: 'amber', name: 'Amber', color: '#8c7b9b', builtin: true },
  { id: 'gourmand', name: 'Gourmand', color: '#9ca8ba', builtin: true },
  { id: 'leather', name: 'Leather', color: '#4a4d55', builtin: true },
  { id: 'musk', name: 'Musk', color: '#c6c9ce', builtin: true },
  { id: 'other', name: 'Other', color: '#7a7a7a', builtin: true }
]

/** Defaults shipped by earlier versions — replaced by the current defaults on load. */
export const LEGACY_DEFAULT_COLORS = new Set([
  '#b4e2c8', '#7fa878', '#3f6f60', '#a8e6c8', '#6fae6a', '#97c78f', '#7cc2a6', '#4fb8c8', '#bfeef0',
  '#e48ad2', '#a98af0', '#d6dcf7', '#6a7fd4', '#5d7f62', '#4c6b4a', '#9b6fa3', '#7a9cc0', '#56656c',
  '#c2cbd6', '#7c8580', '#dbe8ee', '#d79ad6', '#c7a5e3', '#b3afd9'
])

// Swatches offered in the colour picker: greys + muted cool tones.
export const COOL_SWATCHES = [
  '#ffffff', '#ededed', '#d4d4d4', '#b5b5b5', '#9b9b9b', '#7a7a7a', '#5c5c5c', '#3f3f3f',
  '#dfe8ee', '#b8cad8', '#7ea3c2', '#5a7a99', '#9ca8ba', '#7480b4', '#4a4d55', '#2f3440',
  '#b4c2ba', '#93ab9f', '#7f9e98', '#56605a', '#d2cfe4', '#a99fd6', '#8c7b9b', '#c4a3c8',
  '#6f5f84', '#c6c9ce', '#767d79', '#a6b3b0'
]

export const PRODUCT_PRESETS: Record<Exclude<ProductType, 'custom'>, { label: string; concentration: number }> = {
  parfum: { label: 'Extrait / Parfum', concentration: 25 },
  edp: { label: 'Eau de Parfum', concentration: 18 },
  edt: { label: 'Eau de Toilette', concentration: 12 },
  edc: { label: 'Eau de Cologne', concentration: 5 }
}

export const DEFAULT_SETTINGS: Settings = {
  dropMassG: 0.02,
  productDensity: 0.82,
  ethanolDensity: 0.79,
  alcoholPricePerL: 0,
  currency: '€',
  nearLimitRatio: 0.9,
  noteColors: { ...DEFAULT_NOTE_COLORS },
  families: DEFAULT_FAMILIES.map((f) => ({ ...f })),
  solvents: ['EtOH', 'DPG', 'IPM', 'TEC', 'BB', 'DEP']
}

export const NOTE_LABELS: Record<NoteLevel, string> = { top: 'Top', heart: 'Heart', base: 'Base' }
export const NOTE_ORDER: NoteLevel[] = ['top', 'heart', 'base']
