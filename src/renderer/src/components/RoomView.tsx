import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LibraryBig,
  LoaderCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import type { Book } from '../../../shared/types'
import { SanctuaryScene, type CameraPreset } from '../scene/SanctuaryScene'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { audio } from '../audio/AmbientAudioEngine'
import { unreadBooks, unreadPlacements, stackPageSize } from '../scene/layout'

export default function RoomView({ onAdd }: { onAdd: () => void }) {
  const books = useSanctuaryStore((s) => s.books)
  const room = useSanctuaryStore((s) => s.settings.room)
  const activeBookId = useSanctuaryStore((s) => s.activeBookId)
  const focusBookId = useSanctuaryStore((s) => s.focusBookId)
  const container = useRef<HTMLDivElement>(null)
  const controller = useRef<SanctuaryScene | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Book | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('OVERVIEW')
  const [page, setPage] = useState(
    () => books.find((book) => book.id === focusBookId)?.collectionPage ?? 0,
  )
  const [systemMotion, setSystemMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const maxPage = Math.max(
    0,
    Math.ceil(unreadBooks(books).length / stackPageSize) - 1,
    ...books.filter((book) => book.status === 'READ').map((book) => book.collectionPage),
  )
  const pageBooks = useMemo(
    () => [
      ...books
        .filter((book) => book.status === 'READ' && book.collectionPage === page)
        .sort((a, b) => a.cabinet - b.cabinet || a.shelf - b.shelf || a.slot - b.slot),
      ...unreadPlacements(books, page).map((p) => p.book),
    ],
    [books, page],
  )
  const config = useMemo(
    () => ({ ...room, reducedMotion: room.reducedMotion || systemMotion }),
    [room, systemMotion],
  )
  const toggleRadio = () => {
    const store = useSanctuaryStore.getState()
    const room = store.settings.room
    void store
      .saveSettings({
        ...store.settings,
        room: { ...room, sound: true, radioPlaying: !room.sound || !room.radioPlaying },
      })
      .catch(store.report)
  }
  useEffect(() => {
    void audio.setRoomActive(true).catch(useSanctuaryStore.getState().report)
    return () => {
      void audio.setRoomActive(false).catch(useSanctuaryStore.getState().report)
    }
  }, [])

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let alive = true
    let scene: SanctuaryScene | null = null
    const fail = (error: unknown) => {
      if (!alive) return
      scene?.dispose()
      controller.current = null
      setError(error instanceof Error ? error.message : 'Не удалось открыть комнату')
    }
    try {
      scene = new SanctuaryScene(container.current!, config, {
        ready: () => {
          if (alive) setReady(true)
        },
        select: (book) => {
          if (alive) setSelected(book)
        },
        camera: (camera) => {
          if (alive) setPreset(camera)
        },
        open: (id) => {
          const store = useSanctuaryStore.getState()
          void store.openJournal(id).catch(store.report)
        },
        cat: () => {
          audio.purr()
          useSanctuaryStore.getState().notify('Котик сладко мурчит у камина… 🐾')
        },
        radio: toggleRadio,
        listener: (position, forward) => audio.setListener(position, forward),
        error: fail,
        pictureError: (error) => useSanctuaryStore.getState().report(error),
      })
      controller.current = scene
      void scene.setBooks(books, page)
      void scene.start().catch(fail)
    } catch (error) {
      fail(error)
    }
    return () => {
      alive = false
      scene?.dispose()
      controller.current = null
    }
    // The scene lives for this screen; subsequent updates use the methods below.
  }, [])
  useEffect(() => {
    controller.current?.setSettings(config)
  }, [config])
  useEffect(() => {
    controller.current?.setPaused(!!activeBookId)
  }, [activeBookId, ready])
  useEffect(() => {
    void controller.current?.setBooks(books, page).catch((error) => {
      controller.current?.dispose()
      setError(error instanceof Error ? error.message : 'Не удалось расставить книги')
    })
    setSelected((selected) =>
      selected ? (pageBooks.find((book) => book.id === selected.id) ?? null) : null,
    )
  }, [books, page])
  useEffect(() => {
    const book = books.find((book) => book.id === focusBookId && book.status !== 'WISHLIST')
    if (!book) return
    setPage(
      book.status === 'OWNED'
        ? Math.floor(unreadBooks(books).findIndex((b) => b.id === book.id) / stackPageSize)
        : book.collectionPage,
    )
    if (ready) controller.current?.focusBook(book)
  }, [focusBookId, ready, books])
  useEffect(() => {
    if (page > maxPage) setPage(maxPage)
  }, [maxPage, page])
  const library = () => useSanctuaryStore.getState().setView('library')
  const openSelected = () => {
    if (selected)
      void useSanctuaryStore
        .getState()
        .openJournal(selected.id)
        .catch(useSanctuaryStore.getState().report)
  }
  const changePage = (value: number) => {
    setPage(value)
    setSelected(null)
    useSanctuaryStore.setState({ focusBookId: null })
  }
  return (
    <section className="room-view" aria-label="Читательская комната">
      <header className="room-heading">
        <div>
          <span className="eyebrow">
            <Leaf size={12} /> ВАШ ТИХИЙ ВЕЧЕР
          </span>
          <h1>Комната историй</h1>
        </div>
        <div className="room-heading-actions">
          <button className="button secondary small" onClick={library}>
            <LibraryBig size={16} /> Список книг
          </button>
          <button className="button primary small" onClick={onAdd}>
            <Plus size={16} /> Добавить книгу
          </button>
        </div>
      </header>
      <div className="room-stage">
        <button
          className="radio-keyboard-control"
          onClick={toggleRadio}
          aria-label={
            room.sound && room.radioPlaying ? 'Поставить радио на паузу' : 'Включить радио'
          }
          aria-pressed={room.sound && room.radioPlaying}
        >
          {room.sound && room.radioPlaying ? 'Пауза радио' : 'Включить радио'}
        </button>
        <div
          className="room-canvas"
          ref={container}
          data-status="loading"
          data-testid="room-canvas"
        />
        {!ready && !error && (
          <div className="room-loading" role="status">
            <LoaderCircle className="spin" size={30} />
            <p>Зажигаем свет в вашей комнате…</p>
          </div>
        )}
        {error ? (
          <div className="room-fallback" role="alert">
            <Leaf size={32} />
            <h2>Продолжим в библиотеке</h2>
            <p>{error}</p>
            <button className="button primary" onClick={library}>
              Открыть список книг
            </button>
          </div>
        ) : (
          ready && (
            <>
              <nav className="room-cameras" aria-label="Ракурс комнаты">
                {(
                  [
                    ['OVERVIEW', 'Общий вид'],
                    ['SHELF_0', 'Левый шкаф'],
                    ['SHELF_1', 'Правый шкаф'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={preset === value}
                    onClick={() => {
                      useSanctuaryStore.setState({ focusBookId: null })
                      controller.current?.setCamera(value)
                    }}
                  >
                    {value === 'OVERVIEW' && <ArrowLeft size={13} />}
                    {label}
                  </button>
                ))}
                {books.some((b) => b.status === 'OWNED') && (
                  <button
                    aria-pressed={preset === 'STACK'}
                    onClick={() => controller.current?.setCamera('STACK')}
                  >
                    Стопка книг
                  </button>
                )}
              </nav>
              <details className="room-book-picker" key={page}>
                <summary>
                  <BookOpen size={15} /> Книги в комнате <span>{pageBooks.length}</span>
                </summary>
                <div className="room-book-list">
                  {pageBooks.length ? (
                    pageBooks.map((book) => (
                      <button
                        key={book.id}
                        aria-label={`Найти в комнате: ${book.title}`}
                        onClick={(event) => {
                          controller.current?.focusBook(book)
                          event.currentTarget.closest('details')?.removeAttribute('open')
                        }}
                      >
                        <i style={{ background: book.spineColor }} />
                        <span>
                          {book.title}
                          <small>
                            {book.author}
                            {book.status === 'OWNED' ? ' · ждёт чтения в стопке' : ''}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p>Добавьте прочитанную книгу — она появится здесь.</p>
                  )}
                </div>
              </details>
              {selected ? (
                <article className="room-book-card" aria-label={`Выбрана книга: ${selected.title}`}>
                  {selected.coverUrl ? (
                    <img src={selected.coverUrl} alt={`Обложка: ${selected.title}`} />
                  ) : (
                    <div className="room-cover" style={{ background: selected.coverColor }}>
                      <BookOpen size={23} />
                      <span>{selected.title}</span>
                    </div>
                  )}
                  <div>
                    <span className="eyebrow">ВАША ИСТОРИЯ</span>
                    <h2>{selected.title}</h2>
                    <p>{selected.author}</p>
                    <small>
                      {selected.rating !== null ? `★ ${selected.rating.toFixed(1)} · ` : ''}
                      {selected.pages ? `${selected.pages} стр. · ` : ''}
                      {selected.status === 'OWNED'
                        ? 'Ждёт чтения · в стопке'
                        : `Полка ${selected.shelf + 1}`}
                    </small>
                    <button className="button primary small" onClick={openSelected}>
                      <BookOpen size={14} /> Открыть дневник
                    </button>
                  </div>
                </article>
              ) : (
                <div className="room-hint">
                  <Sparkles size={15} />
                  <span>
                    {preset === 'OVERVIEW'
                      ? 'Выберите шкаф, чтобы подойти к книгам'
                      : 'Наведите на корешок и нажмите, чтобы открыть дневник'}
                  </span>
                </div>
              )}
              <div className="room-pages" aria-label="Страницы шкафов">
                <button
                  aria-label="Предыдущая страница шкафов"
                  disabled={page === 0}
                  onClick={() => changePage(page - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  Полки {page + 1} / {maxPage + 1}
                </span>
                <button
                  aria-label="Следующая страница шкафов"
                  disabled={page === maxPage}
                  onClick={() => changePage(page + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </>
          )
        )}
      </div>
    </section>
  )
}
