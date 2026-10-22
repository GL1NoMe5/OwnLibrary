import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { SanctuaryDatabase } from '../../src/main/db'
import { exportBackup, importBackup } from '../../src/main/backup'
import { defaultSettings, type InterfaceTheme } from '../../src/shared/types'

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
  const path = directory ?? (await mkdtemp(join(tmpdir(), 'sanctuary-theme-')))
  if (!directory) directories.push(path)
  const db = await SanctuaryDatabase.open(path, { seed: false, wasmPath, bytes })
  connections.push(db)
  return db
}

async function archiveAndRestore(db: SanctuaryDatabase) {
  const archivePath = join(db.directory, 'themes.sanctuary.zip')
  dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath: archivePath })
  expect(await exportBackup(db, {} as never)).toBe(true)
  const target = await open()
  await target.saveSettings({ ...defaultSettings(), interfaceTheme: 'dark' })
  dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] })
  dialogs.showMessageBox.mockResolvedValue({ response: 1 })
  const restored = await importBackup(target, {} as never, wasmPath)
  if (!restored) throw new Error('Backup did not restore')
  connections.push(restored)
  return restored
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

describe('Interface theme persistence', () => {
  it('opens old SQLite settings and backups in light mode while preserving goals, room and journal positions', async () => {
    const db = await open()
    const expected = {
      ...defaultSettings(),
      goals: { '2026-10': 8 },
      journalPositions: { [crypto.randomUUID()]: crypto.randomUUID() },
      room: { ...defaultSettings().room, volume: 0.17, rain: true, reducedMotion: true },
    }
    const { interfaceTheme, ...legacySettings } = expected
    expect(interfaceTheme).toBe('light')
    const sql = await initSqlJs({ locateFile: () => wasmPath })
    const oldSnapshot = new sql.Database(await db.exportBytes())
    oldSnapshot.run('UPDATE settings SET json=? WHERE id=1', [JSON.stringify(legacySettings)])
    const legacyBytes = oldSnapshot.export()
    oldSnapshot.close()
    const legacyDb = await open(undefined, legacyBytes)
    expect(await legacyDb.settings()).toEqual(expected)
    expect(await (await archiveAndRestore(legacyDb)).settings()).toEqual(expected)
  })

  it('persists all three selected themes after reopening and restores the chosen theme from a ZIP', async () => {
    const db = await open()
    const settings = {
      ...defaultSettings(),
      goals: { '2026-11': 5 },
      room: { ...defaultSettings().room, sound: true, reducedMotion: true },
    }
    const themes: InterfaceTheme[] = ['light', 'dark', 'christmas']
    for (const interfaceTheme of themes) {
      const expected = { ...settings, interfaceTheme }
      expect(await db.saveSettings(expected)).toEqual(expected)
      expect(await (await open(db.directory)).settings()).toEqual(expected)
    }
    expect(await (await archiveAndRestore(db)).settings()).toEqual({
      ...settings,
      interfaceTheme: 'christmas',
    })
  })
})
