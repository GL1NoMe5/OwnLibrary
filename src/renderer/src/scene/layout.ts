import type { Book } from '../../../shared/types'
import { bookWidth } from '../../../shared/statistics'
import manifest from './manifest.json'

export type Placement = {
  book: Book
  position: [number, number, number]
  width: number
  height: number
  depth: number
  rotation?: [number, number, number]
}
export const stackPageSize = 8
export const unreadBooks = (books: Book[]) =>
  books
    .filter((b) => b.status === 'OWNED')
    .sort((a, b) => a.title.localeCompare(b.title, 'ru') || a.id.localeCompare(b.id))
export function unreadPlacements(books: Book[], page: number): Placement[] {
  let y = 0.014
  return unreadBooks(books)
    .slice(page * stackPageSize, (page + 1) * stackPageSize)
    .map((book, i) => {
      const width = 0.028 + Math.min(900, book.pages ?? 300) * 0.00004
      const position: Placement['position'] = [0.55 + (i % 2) * 0.015, y + width / 2, -0.48]
      y += width + 0.003
      return {
        book,
        position,
        width,
        height: 0.34,
        depth: 0.245,
        rotation: [0, ((i % 3) - 1) * 0.09, Math.PI / 2],
      }
    })
}
export function roomPlacements(books: Book[], page: number): Placement[] {
  return [
    ...manifest.shelfZones.flatMap((zone) => {
      let offset = 0
      return books
        .filter(
          (book) =>
            book.status === 'READ' &&
            book.collectionPage === page &&
            book.cabinet === zone.cabinet &&
            book.shelf === zone.shelf,
        )
        .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
        .map((book): Placement => {
          const units = bookWidth(book.pages)
          const scale = zone.widthMeters / zone.layoutCapacityUnits
          const width = units * scale
          const hash = Array.from(book.id).reduce((n, char) => n + char.charCodeAt(0), 0)
          const height = 0.235 + (hash % 5) * 0.009
          const depth = 0.175 + (hash % 4) * 0.009
          const position: Placement['position'] = [
            zone.origin[0] + offset * scale + width / 2,
            zone.bookBaselineY + height / 2,
            zone.bookSpineZ - depth / 2,
          ]
          offset += units + 0.015
          return { book, position, width, height, depth }
        })
    }),
    ...unreadPlacements(books, page),
  ]
}
