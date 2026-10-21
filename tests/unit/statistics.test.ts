import { describe, expect, it } from 'vitest'
import { bookWidth, placeBook, readingStats } from '../../src/shared/statistics'
import { defaultSettings, type Book } from '../../src/shared/types'
const sample = (overrides: Partial<Book> = {}): Book => ({
  id: crypto.randomUUID(),
  title: 'Книга',
  author: 'Автор',
  status: 'READ',
  rating: 4,
  pages: 200,
  spineColor: '#555555',
  coverColor: '#555555',
  goldFoil: true,
  coverUrl: null,
  cabinet: 0,
  shelf: 0,
  slot: 0,
  collectionPage: 0,
  finishedAt: '2026-10-21',
  favoriteQuote: '',
  isDemo: false,
  ...overrides,
})
describe('Reading totals', () => {
  it('excludes examples and wishlist, respects dates, unknown ratings and page counts', () => {
    const stats = readingStats(
      [
        sample(),
        sample({ rating: null, pages: null }),
        sample({ rating: 5, isDemo: true }),
        sample({ status: 'WISHLIST' }),
        sample({ finishedAt: '2026-09-20' }),
      ],
      '2026-10',
      defaultSettings(),
    )
    expect(stats.count).toBe(2)
    expect(stats.pages).toBe(200)
    expect(stats.average).toBe(4)
    expect(stats.unrated).toBe(1)
    expect(stats.daily[20]).toBe(2)
    expect(stats.daily.reduce((a, b) => a + b, 0)).toBe(2)
  })
  it('handles empty months, leap years and year aggregation', () => {
    expect(readingStats([], '2024-02', defaultSettings()).daily).toHaveLength(29)
    expect(readingStats([], '2026-02', defaultSettings()).daily).toHaveLength(28)
    const stats = readingStats(
      [sample(), sample({ finishedAt: '2026-09-15' })],
      '2026',
      defaultSettings(),
    )
    expect(stats.count).toBe(2)
    expect(stats.daily).toHaveLength(12)
    expect(stats.average).toBe(4)
  })
  it('places 1000 books without overlapping shelf budgets or hidden books', () => {
    const books: Book[] = []
    for (let i = 0; i < 1000; i++) {
      const location = placeBook(books, 0, 0, 700)
      books.push(sample({ ...location, pages: 700 }))
    }
    expect(
      new Set(books.map((b) => `${b.collectionPage}/${b.cabinet}/${b.shelf}/${b.slot}`)).size,
    ).toBe(1000)
    for (const page of new Set(books.map((b) => b.collectionPage)))
      for (let c = 0; c < 2; c++)
        for (let s = 0; s < 4; s++) {
          const width = books
            .filter((b) => b.collectionPage === page && b.cabinet === c && b.shelf === s)
            .reduce((total, b) => total + bookWidth(b.pages) + 0.015, 0)
          expect(width).toBeLessThanOrEqual(1.58)
        }
    expect(Math.max(...books.map((b) => b.collectionPage))).toBeGreaterThan(0)
  })
})
