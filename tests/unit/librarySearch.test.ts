import { describe, expect, it } from 'vitest'
import {
  librarySearchTerms,
  matchesLibrarySearch,
  resolveLibraryPage,
} from '../../src/shared/librarySearch'

describe('Library search', () => {
  it('finds title and author words in any order, ignoring ё, spaces and punctuation', () => {
    const book = { title: 'Преступление и наказание', author: 'Фёдор Достоевский' }
    expect(matchesLibrarySearch(book, librarySearchTerms('  ФЕДОР — наказание, '))).toBe(true)
    expect(matchesLibrarySearch(book, librarySearchTerms('наказание толстой'))).toBe(false)
    expect(
      matchesLibrarySearch(
        { title: 'Гарри-Поттер', author: 'Дж. К. Роулинг' },
        librarySearchTerms('гарри поттер'),
      ),
    ).toBe(true)
    expect(matchesLibrarySearch(book, librarySearchTerms(' — '))).toBe(true)
  })

  it('normalizes composed Unicode without confusing й with и', () => {
    expect(librarySearchTerms('Чаи\u0306ковскии\u0306')).toEqual(['чайковский'])
    const book = { title: 'Чай', author: 'Автор' }
    expect(matchesLibrarySearch(book, librarySearchTerms('Чаи\u0306'))).toBe(true)
    expect(matchesLibrarySearch(book, librarySearchTerms('чаи'))).toBe(false)
  })

  it('opens a matching shelf page and repairs the page after the last books are deleted', () => {
    expect(resolveLibraryPage(0, 4, [4, 2, 4])).toBe(2)
    expect(resolveLibraryPage(4, 4, [2, 4])).toBe(4)
    expect(resolveLibraryPage(4, 1)).toBe(1)
    expect(resolveLibraryPage(4, 0, [])).toBe(0)
  })
})
