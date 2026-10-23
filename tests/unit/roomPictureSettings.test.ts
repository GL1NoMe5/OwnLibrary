import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { SanctuaryDatabase } from '../../src/main/db'
import { exportBackup, importBackup } from '../../src/main/backup'
import { defaultSettings } from '../../src/shared/types'
import { settingsSchema } from '../../src/shared/validation'

const dialogs = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
}))
vi.mock('electron', () => ({ dialog: dialogs }))

const directories: string[] = []
const connections: SanctuaryDatabase[] = []
const wasmPath = resolve('node_modules/sql.js/dist/sql-wasm.wasm')

async function open(directory?: string, bytes?: Uint8Array) {
  const path = directory ?? (await mkdtemp(join(tmpdir(), 'sanctuary-picture-')))
  if (!directory) directories.push(path)
  const db = await SanctuaryDatabase.open(path, { seed: false, wasmPath, bytes })
  connections.push(db)
  return db
}

afterEach(async () => {
  for (const db of connections.splice(0)) {
    try {
      await db.close()
    } catch {}
  }
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe('Room picture settings', () => {
  it('opens a legacy SQLite snapshot with the original picture and rejects external image paths', async () => {
    const db = await open()
    const expected = {
      ...defaultSettings(),
      interfaceTheme: 'dark' as const,
      goals: { '2026-10': 8 },
      room: { ...defaultSettings().room, volume: 0.17, rain: true },
    }
    const { pictureUrl: omitted, ...legacyRoom } = expected.room
    expect(omitted).toBeNull()
    const sql = await initSqlJs({ locateFile: () => wasmPath })
    const snapshot = new sql.Database(await db.exportBytes())
    snapshot.run('UPDATE settings SET json=? WHERE id=1', [
      JSON.stringify({ ...expected, room: legacyRoom }),
    ])
    const bytes = snapshot.export()
    snapshot.close()
    expect(await (await open(undefined, bytes)).settings()).toEqual(expected)
    for (const pictureUrl of ['https://example.com/photo.png', 'file:///C:/photo.png']) {
      expect(
        settingsSchema.safeParse({ ...expected, room: { ...expected.room, pictureUrl } }).success,
      ).toBe(false)
    }
  })

  it('keeps an imported photo after reopening and archive transfer, and persists restoring the original picture', async () => {
    const db = await open()
    const id = crypto.randomUUID()
    const fileName = `${id}.png`
    const pictureUrl = `sanctuary-media://media/${fileName}`
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=',
      'base64',
    )
    await mkdir(join(db.directory, 'media'), { recursive: true })
    await writeFile(join(db.directory, 'media', fileName), image)
    await db.registerMedia(id)
    const expected = {
      ...defaultSettings(),
      room: { ...defaultSettings().room, pictureUrl },
    }
    await db.saveSettings(expected)
    expect(await (await open(db.directory)).settings()).toEqual(expected)

    const archivePath = join(db.directory, 'picture.sanctuary.zip')
    dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath: archivePath })
    expect(await exportBackup(db, {} as never)).toBe(true)
    const target = await open()
    dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] })
    dialogs.showMessageBox.mockResolvedValue({ response: 1 })
    const restored = await importBackup(target, {} as never, wasmPath)
    if (!restored) throw new Error('Backup did not restore')
    connections.push(restored)
    expect(await restored.settings()).toEqual(expected)
    expect(await readFile(join(restored.directory, 'media', fileName))).toEqual(image)

    await restored.saveSettings({ ...expected, room: { ...expected.room, pictureUrl: null } })
    expect((await (await open(restored.directory)).settings()).room.pictureUrl).toBeNull()
  })
})
