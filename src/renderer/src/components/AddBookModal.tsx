import { useEffect, useRef, useState } from 'react'
import { Search, Upload, LoaderCircle, BookOpen, Trash2 } from 'lucide-react'
import type { Book, BookInput, BookStatus, SearchResult } from '../../../shared/types'
import { localDate } from '../../../shared/types'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { Modal } from './Modal'
import { BookCover } from './BookCover'
const colors = [
  '#69745c',
  '#946a58',
  '#685568',
  '#426567',
  '#a67e51',
  '#5b627c',
  '#8c5360',
  '#705244',
]
export function AddBookModal({
  book,
  status = 'READ',
  onClose,
}: {
  book?: Book
  status?: BookStatus
  onClose: () => void
}) {
  const [form, setForm] = useState<BookInput>(
    book
      ? { ...book }
      : {
          title: '',
          author: '',
          status,
          rating: null,
          pages: null,
          spineColor: colors[0],
          coverColor: colors[0],
          goldFoil: true,
          coverUrl: null,
          cabinet: 0,
          shelf: 0,
          finishedAt: status === 'READ' ? localDate() : null,
          favoriteQuote: '',
        },
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const saveBook = useSanctuaryStore((s) => s.saveBook)
  const deleteBook = useSanctuaryStore((s) => s.deleteBook)
  const field = <K extends keyof BookInput>(key: K, value: BookInput[K]) =>
    setForm((s) => ({ ...s, [key]: value }))
  useEffect(() => {
    const request = ++generation.current
    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const timeout = setTimeout(() => {
      setSearching(true)
      window.sanctuaryAPI
        .searchBooks(query.trim())
        .then((items) => {
          if (generation.current === request) setResults(items)
        })
        .catch((e) => {
          if (generation.current === request) setError(e.message)
        })
        .finally(() => {
          if (generation.current === request) setSearching(false)
        })
    }, 600)
    return () => clearTimeout(timeout)
  }, [query])
  async function select(result: SearchResult) {
    setBusy(true)
    setError('')
    try {
      const edition = await window.sanctuaryAPI.resolveEdition(result)
      setForm((s) => ({ ...s, ...edition }))
      setQuery('')
      setResults([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveBook(form, book?.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={book ? 'О книге' : 'Ещё одна история'}
      onClose={() => {
        if (!busy) onClose()
      }}
      className="book-modal"
    >
      <form onSubmit={submit}>
        <div className="online-search">
          <Search size={18} />
          <input
            aria-label="Найти книгу онлайн"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти название или автора в Open Library…"
          />
          {searching && <LoaderCircle className="spin" size={17} />}
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r) => (
              <button type="button" key={r.key} onClick={() => void select(r)} disabled={busy}>
                <BookOpen size={19} />
                <span>
                  {r.title}
                  <small>{r.author}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="book-form-grid">
          <div className="book-form-cover">
            <BookCover book={form} />
            <button
              className="button secondary small"
              type="button"
              disabled={busy}
              onClick={() => {
                void window.sanctuaryAPI
                  .importImage()
                  .then((url) => {
                    if (url) field('coverUrl', url)
                  })
                  .catch((e) => setError(e.message))
              }}
            >
              <Upload size={15} />
              Своя обложка
            </button>
            {form.coverUrl && (
              <button type="button" className="text-button" onClick={() => field('coverUrl', null)}>
                Убрать обложку
              </button>
            )}
          </div>
          <div className="book-form-fields">
            <label>
              Название
              <input
                required
                maxLength={300}
                value={form.title}
                onChange={(e) => field('title', e.target.value)}
                placeholder="Название книги"
                autoComplete="off"
              />
            </label>
            <label>
              Автор
              <input
                required
                maxLength={300}
                value={form.author}
                onChange={(e) => field('author', e.target.value)}
                placeholder="Имя автора"
              />
            </label>
            <div className="form-row">
              <label>
                Статус
                <select
                  value={form.status}
                  onChange={(e) => {
                    const value = e.target.value as BookStatus
                    setForm((s) => ({
                      ...s,
                      status: value,
                      finishedAt: value === 'READ' ? (s.finishedAt ?? localDate()) : null,
                    }))
                  }}
                >
                  <option value="READ">Прочитана</option>
                  <option value="WISHLIST">Хочу прочитать</option>
                  <option value="OWNED">Есть, но не прочитана</option>
                </select>
              </label>
              <label>
                Страниц
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={form.pages ?? ''}
                  onChange={(e) => field('pages', e.target.value ? Number(e.target.value) : null)}
                  placeholder="Неизвестно"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Ваша оценка
                <select
                  value={form.rating ?? ''}
                  onChange={(e) =>
                    field('rating', e.target.value === '' ? null : Number(e.target.value))
                  }
                >
                  <option value="">Без оценки</option>
                  {Array.from({ length: 11 }, (_, i) => i * 0.5)
                    .reverse()
                    .map((n) => (
                      <option value={n} key={n}>
                        ★ {n.toFixed(1)}
                      </option>
                    ))}
                </select>
              </label>
              {form.status === 'READ' && (
                <label>
                  Дата завершения
                  <input
                    type="date"
                    required
                    value={form.finishedAt ?? ''}
                    onChange={(e) => field('finishedAt', e.target.value || null)}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="form-row">
          <label>
            Шкаф
            <select value={form.cabinet} onChange={(e) => field('cabinet', Number(e.target.value))}>
              <option value={0}>Левый</option>
              <option value={1}>Правый</option>
            </select>
          </label>
          <label>
            Полка
            <select value={form.shelf} onChange={(e) => field('shelf', Number(e.target.value))}>
              {[0, 1, 2, 3].map((n) => (
                <option value={n} key={n}>
                  {n + 1}-я полка
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cover-colors">
          <span>Цвет переплёта</span>
          <div>
            {colors.map((color) => (
              <button
                type="button"
                aria-label={`Переплёт ${color}`}
                aria-pressed={form.spineColor === color}
                key={color}
                className={`color-dot ${form.spineColor === color ? 'selected' : ''}`}
                style={{ background: color }}
                onClick={() => setForm((s) => ({ ...s, spineColor: color, coverColor: color }))}
              />
            ))}
            <input
              type="color"
              aria-label="Другой цвет переплёта"
              value={form.spineColor}
              onChange={(e) =>
                setForm((s) => ({ ...s, spineColor: e.target.value, coverColor: e.target.value }))
              }
            />
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.goldFoil}
              onChange={(e) => field('goldFoil', e.target.checked)}
            />
            Золотое тиснение
          </label>
        </div>
        <label>
          Любимая цитата
          <textarea
            rows={2}
            maxLength={10000}
            value={form.favoriteQuote}
            onChange={(e) => field('favoriteQuote', e.target.value)}
            placeholder="Слова, которые остались с вами…"
          />
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {book && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Удалить книгу и все её развороты?')) {
                  setBusy(true)
                  void deleteBook(book.id)
                    .then(onClose)
                    .catch((e) => {
                      setError(e.message)
                      setBusy(false)
                    })
                }
              }}
            >
              <Trash2 size={16} />
              Удалить
            </button>
          )}
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <BookOpen size={17} />}Сохранить
            книгу
          </button>
        </div>
      </form>
    </Modal>
  )
}
