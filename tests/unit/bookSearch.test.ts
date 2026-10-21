import { describe, expect, it } from 'vitest'
import { mapSearchResults } from '../../src/shared/bookSearch'
describe('Book edition selection', () => {
  it('uses the matching edition instead of an arbitrary edition from a work', () => {
    const [result] = mapSearchResults([
      {
        key: '/works/OL123W',
        title: 'Work title',
        author_name: ['Author'],
        cover_i: 101,
        editions: { docs: [{ key: '/books/OL456M', title: 'Matching edition', cover_i: 202 }] },
      },
    ])
    expect(result.title).toBe('Matching edition')
    expect(result.editionKey).toBe('OL456M')
    expect(result.coverId).toBe(101)
  })
  it('preserves unknown editions and missing covers without inventing metadata', () => {
    const [result] = mapSearchResults([{ key: '/works/OL123W', title: 'Work title', cover_i: -1 }])
    expect(result.editionKey).toBeNull()
    expect(result.coverId).toBeNull()
    expect(mapSearchResults([{}])).toEqual([])
  })
})
