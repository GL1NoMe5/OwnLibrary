import type { Book, ReadingStats, Settings } from './types'

export function readingStats(allBooks: Book[], period: string, settings: Settings): ReadingStats {
  const books = allBooks.filter(
    (b) => b.status === 'READ' && !b.isDemo && b.finishedAt?.startsWith(period),
  )
  const rated = books.filter((b) => b.rating !== null)
  const isYear = period.length === 4
  const length = isYear
    ? 12
    : new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate()
  const daily = Array.from({ length }, () => 0)
  for (const book of books) {
    const index = Number(book.finishedAt!.slice(isYear ? 5 : 8, isYear ? 7 : 10)) - 1
    if (index >= 0 && index < length) daily[index]++
  }
  return {
    books,
    count: books.length,
    pages: books.reduce((n, b) => n + (b.pages ?? 0), 0),
    unrated: books.length - rated.length,
    average: rated.length ? rated.reduce((n, b) => n + b.rating!, 0) / rated.length : null,
    goal: isYear
      ? Array.from(
          { length: 12 },
          (_, i) => settings.goals[`${period}-${String(i + 1).padStart(2, '0')}`] ?? 4,
        ).reduce((a, b) => a + b, 0)
      : (settings.goals[period] ?? 4),
    daily,
    top:
      rated.sort(
        (a, b) => b.rating! - a.rating! || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
      )[0] ?? null,
  }
}
export function bookWidth(pages: number | null): number {
  return Math.max(0.07, Math.min(0.23, 0.065 + (pages ?? 320) * 0.00016))
}
export function placeBook(
  books: Book[],
  preferredCabinet: number,
  preferredShelf: number,
  pages: number | null,
): Pick<Book, 'cabinet' | 'shelf' | 'slot' | 'collectionPage'> {
  const width = bookWidth(pages)
  const maxPage = Math.max(0, ...books.map((b) => b.collectionPage))
  for (let page = 0; page <= maxPage + 1; page++) {
    const locations = Array.from({ length: 8 }, (_, i) => ({
      cabinet: Math.floor(i / 4),
      shelf: i % 4,
    }))
    locations.sort(
      (a, b) =>
        Number(b.cabinet === preferredCabinet && b.shelf === preferredShelf) -
        Number(a.cabinet === preferredCabinet && a.shelf === preferredShelf),
    )
    for (const location of locations) {
      const current = books.filter(
        (b) =>
          b.status === 'READ' &&
          b.collectionPage === page &&
          b.cabinet === location.cabinet &&
          b.shelf === location.shelf,
      )
      if (current.reduce((total, b) => total + bookWidth(b.pages) + 0.015, 0) + width <= 1.56)
        return {
          ...location,
          collectionPage: page,
          slot: Math.max(-1, ...current.map((b) => b.slot)) + 1,
        }
    }
  }
  throw new Error('Не удалось разместить книгу')
}
