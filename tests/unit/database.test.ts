import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SanctuaryDatabase, atomicWrite } from '../../src/main/db'
import { emptySpread } from '../../src/main/seed'
import type { BookInput } from '../../src/shared/types'
const directories: string[] = []
const connections: SanctuaryDatabase[] = []
const input: BookInput = {
  title: 'Книга для тихого вечера',
  author: 'Читатель',
  status: 'READ',
  rating: 4.5,
  pages: 320,
  spineColor: '#69745c',
  coverColor: '#69745c',
  goldFoil: true,
  coverUrl: null,
  cabinet: 0,
  shelf: 0,
  finishedAt: '2026-10-21',
  favoriteQuote: 'Вернуться к любимым словам',
}
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'sanctuary-'))
  directories.push(path)
  return path
}
async function open(path: string, options: Parameters<typeof SanctuaryDatabase.open>[1] = {}) {
  const db = await SanctuaryDatabase.open(path, options)
  connections.push(db)
  return db
}
afterEach(async () => {
  for (const db of connections.splice(0))
    try {
      await db.close()
    } catch {}
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
})
describe('Durable library', () => {
  it('seeds once and does not resurrect deleted examples', async () => {
    const path = await directory()
    const db = await open(path)
    expect(await db.books()).toHaveLength(11)
    await db.removeDemo()
    expect(await db.books()).toHaveLength(0)
    const reopened = await open(path)
    expect(await reopened.books()).toHaveLength(0)
  })
  it('persists Cyrillic, strokes, settings and media after reopening', async () => {
    const path = await directory()
    const db = await open(path, { seed: false })
    const book = await db.createBook(input)
    const [spread] = await db.spreads(book.id)
    spread.items = [
      {
        id: crypto.randomUUID(),
        side: 'left',
        type: 'note',
        x: 40,
        y: 50,
        width: 250,
        height: 180,
        rotation: 3,
        zIndex: 1,
        content: 'Любимые слова',
        caption: '',
        bg: '#eef1df',
        fontFamily: 'Caveat',
        fontSize: 25,
        tapeStyle: 'stars',
      },
    ]
    spread.leftStrokes = [
      {
        id: crypto.randomUUID(),
        tool: 'eraser',
        color: '#69745c',
        size: 8,
        opacity: 1,
        points: [
          [1, 2],
          [30, 45],
        ],
      },
    ]
    await db.saveSpread(spread)
    const settings = await db.settings()
    settings.goals['2026-10'] = 8
    await db.saveSettings(settings)
    const media = crypto.randomUUID()
    await db.registerMedia(media)
    const reopened = await open(path)
    expect((await reopened.books())[0].title).toBe(input.title)
    expect((await reopened.spreads(book.id))[0].items[0].content).toBe('Любимые слова')
    expect((await reopened.settings()).goals['2026-10']).toBe(8)
    expect(await reopened.hasMedia(media)).toBe(true)
  })
  it('serializes concurrent writes and rejects stale spread revisions', async () => {
    const db = await open(await directory(), { seed: false })
    const books = await Promise.all(
      Array.from({ length: 12 }, (_, i) => db.createBook({ ...input, title: `Книга ${i}` })),
    )
    expect(
      new Set(books.map((b) => `${b.collectionPage}/${b.cabinet}/${b.shelf}/${b.slot}`)).size,
    ).toBe(12)
    const [spread] = await db.spreads(books[0].id)
    const saved = await db.saveSpread(spread)
    expect(saved.revision).toBe(1)
    await expect(db.saveSpread(spread)).rejects.toThrow('Разворот изменён')
    expect((await db.spreads(books[0].id))[0].revision).toBe(1)
  })
  it('keeps the last confirmed state after a disk failure and accepts retry', async () => {
    let fail = false
    const path = await directory()
    const db = await open(path, {
      seed: false,
      writer: async (file, bytes) => {
        if (fail) throw new Error('Диск недоступен')
        await atomicWrite(file, bytes)
      },
    })
    const original = await db.createBook(input)
    fail = true
    await expect(db.updateBook(original.id, { ...input, title: 'Не сохранено' })).rejects.toThrow(
      'Диск недоступен',
    )
    expect((await db.books())[0].title).toBe(input.title)
    fail = false
    await db.updateBook(original.id, { ...input, title: 'Повтор сохранения' })
    expect((await (await open(path)).books())[0].title).toBe('Повтор сохранения')
  })
  it('deletes all spreads with a book and validates real dates and ratings', async () => {
    const db = await open(await directory(), { seed: false })
    const book = await db.createBook(input)
    await db.addSpread(book.id)
    expect(await db.spreads(book.id)).toHaveLength(2)
    await db.deleteBook(book.id)
    expect(await db.spreads(book.id)).toHaveLength(0)
    await expect(db.createBook({ ...input, rating: 4.1 })).rejects.toThrow()
    await expect(db.createBook({ ...input, finishedAt: '2026-02-31' })).rejects.toThrow()
  })
  it('exports a standard SQLite snapshot and preserves a previous copy', async () => {
    const path = await directory()
    const db = await open(path, { seed: false })
    await db.createBook(input)
    const bytes = await db.exportBytes()
    expect(Buffer.from(bytes).subarray(0, 15).toString()).toBe('SQLite format 3')
    expect((await readFile(join(path, 'sanctuary.sqlite.bak'))).length).toBeGreaterThan(100)
  })
})
