import type { Book } from './types'

export function librarySearchTerms(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean)
}

export function matchesLibrarySearch(
  book: Pick<Book, 'title' | 'author'>,
  terms: readonly string[],
): boolean {
  const text = librarySearchTerms(`${book.title} ${book.author}`).join(' ')
  return terms.every((term) => text.includes(term))
}

export function resolveLibraryPage(
  page: number,
  maxPage: number,
  matchingPages?: readonly number[],
): number {
  const clamped = Math.max(0, Math.min(page, maxPage))
  if (!matchingPages?.length || matchingPages.includes(clamped)) return clamped
  return Math.min(...matchingPages)
}
