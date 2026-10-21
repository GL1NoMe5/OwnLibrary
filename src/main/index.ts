import { app, BrowserWindow, protocol, dialog, ipcMain } from 'electron'
import { join, resolve } from 'node:path'
import { readFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { SanctuaryDatabase } from './db'
import { registerIpc } from './ipcHandlers'

app.setName("Cozy Reader's Sanctuary")
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sanctuary-scene',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
  {
    scheme: 'sanctuary-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])
if (process.env.SANCTUARY_DATA_DIR) app.setPath('userData', resolve(process.env.SANCTUARY_DATA_DIR))
let database: SanctuaryDatabase
let mainWindow: BrowserWindow | null = null
let closing = false
let closeRequested = false
const locked = app.requestSingleInstanceLock()
if (!locked) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })
  app
    .whenReady()
    .then(async () => {
      const userData = app.getPath('userData')
      const wasmPath = app.isPackaged
        ? join(
            app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'),
            'node_modules/sql.js/dist/sql-wasm.wasm',
          )
        : resolve('node_modules/sql.js/dist/sql-wasm.wasm')
      try {
        database = await SanctuaryDatabase.open(userData, { wasmPath })
      } catch (error) {
        const backup = join(userData, 'sanctuary.sqlite.bak')
        const answer = await dialog.showMessageBox({
          type: 'error',
          message: 'Не удалось открыть библиотеку',
          detail: String(error),
          buttons: existsSync(backup) ? ['Закрыть', 'Восстановить предыдущую копию'] : ['Закрыть'],
          defaultId: 0,
        })
        if (answer.response !== 1) {
          app.quit()
          return
        }
        await copyFile(
          join(userData, 'sanctuary.sqlite'),
          join(userData, `sanctuary.corrupt-${Date.now()}.sqlite`),
        )
        await copyFile(backup, join(userData, 'sanctuary.sqlite'))
        database = await SanctuaryDatabase.open(userData, { wasmPath })
      }
      protocol.handle('sanctuary-media', async (request) => {
        const url = new URL(request.url)
        const match = /^\/([0-9a-f-]{36})\.png$/i.exec(url.pathname)
        if (url.hostname !== 'media' || !match || !(await database.hasMedia(match[1])))
          return new Response('Not found', { status: 404 })
        try {
          return new Response(await readFile(join(userData, 'media', `${match[1]}.png`)), {
            headers: {
              'Content-Type': 'image/png',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'private, max-age=31536000',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        } catch {
          return new Response('Not found', { status: 404 })
        }
      })
      // Only these packaged assets can be read through this protocol.
      protocol.handle('sanctuary-scene', async (request) => {
        const url = new URL(request.url)
        const name = url.pathname.slice(1)
        if (
          request.method !== 'GET' ||
          url.hostname !== 'assets' ||
          !['sanctuary-room.glb', 'sanctuary-cat.glb'].includes(name)
        )
          return new Response('Not found', { status: 404 })
        const directory =
          process.env.ELECTRON_RENDERER_URL && !app.isPackaged
            ? resolve('src/renderer/public/room')
            : join(__dirname, '../renderer/room')
        try {
          return new Response(await readFile(join(directory, name)), {
            headers: {
              'Content-Type': 'model/gltf-binary',
              'Access-Control-Allow-Origin': '*',
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': 'no-cache',
            },
          })
        } catch {
          return new Response('Not found', { status: 404 })
        }
      })
      mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#f5f1e9',
        show: false,
        icon: join(__dirname, '../../resources/icon.ico'),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      })
      registerIpc(
        mainWindow,
        () => database,
        (value) => {
          database = value
        },
        wasmPath,
      )
      mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      mainWindow.webContents.on('will-navigate', (event, url) => {
        const current = mainWindow!.webContents.getURL()
        if (url !== current) event.preventDefault()
      })
      mainWindow.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      )
      mainWindow.once('ready-to-show', () => mainWindow?.show())
      mainWindow.on('close', (event) => {
        if (closing) return
        event.preventDefault()
        if (closeRequested) return
        closeRequested = true
        mainWindow!.webContents.send('window:beforeClose')
        setTimeout(() => {
          if (closeRequested && !closing) {
            closeRequested = false
            dialog
              .showMessageBox(mainWindow!, {
                type: 'warning',
                message: 'Приложение не ответило на запрос сохранения',
                detail:
                  'Можно подождать или закрыть окно. Изменения после последнего подтверждённого сохранения могут быть потеряны.',
                buttons: ['Подождать', 'Закрыть'],
                defaultId: 0,
              })
              .then(async (result) => {
                if (result.response === 1) {
                  await database.idle()
                  closing = true
                  mainWindow?.close()
                }
              })
          }
        }, 15000).unref()
      })
      ipcMain.on('window:closeReady', async (event, ok: boolean) => {
        if (event.sender !== mainWindow?.webContents || !closeRequested) return
        if (!ok) {
          closeRequested = false
          return
        }
        await database.idle()
        closing = true
        mainWindow.close()
      })
      if (process.env.ELECTRON_RENDERER_URL)
        await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
      else await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    })
    .catch((error) => {
      dialog.showErrorBox('Ошибка запуска', String(error))
      app.quit()
    })
  app.on('window-all-closed', () => {
    void database?.close()
    app.quit()
  })
}
