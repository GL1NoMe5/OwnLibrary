import type { Edition, SearchResult } from '../shared/types'
import { storeImage } from './media'
import type { SanctuaryDatabase } from './db'
import { mapSearchResults, type SearchDocument } from '../shared/bookSearch'

let lastRequest = 0
let networkQueue: Promise<unknown> = Promise.resolve()
const cache = new Map<string, { time: number; results: SearchResult[] }>()
async function request(url: string): Promise<Response> {
  const task = networkQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequest))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequest = Date.now()
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'CozyReadersSanctuary/1.0 (desktop reading journal)' },
    })
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? 'Сервис просит немного подождать. Попробуйте позже.'
          : 'Сервис поиска временно недоступен',
      )
    return response
  })
  networkQueue = task.catch(() => undefined)
  return task
}
export async function searchBooks(query: string): Promise<SearchResult[]> {
  const cached = cache.get(query)
  if (cached && Date.now() - cached.time < 300000) return cached.results
  const fields =
    'key,title,author_name,cover_i,editions,editions.key,editions.title,editions.cover_i'
  const response = await request(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&lang=ru&limit=12&fields=${fields}`,
  )
  const json = (await response.json()) as { docs?: SearchDocument[] }
  const results = mapSearchResults(json.docs ?? [])
  cache.set(query, { time: Date.now(), results })
  if (cache.size > 100) cache.delete(cache.keys().next().value!)
  return results
}
export async function resolveEdition(
  result: SearchResult,
  db: SanctuaryDatabase,
): Promise<Edition> {
  let pages: number | null = null
  let coverId = result.coverId
  let title = result.title
  if (result.editionKey) {
    const data = (await (
      await request(`https://openlibrary.org/books/${result.editionKey}.json`)
    ).json()) as { number_of_pages?: number; covers?: number[]; title?: string }
    pages =
      Number.isInteger(data.number_of_pages) && data.number_of_pages! > 0
        ? data.number_of_pages!
        : null
    coverId = data.covers?.find((id) => id > 0) ?? coverId
    title = data.title ?? title
  }
  let coverUrl: string | null = null
  const coverCandidates = [
    ...new Set([coverId, result.coverId].filter((id): id is number => id !== null && id > 0)),
  ]
  for (const candidate of coverCandidates) {
    try {
      const response = await request(
        `https://covers.openlibrary.org/b/id/${candidate}-L.jpg?default=false`,
      )
      const size = Number(response.headers.get('content-length') ?? 0)
      if (size > 20 * 1024 * 1024) throw new Error('Обложка слишком большая')
      const reader = response.body!.getReader()
      const parts: Uint8Array[] = []
      let total = 0
      for (;;) {
        const part = await reader.read()
        if (part.done) break
        total += part.value.length
        if (total > 20 * 1024 * 1024) {
          await reader.cancel()
          throw new Error('Обложка слишком большая')
        }
        parts.push(part.value)
      }
      coverUrl = await storeImage(Buffer.concat(parts), db)
      break
    } catch {
      /* Metadata remains usable when a cover is missing or unavailable. */
    }
  }
  return { title, author: result.author, pages, coverUrl }
}
