import type { AppData, StoreApi } from '@shared/types'
import { confirmDialog, withProgress } from '@/store/ui'

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

/** Save a file: iOS share sheet (→ Save to Files) when available, else a normal download. */
async function saveFile(file: File): Promise<string | null> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (isTouch() && nav.canShare?.({ files: [file] })) {
    try {
      // Files only — any title/text is saved by iOS as extra "Text" files next to the export.
      await nav.share({ files: [file] })
      return file.name
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return null
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return file.name
}

async function exportText(data: string, defaultName: string, ext: string): Promise<string | null> {
  const type = MIME[ext] ?? 'text/plain'
  const name = defaultName.toLowerCase().endsWith(`.${ext}`) ? defaultName : `${defaultName}.${ext}`
  return saveFile(new File([data], name, { type }))
}

function importText(ext: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // iOS greys out files whose type it cannot match, so stay permissive.
    const accept: Record<string, string> = { json: '.json,application/json', csv: '.csv,text/csv,text/comma-separated-values' }
    input.accept = [...ext.split(',').map((e) => accept[e.trim()] ?? `.${e.trim()}`), 'text/plain'].join(',')
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
 * Build a real PDF of the formula sheet (no print dialog — window.print() is unreliable in iOS
 * Home Screen apps): render the sheet HTML in an off-screen A4-wide frame, rasterise it with
 * html2canvas and lay it out on A4 pages with jsPDF. Shows the progress bar while working.
 */
async function printPdf(html: string, defaultName: string): Promise<string | null> {
  const name = defaultName.toLowerCase().endsWith('.pdf') ? defaultName : `${defaultName}.pdf`
  const file = await withProgress('Exporting PDF', async (step) => {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    step(0.15)
    const A4_PX = 794 // 210 mm at 96 dpi
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_PX}px;height:40px;border:0;background:#fff`
    document.body.appendChild(frame)
    try {
      const doc = frame.contentDocument!
      doc.open()
      doc.write(html.replace('</head>', '<style>html,body{background:#fff}body{padding:48px}</style></head>'))
      doc.close()
      await new Promise((r) => setTimeout(r, 120))
      step(0.3)
      // capture only the sheet's own height (the frame is kept short so nothing pads it out)
      const height = Math.ceil(doc.body.scrollHeight)
      const canvas = await html2canvas(doc.body, { scale: 2, backgroundColor: '#ffffff', windowWidth: A4_PX, windowHeight: height, height, useCORS: false, logging: false })
      step(0.75)
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const pxPerPt = canvas.width / pageW
      const slicePx = Math.floor(pageH * pxPerPt)
      for (let y = 0, page = 0; y < canvas.height; y += slicePx, page++) {
        const h = Math.min(slicePx, canvas.height - y)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = h
        slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
        if (page > 0) pdf.addPage()
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, h / pxPerPt)
        step(0.75 + 0.2 * Math.min(1, (y + h) / canvas.height))
      }
      return new File([pdf.output('blob')], name, { type: 'application/pdf' })
    } finally {
      frame.remove()
    }
  })
  // Sharing needs a fresh tap on iOS — ask for it once the file is ready.
  if (isTouch() && !(await confirmDialog('PDF ready', name, 'Save PDF'))) return null
  return saveFile(file)
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
