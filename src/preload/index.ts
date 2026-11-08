import { contextBridge, ipcRenderer } from 'electron'
import type { StoreApi } from '../shared/types'

const api: StoreApi = {
  load: () => ipcRenderer.invoke('store:load'),
  save: (key, data) => ipcRenderer.invoke('store:save', key, data),
  exportJson: (data, defaultName) => ipcRenderer.invoke('file:exportText', data, defaultName, 'json'),
  importJson: () => ipcRenderer.invoke('file:importText', 'json'),
  exportText: (data, defaultName, ext) => ipcRenderer.invoke('file:exportText', data, defaultName, ext),
  importText: (ext) => ipcRenderer.invoke('file:importText', ext),
  printPdf: (html, defaultName) => ipcRenderer.invoke('file:printPdf', html, defaultName),
  openDataFolder: () => ipcRenderer.invoke('store:openDataFolder'),
  dataPath: () => ipcRenderer.invoke('store:dataPath')
}

contextBridge.exposeInMainWorld('vialintia', api)
