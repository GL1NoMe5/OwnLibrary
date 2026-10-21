import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import type { SanctuaryDatabase } from './db'
import { idSchema, bookInputSchema, spreadSchema, settingsSchema } from '../shared/validation'
import { searchBooks, resolveEdition } from './openLibrary'
import { storeImage } from './media'
import { exportBackup, importBackup } from './backup'

export function registerIpc(
  window: BrowserWindow,
  getDb: () => SanctuaryDatabase,
  replaceDb: (db: SanctuaryDatabase) => void,
  wasmPath: string,
): void {
  const handle = (name: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(name, async (event, ...args) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
        throw new Error('Недопустимый источник запроса')
      try {
        return await fn(...args)
      } catch (error) {
        throw new Error(
          error instanceof z.ZodError
            ? 'Проверьте введённые данные'
            : error instanceof Error
              ? error.message
              : 'Не удалось выполнить действие',
        )
      }
    })
  handle('app:bootstrap', async () => ({
    books: await getDb().books(),
    settings: await getDb().settings(),
  }))
  handle('books:list', () => getDb().books())
  handle('books:create', (input) => getDb().createBook(bookInputSchema.parse(input)))
  handle('books:update', (id, input) =>
    getDb().updateBook(idSchema.parse(id), bookInputSchema.parse(input)),
  )
  handle('books:delete', (id) => getDb().deleteBook(idSchema.parse(id)))
  handle('books:removeDemo', () => getDb().removeDemo())
  handle('books:searchOnline', (query) =>
    searchBooks(z.string().trim().min(2).max(250).parse(query)),
  )
  handle('books:resolveEdition', (result) =>
    resolveEdition(
      z
        .object({
          key: z.string().regex(/^\/works\/OL\d+W$/),
          title: z.string().max(300),
          author: z.string().max(300),
          coverId: z.number().int().positive().nullable(),
          editionKey: z
            .string()
            .regex(/^OL\d+M$/)
            .nullable(),
        })
        .parse(result),
      getDb(),
    ),
  )
  handle('spreads:get', (id) => getDb().spreads(idSchema.parse(id)))
  handle('spreads:add', (id) => getDb().addSpread(idSchema.parse(id)))
  handle('spreads:save', (spread) => getDb().saveSpread(spreadSchema.parse(spread)))
  handle('quotes:list', () => getDb().quotes())
  handle('media:upload', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    return result.canceled ? null : storeImage(await readFile(result.filePaths[0]), getDb())
  })
  handle('settings:save', (settings) => getDb().saveSettings(settingsSchema.parse(settings)))
  handle('export:savePng', async (dataUrl: unknown) => {
    const data = z
      .string()
      .max(40_000_000)
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
      .parse(dataUrl)
    const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
    if (
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      bytes.readUInt32BE(16) !== 1080 ||
      bytes.readUInt32BE(20) !== 1920
    )
      throw new Error('Карточка должна быть PNG размером 1080×1920')
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'Моя тихая глава.png',
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, bytes)
    return true
  })
  handle('backup:export', () => exportBackup(getDb(), window))
  handle('backup:import', async () => {
    const replacement = await importBackup(getDb(), window, wasmPath)
    if (replacement) replaceDb(replacement)
    return !!replacement
  })
  for (const action of ['minimize', 'maximize', 'close'] as const)
    ipcMain.on(`window:${action}`, (event) => {
      if (event.sender !== window.webContents) return
      if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize()
      else window[action]()
    })
}
