import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SanctuaryDatabase } from '../../src/main/db'
import { exportBackup, importBackup } from '../../src/main/backup'
import { spreadSchema } from '../../src/shared/validation'
import type { BookInput, ScrapbookItem } from '../../src/shared/types'

const dialogs = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
}))
vi.mock('electron', () => ({ dialog: dialogs }))

const directories: string[] = []
const connections: SanctuaryDatabase[] = []
const bookInput: BookInput = {
  title: 'Мой бумажный дневник',
  author: 'Читатель',
  status: 'READ',
  rating: 4.5,
  pages: 240,
  spineColor: '#69745c',
  coverColor: '#69745c',
  goldFoil: false,
  coverUrl: null,
  cabinet: 0,
  shelf: 0,
  finishedAt: '2026-10-22',
  favoriteQuote: '',
}
function item(overrides: Partial<ScrapbookItem> = {}): ScrapbookItem {
  return {
    id: crypto.randomUUID(),
    type: 'polaroid',
    side: 'left',
    x: 70,
    y: 90,
    width: 240,
    height: 300,
    rotation: -4,
    zIndex: 1,
    content: './illustrations/garden.svg',
    caption: 'Тихий вечер',
    bg: '#ffffff',
    fontFamily: 'Caveat',
    fontSize: 25,
    tapeStyle: 'botanical',
    ...overrides,
  }
}
async function open(directory?: string) {
  const path = directory ?? (await mkdtemp(join(tmpdir(), 'sanctuary-collage-')))
  if (!directory) directories.push(path)
  const db = await SanctuaryDatabase.open(path, { seed: false })
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

describe('Journal collage persistence', () => {
  it('opens and saves legacy photographs without adding or losing their existing settings', async () => {
    const db = await open()
    const book = await db.createBook(bookInput)
    const [spread] = await db.spreads(book.id)
    const oldPhoto = item()
    spread.items = [oldPhoto]
    expect(spreadSchema.parse(spread).items).toEqual([oldPhoto])
    const saved = await db.saveSpread(spread)
    const reopened = await open(db.directory)
    expect((await reopened.spreads(book.id))[0]).toEqual(saved)
    expect(saved.items[0]).not.toHaveProperty('imageShape')
    expect(saved.items[0]).not.toHaveProperty('imageCrop')
  })

  it('preserves cropped photographs, transparent decals and paper through reopening and a complete ZIP restore', async () => {
    const db = await open()
    const book = await db.createBook(bookInput)
    const [spread] = await db.spreads(book.id)
    const mediaId = crypto.randomUUID()
    const mediaFile = `${mediaId}.png`
    const mediaUrl = `sanctuary-media://media/${mediaFile}`
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAaX2RaAAAAAASUVORK5CYII=',
      'base64',
    )
    await mkdir(join(db.directory, 'media'))
    await writeFile(join(db.directory, 'media', mediaFile), transparentPng)
    await db.registerMedia(mediaId)
    spread.items = [
      item({
        content: mediaUrl,
        imageShape: 'oval',
        imageFrame: 'paper',
        imageCrop: { x: 0.18, y: 0.77, zoom: 2.4 },
        textColor: '#51332e',
      }),
      item({ type: 'decal', content: mediaUrl, side: 'right', zIndex: 3, rotation: 18 }),
      item({
        type: 'paper',
        content: '',
        bg: '#c7b28e',
        imageShape: 'torn',
        paperTexture: 'print',
        textColor: '#735b47',
        zIndex: 0,
      }),
    ]
    const saved = await db.saveSpread(spread)
    const reopened = await open(db.directory)
    expect((await reopened.spreads(book.id))[0]).toEqual(saved)
    const archivePath = join(db.directory, 'collage.sanctuary.zip')
    dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath: archivePath })
    expect(await exportBackup(reopened, {} as never)).toBe(true)

    const target = await open()
    await target.createBook({ ...bookInput, title: 'Будет заменено из архива' })
    dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] })
    dialogs.showMessageBox.mockResolvedValue({ response: 1 })
    const restored = await importBackup(
      target,
      {} as never,
      resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
    )
    expect(restored).not.toBeNull()
    if (!restored) throw new Error('Backup did not restore')
    connections.push(restored)
    expect((await restored.books()).map((value) => value.id)).toEqual([book.id])
    expect((await restored.spreads(book.id))[0]).toEqual(saved)
    expect(await restored.mediaFiles()).toEqual([mediaFile])
    expect(await readFile(join(restored.directory, 'media', mediaFile))).toEqual(transparentPng)
  })
})
