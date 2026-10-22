import initSqlJs, { type Database as SqlDatabase, type SqlJsStatic } from 'sql.js'
import { mkdir, readFile, rename, open, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  defaultSettings,
  type Book,
  type BookInput,
  type Settings,
  type Spread,
  type QuoteEntry,
} from '../shared/types'
import { bookInputSchema, spreadSchema, settingsSchema } from '../shared/validation'
import { placeBook } from '../shared/statistics'
import { seedBooks, seedWishlist, emptySpread } from './seed'

export type DiskWriter = (file: string, bytes: Uint8Array) => Promise<void>
export async function atomicWrite(file: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${file}.tmp`
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
  if (existsSync(file)) await copyFile(file, `${file}.bak`)
  await rename(temporary, file)
}
const bookColumns = [
  'id',
  'title',
  'author',
  'status',
  'rating',
  'pages',
  'spineColor',
  'coverColor',
  'goldFoil',
  'coverUrl',
  'cabinet',
  'shelf',
  'slot',
  'collectionPage',
  'finishedAt',
  'favoriteQuote',
  'isDemo',
] as const
export class SanctuaryDatabase {
  private queue: Promise<unknown> = Promise.resolve()
  private constructor(
    private sql: SqlJsStatic,
    private db: SqlDatabase,
    readonly directory: string,
    private writer: DiskWriter,
  ) {}
  static async open(
    directory: string,
    options: { wasmPath?: string; writer?: DiskWriter; seed?: boolean; bytes?: Uint8Array } = {},
  ): Promise<SanctuaryDatabase> {
    await mkdir(directory, { recursive: true })
    const sql = await initSqlJs({
      locateFile: () => options.wasmPath ?? resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
    })
    const file = join(directory, 'sanctuary.sqlite')
    const bytes = options.bytes ?? (existsSync(file) ? await readFile(file) : undefined)
    let db: SqlDatabase
    try {
      db = new sql.Database(bytes)
      if (db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok')
        throw new Error('integrity')
    } catch {
      throw new Error(
        'База повреждена. Восстановите sanctuary.sqlite.bak или архив библиотеки. Исходные файлы сохранены.',
      )
    }
    const instance = new SanctuaryDatabase(sql, db, directory, options.writer ?? atomicWrite)
    instance.migrate()
    if (!instance.rows("SELECT value FROM metadata WHERE key='initialized'").length) {
      db.run('BEGIN')
      try {
        if (options.seed !== false && !instance.rows('SELECT id FROM books LIMIT 1').length) {
          for (const { book, spread } of seedBooks()) {
            instance.insertBook(book)
            instance.insertSpread(spread)
          }
          for (const book of seedWishlist()) instance.insertBook(book)
        }
        db.run("INSERT INTO metadata(key,value) VALUES('initialized','1')")
        db.run('COMMIT')
      } catch (error) {
        db.run('ROLLBACK')
        throw error
      }
    }
    await instance.writer(file, instance.db.export())
    return instance
  }
  private migrate(): void {
    const version = Number(this.rows('PRAGMA user_version')[0]?.user_version ?? 0)
    if (version > 2)
      throw new Error(
        'Эта библиотека создана новой версией приложения. Обновите Sanctuary, чтобы открыть её.',
      )
    this.db.run(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,title TEXT NOT NULL,author TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('READ','WISHLIST')),rating REAL,pages INTEGER,spineColor TEXT NOT NULL,coverColor TEXT NOT NULL,goldFoil INTEGER NOT NULL,coverUrl TEXT,cabinet INTEGER NOT NULL,shelf INTEGER NOT NULL,slot INTEGER NOT NULL,collectionPage INTEGER NOT NULL DEFAULT 0,finishedAt TEXT,favoriteQuote TEXT NOT NULL DEFAULT '',isDemo INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS spreads(id TEXT PRIMARY KEY,bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,spreadIndex INTEGER NOT NULL,paperStyle TEXT NOT NULL,leftStrokesJson TEXT NOT NULL,rightStrokesJson TEXT NOT NULL,itemsJson TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 0,UNIQUE(bookId,spreadIndex));
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,mime TEXT NOT NULL,fileName TEXT NOT NULL UNIQUE);
      CREATE INDEX IF NOT EXISTS spreads_book ON spreads(bookId);
      `)
    if (version < 2) {
      const definition = String(
        this.rows("SELECT sql FROM sqlite_master WHERE name='books'")[0].sql,
      )
      this.db.run('PRAGMA foreign_keys=OFF; BEGIN')
      try {
        this.db.run(
          definition
            .replace(/CREATE TABLE "?books"?/i, 'CREATE TABLE books_next')
            .replace("'READ','WISHLIST'", "'READ','WISHLIST','OWNED'"),
        )
        this.db.run(
          'INSERT INTO books_next SELECT * FROM books; DROP TABLE books; ALTER TABLE books_next RENAME TO books; PRAGMA user_version=2;',
        )
        if (this.rows('PRAGMA foreign_key_check').length)
          throw new Error('Не удалось обновить связи дневников')
        this.db.run('COMMIT')
      } catch (error) {
        this.db.run('ROLLBACK')
        throw error
      } finally {
        this.db.run('PRAGMA foreign_keys=ON')
      }
    }
    this.db.run('INSERT OR IGNORE INTO settings(id,json) VALUES(1,?)', [
      JSON.stringify(defaultSettings()),
    ])
  }
  private rows(query: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
    const statement = this.db.prepare(query)
    try {
      statement.bind(params)
      const rows: Record<string, unknown>[] = []
      while (statement.step()) rows.push(statement.getAsObject())
      return rows
    } finally {
      statement.free()
    }
  }
  private async mutate<T>(operation: () => T): Promise<T> {
    const action = this.queue.then(async () => {
      const previous = this.db.export()
      try {
        this.db.run('PRAGMA foreign_keys=ON; BEGIN')
        const result = operation()
        this.db.run('COMMIT')
        await this.writer(join(this.directory, 'sanctuary.sqlite'), this.db.export())
        return result
      } catch (error) {
        this.db.close()
        this.db = new this.sql.Database(previous)
        this.db.run('PRAGMA foreign_keys=ON')
        throw error
      }
    })
    this.queue = action.catch(() => undefined)
    return action
  }
  async idle(): Promise<void> {
    await this.queue
  }
  async exportBytes(): Promise<Uint8Array> {
    await this.idle()
    return this.db.export()
  }
  async close(): Promise<void> {
    await this.idle()
    this.db.close()
  }
  private getBooks(): Book[] {
    return this.rows('SELECT * FROM books ORDER BY isDemo,title COLLATE NOCASE').map(
      (row) => ({ ...row, goldFoil: !!row.goldFoil, isDemo: !!row.isDemo }) as Book,
    )
  }
  async books(): Promise<Book[]> {
    await this.idle()
    return this.getBooks()
  }
  async settings(): Promise<Settings> {
    await this.idle()
    return settingsSchema.parse(
      JSON.parse(String(this.rows('SELECT json FROM settings WHERE id=1')[0].json)),
    )
  }
  async saveSettings(settings: Settings): Promise<Settings> {
    const parsed = settingsSchema.parse(settings)
    return this.mutate(() => {
      this.db.run('UPDATE settings SET json=? WHERE id=1', [JSON.stringify(parsed)])
      return parsed
    })
  }
  private insertBook(book: Book): void {
    this.db.run(
      `INSERT INTO books(${bookColumns.join(',')}) VALUES(${bookColumns.map(() => '?').join(',')})`,
      bookColumns.map((key) => (typeof book[key] === 'boolean' ? Number(book[key]) : book[key])),
    )
  }
  private insertSpread(spread: Spread): void {
    this.db.run('INSERT INTO spreads VALUES(?,?,?,?,?,?,?,?,?)', [
      spread.id,
      spread.bookId,
      spread.spreadIndex,
      spread.paperStyle,
      JSON.stringify(spread.leftStrokes),
      JSON.stringify(spread.rightStrokes),
      JSON.stringify(spread.items),
      spread.version,
      spread.revision,
    ])
  }
  async createBook(input: BookInput): Promise<Book> {
    const parsed = bookInputSchema.parse(input)
    return this.mutate(() => {
      const placement =
        parsed.status === 'READ'
          ? placeBook(this.getBooks(), parsed.cabinet, parsed.shelf, parsed.pages)
          : { cabinet: parsed.cabinet, shelf: parsed.shelf, slot: 0, collectionPage: 0 }
      const book: Book = {
        ...parsed,
        ...placement,
        id: randomUUID(),
        isDemo: false,
        finishedAt: parsed.status === 'READ' ? parsed.finishedAt : null,
      }
      this.insertBook(book)
      this.insertSpread(emptySpread(book.id))
      return book
    })
  }
  async updateBook(id: string, input: BookInput): Promise<Book> {
    const parsed = bookInputSchema.parse(input)
    return this.mutate(() => {
      const books = this.getBooks()
      const previous = books.find((b) => b.id === id)
      if (!previous) throw new Error('Книга не найдена')
      const moved =
        previous.status !== parsed.status ||
        previous.cabinet !== parsed.cabinet ||
        previous.shelf !== parsed.shelf ||
        previous.pages !== parsed.pages
      const placement =
        parsed.status === 'READ' && moved
          ? placeBook(
              books.filter((b) => b.id !== id),
              parsed.cabinet,
              parsed.shelf,
              parsed.pages,
            )
          : {
              cabinet: parsed.cabinet,
              shelf: parsed.shelf,
              slot: previous.slot,
              collectionPage: previous.collectionPage,
            }
      const book = {
        ...previous,
        ...parsed,
        ...placement,
        finishedAt: parsed.status === 'READ' ? parsed.finishedAt : null,
      }
      this.db.run(
        `UPDATE books SET ${bookColumns
          .slice(1)
          .map((key) => `${key}=?`)
          .join(',')} WHERE id=?`,
        [
          ...bookColumns
            .slice(1)
            .map((key) => (typeof book[key] === 'boolean' ? Number(book[key]) : book[key])),
          id,
        ],
      )
      return book
    })
  }
  async deleteBook(id: string): Promise<void> {
    return this.mutate(() => {
      this.db.run('DELETE FROM books WHERE id=?', [id])
    })
  }
  async removeDemo(): Promise<void> {
    return this.mutate(() => {
      this.db.run('DELETE FROM books WHERE isDemo=1')
    })
  }
  private getSpreads(bookId: string): Spread[] {
    return this.rows('SELECT * FROM spreads WHERE bookId=? ORDER BY spreadIndex', [bookId]).map(
      (row) =>
        ({
          id: row.id,
          bookId: row.bookId,
          spreadIndex: row.spreadIndex,
          paperStyle: row.paperStyle,
          leftStrokes: JSON.parse(String(row.leftStrokesJson)),
          rightStrokes: JSON.parse(String(row.rightStrokesJson)),
          items: JSON.parse(String(row.itemsJson)),
          version: row.version,
          revision: row.revision,
        }) as Spread,
    )
  }
  async spreads(bookId: string): Promise<Spread[]> {
    await this.idle()
    return this.getSpreads(bookId)
  }
  async addSpread(bookId: string): Promise<Spread> {
    return this.mutate(() => {
      if (!this.rows('SELECT id FROM books WHERE id=?', [bookId]).length)
        throw new Error('Книга не найдена')
      const current = this.getSpreads(bookId)
      const spread = emptySpread(bookId, Math.max(-1, ...current.map((s) => s.spreadIndex)) + 1)
      this.insertSpread(spread)
      return spread
    })
  }
  async saveSpread(input: Spread): Promise<Spread> {
    const parsed = spreadSchema.parse(input)
    return this.mutate(() => {
      const current = this.getSpreads(parsed.bookId).find((s) => s.id === parsed.id)
      if (!current) throw new Error('Разворот не найден')
      if (current.revision !== parsed.revision)
        throw new Error(
          'Разворот изменён. Откройте дневник заново, чтобы не перезаписать новую версию.',
        )
      const saved = { ...parsed, spreadIndex: current.spreadIndex, revision: current.revision + 1 }
      this.db.run(
        'UPDATE spreads SET paperStyle=?,leftStrokesJson=?,rightStrokesJson=?,itemsJson=?,version=?,revision=? WHERE id=?',
        [
          saved.paperStyle,
          JSON.stringify(saved.leftStrokes),
          JSON.stringify(saved.rightStrokes),
          JSON.stringify(saved.items),
          saved.version,
          saved.revision,
          saved.id,
        ],
      )
      return saved
    })
  }
  async quotes(): Promise<QuoteEntry[]> {
    await this.idle()
    const result: QuoteEntry[] = []
    for (const book of this.getBooks()) {
      if (book.favoriteQuote)
        result.push({
          bookId: book.id,
          bookTitle: book.title,
          text: book.favoriteQuote,
          type: 'quote',
        })
      for (const spread of this.getSpreads(book.id))
        for (const item of spread.items)
          if ((item.type === 'quote' || item.type === 'note') && item.content.trim())
            result.push({
              bookId: book.id,
              bookTitle: book.title,
              text: item.content,
              type: item.type,
            })
    }
    return result
  }
  async registerMedia(id: string): Promise<void> {
    await this.mutate(() => {
      this.db.run('INSERT OR IGNORE INTO media(id,mime,fileName) VALUES(?,?,?)', [
        id,
        'image/png',
        `${id}.png`,
      ])
    })
  }
  async mediaFiles(): Promise<string[]> {
    await this.idle()
    return this.rows('SELECT fileName FROM media').map((r) => String(r.fileName))
  }
  async hasMedia(id: string): Promise<boolean> {
    await this.idle()
    return this.rows('SELECT id FROM media WHERE id=?', [id]).length > 0
  }
}
