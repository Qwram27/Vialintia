import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { backupOnStartup, dataDir, loadAll, saveKey } from './storage'

// Optional isolated data directory (used for testing / screenshots).
if (process.env.VIALINTIA_USER_DATA) app.setPath('userData', process.env.VIALINTIA_USER_DATA)

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#000000',
    title: 'Vialintia',
    autoHideMenuBar: true,
    // Content runs under the title bar; native window buttons float on top.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#000000', symbolColor: '#8a8a8a', height: 44 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: !process.env.VIALINTIA_CAPTURE
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (process.env.VIALINTIA_CAPTURE) mainWindow?.showInactive()
    else {
      mainWindow?.maximize()
      mainWindow?.show()
    }
  })

  // Open external links in the default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') mainWindow?.webContents.toggleDevTools()
    })
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  if (process.env.VIALINTIA_CAPTURE) runCapture(mainWindow, process.env.VIALINTIA_CAPTURE)
}

/** Dev helper: VIALINTIA_CAPTURE="outDir|#/route1|#/route2" saves screenshots and quits. */
function runCapture(win: BrowserWindow, spec: string): void {
  const [outDir, ...routes] = spec.split('|')
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    await wait(1500)
    let i = 0
    for (const route of routes.length ? routes : ['#/']) {
      if (route.startsWith('js:') || route.startsWith('file:')) {
        const code = route.startsWith('js:') ? route.slice(3) : await fs.readFile(route.slice(5), 'utf8')
        const res = await win.webContents.executeJavaScript(code)
        if (res !== undefined) console.log('[capture]', typeof res === 'string' ? res : JSON.stringify(res))
        await wait(700)
        continue
      }
      if (route === 'shot') await wait(300)
      else await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(route)}`)
      await wait(1400)
      const img = await win.webContents.capturePage()
      await fs.writeFile(join(outDir, `shot-${String(i++).padStart(2, '0')}.png`), img.toPNG())
    }
    app.quit()
  })
}

function registerIpc(): void {
  ipcMain.handle('store:load', () => loadAll())
  ipcMain.handle('store:save', (_e, key: string, data: unknown) => saveKey(key, data))
  ipcMain.handle('store:dataPath', () => dataDir())
  ipcMain.handle('store:openDataFolder', () => shell.openPath(dataDir()).then(() => undefined))

  ipcMain.handle('file:exportText', async (_e, data: string, defaultName: string, ext: string) => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (res.canceled || !res.filePath) return null
    await fs.writeFile(res.filePath, data, 'utf8')
    return res.filePath
  })

  ipcMain.handle('file:importText', async (_e, ext: string) => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    return fs.readFile(res.filePaths[0], 'utf8')
  })

  ipcMain.handle('file:printPdf', async (_e, html: string, defaultName: string) => {
    // Test hook (unpackaged only): write straight to a known path, no dialog.
    const testOut = !app.isPackaged ? process.env.VIALINTIA_PDF_OUT : undefined
    const res = testOut
      ? { canceled: false, filePath: testOut }
      : await dialog.showSaveDialog(mainWindow!, {
          defaultPath: defaultName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        })
    if (res.canceled || !res.filePath) return null
    const tmp = join(app.getPath('temp'), `vialintia-print-${Date.now()}.html`)
    await fs.writeFile(tmp, html, 'utf8')
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } })
    try {
      await win.loadFile(tmp)
      const pdf = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
      })
      await fs.writeFile(res.filePath, pdf)
    } finally {
      win.destroy()
      fs.unlink(tmp).catch(() => undefined)
    }
    if (!testOut) shell.openPath(res.filePath)
    return res.filePath
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  try {
    backupOnStartup()
  } catch (err) {
    console.error('Backup failed', err)
  }
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
