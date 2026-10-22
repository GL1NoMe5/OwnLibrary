import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { SanctuaryDatabase } from '../../src/main/db'
import { unreadPlacements, roomPlacements } from '../../src/renderer/src/scene/layout'
import { readingStats } from '../../src/shared/statistics'
import { defaultSettings, type Book } from '../../src/shared/types'

test('v1 migration retains journals; owned books paginate and move to shelves without counting as read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sanctuary-owned-'))
  let db = await SanctuaryDatabase.open(dir)
  try {
    const before = await db.books()
    const journals = await db.spreads(before[0].id)
    const sql = await initSqlJs()
    const legacy = new sql.Database(await db.exportBytes())
    legacy.run('PRAGMA foreign_keys=OFF')
    const ddl = String(
      legacy.exec("SELECT sql FROM sqlite_master WHERE name='books'")[0].values[0][0],
    )
    legacy.run(
      ddl.replace(/CREATE TABLE "?books"?/i, 'CREATE TABLE old_books').replace(",'OWNED'", ''),
    )
    legacy.run(
      'INSERT INTO old_books SELECT * FROM books; DROP TABLE books; ALTER TABLE old_books RENAME TO books; PRAGMA user_version=1',
    )
    const bytes = legacy.export()
    legacy.close()
    await db.close()
    db = await SanctuaryDatabase.open(dir, { bytes })
    expect(await db.books()).toEqual(before)
    expect(await db.spreads(before[0].id)).toEqual(journals)
    const created: Book[] = []
    for (let i = 0; i < 10; i++)
      created.push(
        await db.createBook({
          ...before[0],
          title: `В ожидании ${i}`,
          status: 'OWNED',
          finishedAt: null,
        }),
      )
    expect(unreadPlacements(await db.books(), 0)).toHaveLength(8)
    expect(unreadPlacements(await db.books(), 1)).toHaveLength(2)
    expect(readingStats(await db.books(), '2026', defaultSettings()).count).toBe(0)
    const [spread] = await db.spreads(created[0].id)
    await db.updateBook(created[0].id, { ...created[0], status: 'READ', finishedAt: '2026-10-22' })
    expect((await db.spreads(created[0].id))[0]).toEqual(spread)
    expect(
      roomPlacements(await db.books(), 0).find((p) => p.book.id === created[0].id)?.rotation,
    ).toBeUndefined()
    await db.close()
    db = await SanctuaryDatabase.open(dir)
    expect((await db.books()).filter((b) => b.status === 'OWNED')).toHaveLength(9)
  } finally {
    await db.close()
    await rm(dir, { recursive: true, force: true })
  }
})
