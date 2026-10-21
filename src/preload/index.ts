import { contextBridge, ipcRenderer } from 'electron'
import type { SanctuaryAPI } from '../shared/types'

const api: SanctuaryAPI = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  listBooks: () => ipcRenderer.invoke('books:list'),
  createBook: (input) => ipcRenderer.invoke('books:create', input),
  updateBook: (id, input) => ipcRenderer.invoke('books:update', id, input),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  removeDemo: () => ipcRenderer.invoke('books:removeDemo'),
  searchBooks: (query) => ipcRenderer.invoke('books:searchOnline', query),
  resolveEdition: (result) => ipcRenderer.invoke('books:resolveEdition', result),
  getSpreads: (id) => ipcRenderer.invoke('spreads:get', id),
  saveSpread: (spread) => ipcRenderer.invoke('spreads:save', spread),
  addSpread: (id) => ipcRenderer.invoke('spreads:add', id),
  getQuotes: () => ipcRenderer.invoke('quotes:list'),
  importImage: () => ipcRenderer.invoke('media:upload'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  savePng: (dataUrl) => ipcRenderer.invoke('export:savePng', dataUrl),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onBeforeClose: (callback) => {
    const handler = async () => {
      let ok = false
      try {
        ok = await callback()
      } finally {
        ipcRenderer.send('window:closeReady', ok)
      }
    }
    ipcRenderer.on('window:beforeClose', handler)
    return () => {
      ipcRenderer.removeListener('window:beforeClose', handler)
    }
  },
}
contextBridge.exposeInMainWorld('sanctuaryAPI', api)
