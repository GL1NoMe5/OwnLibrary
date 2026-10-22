import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Plus,
  ArrowUpRight,
  BookOpen,
  SlidersHorizontal,
  LayoutGrid,
  Rows3,
  Bookmark,
  MoreHorizontal,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import type { Book, BookStatus } from '../../../shared/types'
import { localDate } from '../../../shared/types'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { BookCover, Rating } from './BookCover'
import { readingStats } from '../../../shared/statistics'
import {
  librarySearchTerms,
  matchesLibrarySearch,
  resolveLibraryPage,
} from '../../../shared/librarySearch'

export function Library({
  onAdd,
  onEdit,
}: {
  onAdd: (status?: BookStatus) => void
  onEdit: (book: Book) => void
}) {
  const {
    books,
    view,
    query,
    setQuery,
    settings,
    openJournal,
    report,
    findBook,
    saveBook,
    setView,
    focusBookId,
  } = useSanctuaryStore()
  const wishlist = view === 'wishlist'
  const shelf = view === 'shelf'
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(0)
  const [owned, setOwned] = useState(false)
  const month = localDate().slice(0, 7)
  const stats = readingStats(books, month, settings)
  const searchTerms = useMemo(() => librarySearchTerms(query), [query])
  const filtered = useMemo(
    () =>
      books
        .filter(
          (b) =>
            b.status === (wishlist ? 'WISHLIST' : !shelf && owned ? 'OWNED' : 'READ') &&
            matchesLibrarySearch(b, searchTerms),
        )
        .sort((a, b) =>
          sort === 'rating'
            ? (b.rating ?? -1) - (a.rating ?? -1)
            : sort === 'title'
              ? a.title.localeCompare(b.title, 'ru')
              : (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
        ),
    [books, wishlist, shelf, owned, searchTerms, sort],
  )
  const maxPage = Math.max(
    0,
    ...books.filter((b) => b.status === 'READ').map((b) => b.collectionPage),
  )
  useEffect(() => {
    setPage((current) =>
      resolveLibraryPage(
        current,
        maxPage,
        searchTerms.length ? filtered.map((book) => book.collectionPage) : undefined,
      ),
    )
  }, [filtered, maxPage, searchTerms])
  useEffect(() => {
    const focus = books.find((b) => b.id === focusBookId)
    if (focus) {
      setPage(focus.collectionPage)
      setTimeout(
        () =>
          document.querySelector(`[data-book-id="${focus.id}"]`)?.scrollIntoView({
            block: 'nearest',
            behavior:
              settings.room.reducedMotion ||
              window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
          }),
        80,
      )
    }
  }, [focusBookId, books, settings.room.reducedMotion])
  function toRead(book: Book) {
    void saveBook({ ...book, status: 'READ', finishedAt: localDate() }, book.id).catch(report)
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {wishlist
              ? 'БУДУЩИЕ ЗНАКОМСТВА'
              : shelf
                ? 'ВАШ МАЛЕНЬКИЙ КНИЖНЫЙ МИР'
                : 'ВАШ ЧИТАТЕЛЬСКИЙ УГОЛОК'}
          </span>
          <h1>
            {wishlist ? 'В предвкушении историй' : shelf ? 'На книжной полке' : 'Моя библиотека'}
          </h1>
          <p>
            {wishlist
              ? 'Некоторые встречи с книгами ещё впереди.'
              : shelf
                ? 'У каждой истории есть своё место.'
                : 'Истории, к которым хочется возвращаться.'}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => onAdd(wishlist ? 'WISHLIST' : owned ? 'OWNED' : 'READ')}
        >
          <Plus size={18} />
          Добавить книгу
        </button>
      </div>
      {!wishlist && !shelf && (
        <section className="welcome-card">
          <div className="welcome-copy">
            <div className="welcome-overline">
              <span />
              ВРЕМЯ ДЛЯ СЕБЯ
            </div>
            <h2>
              Ещё одна глава.
              <br />
              <em>Ещё один маленький мир.</em>
            </h2>
            <p>
              Собирайте любимые книги, сохраняйте мысли
              <br className="wide-only" /> и оставляйте частичку себя между строк.
            </p>
            <button
              className="text-link"
              onClick={() => {
                if (filtered[0]) void openJournal(filtered[0].id).catch(report)
                else onAdd()
              }}
            >
              Открыть читательский дневник
              <ArrowUpRight size={17} />
            </button>
          </div>
          <img
            className="welcome-illustration"
            src="./illustrations/reading-corner.svg"
            alt="Тёплый читательский уголок у окна"
          />
          <div className="welcome-stamp">
            a little
            <br />
            <em>slower</em>
            <Leaf size={14} />
          </div>
        </section>
      )}
      {!wishlist && !shelf && (
        <div className="quick-stats">
          <div>
            <span className="stat-icon">
              <BookOpen size={21} strokeWidth={1.3} />
            </span>
            <strong>{books.filter((b) => b.status === 'READ' && !b.isDemo).length}</strong>
            <span>книг в вашей истории</span>
          </div>
          <div>
            <span className="stat-icon">
              <Bookmark size={21} strokeWidth={1.3} />
            </span>
            <strong>{stats.pages.toLocaleString('ru')}</strong>
            <span>страниц в этом месяце</span>
          </div>
          <div className="goal-mini">
            <div>
              <span className="goal-dot" />
              <span>Маленькая цель на месяц</span>
              <strong>
                {stats.count}
                <small> / {stats.goal} книг</small>
              </strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, (stats.count / stats.goal) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      <div className="library-toolbar">
        <div className="library-tabs">
          <button
            className={!shelf && (wishlist || !owned) ? 'active' : ''}
            onClick={() => {
              setOwned(false)
              setView(wishlist ? 'wishlist' : 'library')
            }}
          >
            {wishlist ? 'Список желаний' : 'Прочитанные'}
            <span>{books.filter((b) => b.status === (wishlist ? 'WISHLIST' : 'READ')).length}</span>
          </button>
          {!wishlist && (
            <button
              className={!shelf && owned ? 'active' : ''}
              onClick={() => {
                setOwned(true)
                setView('library')
              }}
            >
              Ждут чтения <span>{books.filter((b) => b.status === 'OWNED').length}</span>
            </button>
          )}
          {!wishlist && (
            <button className={shelf ? 'active' : ''} onClick={() => setView('shelf')}>
              Книжные полки
            </button>
          )}
        </div>
        <div className="library-controls">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Поиск в библиотеке"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, автор…"
            />
          </div>
          <label className="sort-control">
            <SlidersHorizontal size={16} />
            <select aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">По дате</option>
              <option value="rating">По оценке</option>
              <option value="title">По названию</option>
            </select>
          </label>
          {!shelf && (
            <div className="view-switch">
              <button
                aria-label="Показать сеткой"
                className={layout === 'grid' ? 'active' : ''}
                onClick={() => setLayout('grid')}
              >
                <LayoutGrid size={17} />
              </button>
              <button
                aria-label="Показать списком"
                className={layout === 'list' ? 'active' : ''}
                onClick={() => setLayout('list')}
              >
                <Rows3 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
      {books.some((b) => b.isDemo) && (
        <p className="demo-hint">
          <Leaf size={13} />
          Книги с отметкой «Пример» помогут освоиться. Они не влияют на вашу статистику.
        </p>
      )}
      {shelf ? (
        <>
          <div className="shelf-pagination">
            <button
              className="button secondary small"
              aria-label="Предыдущая страница шкафов"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Страница шкафов {page + 1} / {maxPage + 1}
            </span>
            <button
              className="button secondary small"
              aria-label="Следующая страница шкафов"
              disabled={page === maxPage}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={`bookcases theme-${settings.room.woodTheme.toLowerCase()}`}>
            {[0, 1].map((cabinet) => (
              <section key={cabinet} className="bookcase">
                <h3>{cabinet === 0 ? 'Истории у окна' : 'Истории у камина'}</h3>
                {[3, 2, 1, 0].map((shelf) => (
                  <div className="wooden-shelf" key={shelf}>
                    {filtered
                      .filter(
                        (b) =>
                          b.collectionPage === page && b.cabinet === cabinet && b.shelf === shelf,
                      )
                      .sort((a, b) => a.slot - b.slot)
                      .map((book) => (
                        <button
                          key={book.id}
                          data-book-id={book.id}
                          className={`book-spine ${focusBookId === book.id ? 'focused' : ''}`}
                          style={{
                            backgroundColor: book.spineColor,
                            width: `${Math.min(53, 22 + (book.pages ?? 320) * 0.025)}px`,
                          }}
                          title={`${book.title} · ${book.author}`}
                          onClick={() => void openJournal(book.id).catch(report)}
                        >
                          <span className={book.goldFoil ? 'gold-text' : ''}>{book.title}</span>
                          <small>✧</small>
                        </button>
                      ))}
                    <span className="shelf-label">{shelf + 1}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <p className="shelf-footnote">Нажмите на корешок книги, чтобы открыть дневник.</p>
        </>
      ) : filtered.length ? (
        <div className={`book-grid ${layout === 'list' ? 'list-view' : ''}`}>
          {filtered.map((book) => (
            <article key={book.id} className="book-card">
              <button
                className="cover-button"
                aria-label={`Открыть дневник: ${book.title}`}
                onClick={() => void openJournal(book.id).catch(report)}
              >
                <BookCover book={book} />
                <span className="cover-open">
                  <BookOpen size={17} />
                  Открыть дневник
                </span>
                {book.isDemo && <span className="demo-badge">Пример</span>}
              </button>
              <div className="book-card-info">
                <button
                  className="book-title-button"
                  onClick={() => void openJournal(book.id).catch(report)}
                >
                  <h3>{book.title}</h3>
                </button>
                <p>{book.author}</p>
                <div className="book-meta">
                  <Rating value={book.rating} />
                  <span>{book.pages ? `${book.pages} стр.` : '— стр.'}</span>
                  <button
                    aria-label={`Изменить: ${book.title}`}
                    className="book-more"
                    onClick={() => onEdit(book)}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                <div className="book-card-actions">
                  {wishlist || owned ? (
                    <>
                      {wishlist && (
                        <button
                          onClick={() =>
                            void saveBook(
                              { ...book, status: 'OWNED', finishedAt: null },
                              book.id,
                            ).catch(report)
                          }
                        >
                          Уже есть у меня
                        </button>
                      )}
                      <button onClick={() => toRead(book)}>
                        <BookOpen size={14} />
                        Прочитано → На полку
                      </button>
                      {owned && !wishlist && (
                        <button onClick={() => findBook(book)}>
                          Найти в стопке <ArrowUpRight size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => findBook(book)}>
                      Найти на полке
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={44} strokeWidth={1} />
          <h2>{query ? 'Пока не нашлось' : 'Здесь начинается ваша история'}</h2>
          <p>
            {query
              ? 'Попробуйте другое название или имя автора.'
              : 'Добавьте первую книгу и сохраните мысли о ней.'}
          </p>
          {!query && (
            <button
              className="button primary"
              onClick={() => onAdd(wishlist ? 'WISHLIST' : owned ? 'OWNED' : 'READ')}
            >
              <Plus size={16} />
              Добавить книгу
            </button>
          )}
        </div>
      )}
      <div className="page-end">
        <span>ЧИТАТЬ. ЧУВСТВОВАТЬ. ЗАПОМИНАТЬ.</span>
        <Leaf size={14} />
      </div>
    </>
  )
}
