import type { AppData, StoreApi } from '@shared/types'

/**
 * Browser implementation of the Electron preload API (used by the iPhone / PWA build).
 * Data lives in IndexedDB; files go through downloads / the iOS share sheet and <input type=file>.
 */

const DB_NAME = 'vialintia'
const STORE = 'data'
const KEYS = ['materials', 'formulas', 'settings'] as const

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    dbPromise.catch(() => (dbPromise = null))
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(req ? req.result : undefined)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

// localStorage fallback (e.g. IndexedDB blocked) — keeps the app usable.
const LS = (k: string) => `vialintia:${k}`

async function load(): Promise<Partial<AppData>> {
  const out: Record<string, unknown> = {}
  try {
    for (const k of KEYS) {
      const v = await tx<unknown>('readonly', (s) => s.get(k))
      if (v !== undefined) out[k] = v
    }
  } catch (err) {
    console.error('IndexedDB unavailable, using localStorage', err)
    for (const k of KEYS) {
      const raw = localStorage.getItem(LS(k))
      if (raw) {
        try {
          out[k] = JSON.parse(raw)
        } catch {
          /* ignore */
        }
      }
    }
  }
  // Ask the browser not to evict our data (no prompt on iOS / Chrome).
  navigator.storage?.persist?.().catch(() => undefined)
  return out as Partial<AppData>
}

async function save(key: keyof AppData, data: unknown): Promise<void> {
  if (!KEYS.includes(key)) throw new Error(`Unknown key ${key}`)
  // Structured clone of plain JSON keeps IndexedDB free of proxies / class instances.
  const value = JSON.parse(JSON.stringify(data))
  try {
    await tx('readwrite', (s) => s.put(value, key))
  } catch (err) {
    console.error('IndexedDB save failed, using localStorage', err)
    localStorage.setItem(LS(key), JSON.stringify(value))
  }
}

const MIME: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
  txt: 'text/plain'
}

const isTouch = () => matchMedia('(pointer: coarse)').matches

/** Save a text file: iOS share sheet (→ Save to Files) when available, else a normal download. */
async function exportText(data: string, defaultName: string, ext: string): Promise<string | null> {
  const type = MIME[ext] ?? 'text/plain'
  const name = defaultName.toLowerCase().endsWith(`.${ext}`) ? defaultName : `${defaultName}.${ext}`
  const file = new File([data], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (isTouch() && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name })
      return name
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return null
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
}

function importText(ext: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // iOS greys out files whose type it cannot match, so stay permissive.
    input.accept = ext === 'json' ? '.json,application/json,text/plain' : '.csv,text/csv,text/plain,text/comma-separated-values'
    input.style.display = 'none'
    let done = false
    const finish = (v: string | null) => {
      if (done) return
      done = true
      input.remove()
      resolve(v)
    }
    input.addEventListener('change', () => {
      const f = input.files?.[0]
      if (!f) return finish(null)
      f.text().then(finish, () => finish(null))
    })
    input.addEventListener('cancel', () => finish(null))
    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Print the formula sheet. The sheet is mounted in the current document and only shown in print
 * (iOS prints the whole page, popups are unreliable in Home Screen apps). On iPhone the print sheet
 * offers Share → Save to Files as PDF.
 */
function printPdf(html: string, defaultName: string): Promise<string | null> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const css = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    // scope the sheet's own body rules to the print root
    .replace(/(^|[\s,}])body\s*\{/g, '$1#print-root {')
  document.getElementById('print-root')?.remove()
  document.getElementById('print-style')?.remove()
  const style = document.createElement('style')
  style.id = 'print-style'
  style.textContent = `@media print { ${css} }`
  const root = document.createElement('div')
  root.id = 'print-root'
  root.innerHTML = doc.body.innerHTML
  document.head.appendChild(style)
  document.body.appendChild(root)
  const prevTitle = document.title
  document.title = defaultName.replace(/\.pdf$/i, '')
  const cleanup = () => {
    document.title = prevTitle
    root.remove()
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  return new Promise((resolve) => {
    // let layout settle before opening the print sheet
    setTimeout(() => {
      window.print()
      // If afterprint never fires (some iOS versions), the sheet stays mounted but hidden on
      // screen and is replaced by the next print.
      resolve(null)
    }, 60)
  })
}

export function createWebApi(): StoreApi {
  return {
    load,
    save,
    exportJson: (data, name) => exportText(data, name, 'json'),
    importJson: () => importText('json'),
    exportText,
    importText,
    printPdf,
    openDataFolder: async () => undefined,
    dataPath: async () => 'This device · browser storage (IndexedDB)'
  }
}
