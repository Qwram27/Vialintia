import { app } from 'electron'
import { promises as fs, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'fs'
import { join } from 'path'

const KEYS = ['materials', 'formulas', 'settings'] as const
type Key = (typeof KEYS)[number]

export function dataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function fileFor(key: Key): string {
  return join(dataDir(), `${key}.json`)
}

export async function loadAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const key of KEYS) {
    const file = fileFor(key)
    if (!existsSync(file)) continue
    try {
      out[key] = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch (err) {
      // Corrupt file: keep a copy aside and fall back to defaults for this key.
      console.error(`Failed to read ${file}`, err)
      try {
        copyFileSync(file, `${file}.corrupt-${Date.now()}`)
      } catch {
        /* ignore */
      }
    }
  }
  return out
}

// Serialise writes per key so a slow write can never overwrite a newer one.
const queues = new Map<Key, Promise<void>>()

export function saveKey(key: string, data: unknown): Promise<void> {
  if (!KEYS.includes(key as Key)) return Promise.reject(new Error(`Unknown key ${key}`))
  const k = key as Key
  const json = JSON.stringify(data, null, 2)
  const prev = queues.get(k) ?? Promise.resolve()
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const file = fileFor(k)
      const tmp = `${file}.tmp`
      await fs.writeFile(tmp, json, 'utf8')
      await fs.rename(tmp, file)
    })
  queues.set(k, next)
  return next
}

/** Snapshot existing data at start-up, keeping the newest `keep` snapshots. */
export function backupOnStartup(keep = 10): void {
  const dir = dataDir()
  const existing = KEYS.map(fileFor).filter((f) => existsSync(f))
  if (existing.length === 0) return
  const backupsRoot = join(app.getPath('userData'), 'backups')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const target = join(backupsRoot, stamp)
  mkdirSync(target, { recursive: true })
  for (const f of existing) copyFileSync(f, join(target, f.slice(dir.length + 1)))
  const all = readdirSync(backupsRoot).sort()
  for (const old of all.slice(0, Math.max(0, all.length - keep))) {
    rmSync(join(backupsRoot, old), { recursive: true, force: true })
  }
}
