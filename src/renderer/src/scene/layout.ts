import type { Book } from '../../../shared/types'
import { bookWidth } from '../../../shared/statistics'
import manifest from './manifest.json'

export type Placement = {
  book: Book
  position: [number, number, number]
  width: number
  height: number
  depth: number
}
export function roomPlacements(books: Book[], page: number): Placement[] {
  return manifest.shelfZones.flatMap((zone) => {
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
  })
}
