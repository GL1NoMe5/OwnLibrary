import type { SearchResult } from './types'
export type SearchDocument = {
  key?: string
  title?: string
  author_name?: string[]
  cover_i?: number
  editions?: { docs?: { key?: string; title?: string; cover_i?: number }[] }
}
export function mapSearchResults(documents: SearchDocument[]): SearchResult[] {
  return documents
    .filter((document) => document.key && document.title)
    .map((document) => {
      const edition = document.editions?.docs?.[0]
      const editionKey = edition?.key?.replace(/^\/books\//, '')
      const cover = document.cover_i ?? edition?.cover_i
      return {
        key: document.key!,
        title: edition?.title ?? document.title!,
        author: document.author_name?.join(', ') ?? 'Неизвестный автор',
        coverId: cover && cover > 0 ? cover : null,
        editionKey: editionKey && /^OL\d+M$/.test(editionKey) ? editionKey : null,
      }
    })
}
