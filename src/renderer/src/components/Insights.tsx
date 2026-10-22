import { useEffect, useMemo, useState } from 'react'
import {
  Quote,
  ArrowUpRight,
  BookOpen,
  Download,
  LoaderCircle,
  Leaf,
  Target,
  Sparkles,
} from 'lucide-react'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { readingStats } from '../../../shared/statistics'
import { localDate, type QuoteEntry } from '../../../shared/types'
import { Rating } from './BookCover'
import { createStory, type StoryTheme } from '../export/story'

export function QuotesView() {
  const { books, query, setQuery, openJournal, report } = useSanctuaryStore()
  const [quotes, setQuotes] = useState<QuoteEntry[]>([])
  const [kind, setKind] = useState<'all' | 'quote' | 'note'>('all')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let current = true
    window.sanctuaryAPI
      .getQuotes()
      .then((result) => {
        if (current) setQuotes(result)
      })
      .catch(report)
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [books, report])
  const list = quotes.filter(
    (q) =>
      (kind === 'all' || q.type === kind) &&
      `${q.text} ${q.bookTitle}`.toLowerCase().includes(query.toLowerCase()),
  )
  const rated = books
    .filter((b) => b.status === 'READ' && b.rating !== null)
    .sort((a, b) => b.rating! - a.rating!)
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">СЛОВА, КОТОРЫЕ ОСТАЛИСЬ</span>
          <h1>Между строк</h1>
          <p>Любимые мысли, цитаты и маленькие открытия.</p>
        </div>
        <Quote size={35} strokeWidth={1} />
      </div>
      <section className="favorites-strip">
        <span className="eyebrow">БЛИЖЕ ВСЕГО К СЕРДЦУ</span>
        <div>
          {rated.slice(0, 5).map((b) => (
            <button key={b.id} onClick={() => void openJournal(b.id).catch(report)}>
              <span className="mini-spine" style={{ background: b.coverColor }} />
              <span>
                {b.title}
                <small>{b.author}</small>
              </span>
              <Rating value={b.rating} />
            </button>
          ))}
          {!rated.length && <p>Здесь появятся книги с вашими оценками.</p>}
        </div>
      </section>
      <div className="library-toolbar">
        <div className="library-tabs">
          {(
            [
              { id: 'all', label: 'Всё' },
              { id: 'quote', label: 'Цитаты' },
              { id: 'note', label: 'Заметки' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              className={kind === tab.id ? 'active' : ''}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          className="quote-search"
          aria-label="Поиск по заметкам"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти мысль…"
        />
      </div>
      {loading ? (
        <p className="loading-line">
          <LoaderCircle className="spin" size={19} />
          Открываем дневники…
        </p>
      ) : (
        <div className="quotes-grid">
          {list.map((q, i) => (
            <article className={`quote-card ${q.type}`} key={`${q.bookId}-${i}`}>
              <Quote size={24} strokeWidth={1} />
              <p>{q.text}</p>
              <button onClick={() => void openJournal(q.bookId).catch(report)}>
                {q.bookTitle}
                <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
          {!list.length && (
            <div className="empty-state">
              <Quote size={40} strokeWidth={1} />
              <h2>Место для любимых слов</h2>
              <p>Добавьте заметку или цитату в дневник любой книги.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
export function ProgressView() {
  const { books, settings, saveSettings, report } = useSanctuaryStore()
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const stats = readingStats(books, month, settings)
  const goal = Math.min(100, (stats.count / stats.goal) * 100)
  const max = Math.max(1, ...stats.daily)
  const days = stats.daily.length
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">В ВАШЕМ СОБСТВЕННОМ ТЕМПЕ</span>
          <h1>Маленькие шаги, большие миры</h1>
          <p>Каждая прочитанная страница имеет значение.</p>
        </div>
        <input
          type="month"
          aria-label="Месяц статистики"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value)
          }}
        />
      </div>
      <div className="progress-dashboard">
        <section className="goal-card">
          <span className="eyebrow">
            <Target size={15} />
            ЦЕЛЬ НА МЕСЯЦ
          </span>
          <div
            className="goal-ring"
            style={{
              background: `conic-gradient(var(--ui-progress, #7c9070) ${goal}%, var(--ui-track, #e7e3d7) 0)`,
            }}
          >
            <div>
              <strong>
                {stats.count}
                <small> / {stats.goal}</small>
              </strong>
              <span>книг прочитано</span>
            </div>
          </div>
          <h3>{goal >= 100 ? 'Ваша маленькая победа!' : 'Ровно в вашем темпе'}</h3>
          <p>
            {goal >= 100
              ? 'Можно насладиться моментом. Или открыть новую главу.'
              : 'Без спешки. С удовольствием. По одной книге за раз.'}
          </p>
          <label className="goal-input">
            Моя цель
            <input
              aria-label="Цель книг на месяц"
              type="number"
              min={1}
              max={1000}
              value={stats.goal}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (Number.isInteger(value) && value > 0 && value <= 1000)
                  void saveSettings({
                    ...settings,
                    goals: { ...settings.goals, [month]: value },
                  }).catch(report)
              }}
            />
            книг
          </label>
        </section>
        <div className="progress-right">
          <div className="metric-grid">
            <section>
              <BookOpen size={21} strokeWidth={1.2} />
              <strong>{stats.pages.toLocaleString('ru')}</strong>
              <span>страниц в законченных книгах</span>
            </section>
            <section>
              <Sparkles size={21} strokeWidth={1.2} />
              <strong>{stats.average?.toFixed(1) ?? '—'}</strong>
              <span>средняя оценка</span>
            </section>
          </div>
          <section className="pace-card">
            <div>
              <h3>Истории этого месяца</h3>
              <span>Завершённые книги по дням</span>
            </div>
            <div className="bar-chart" aria-label="Количество завершённых книг по дням">
              {stats.daily.map((n, i) => (
                <div key={i} title={`${i + 1}: ${n} книг`}>
                  <div
                    className={n ? 'has-books' : ''}
                    style={{ height: `${(n / max) * 130 + 3}px` }}
                  />
                  <span>{i === 0 || i === days - 1 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>
                </div>
              ))}
            </div>
            <p>График учитывает дату завершения, а не ежедневные сессии чтения.</p>
          </section>
        </div>
      </div>
      {books.some((b) => b.isDemo) && (
        <p className="demo-hint">
          <Leaf size={14} />
          Демонстрационные книги не входят в ваши итоги.
        </p>
      )}
    </>
  )
}
export function StoryView() {
  const { books, settings, report, notify } = useSanctuaryStore()
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [period, setPeriod] = useState(localDate().slice(0, 7))
  const [theme, setTheme] = useState<StoryTheme>('hearth')
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)
  const [rendering, setRendering] = useState(true)
  const stats = useMemo(() => readingStats(books, period, settings), [books, period, settings])
  useEffect(() => {
    let current = true
    setRendering(true)
    createStory(stats, period, theme)
      .then((url) => {
        if (current) setImage(url)
      })
      .catch(report)
      .finally(() => {
        if (current) setRendering(false)
      })
    return () => {
      current = false
    }
  }, [stats, period, theme, report])
  async function download() {
    setBusy(true)
    try {
      if (await window.sanctuaryAPI.savePng(image)) notify('Ваша история сохранена в PNG')
    } catch (e) {
      report(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">СОХРАНИТЬ ПОСЛЕВКУСИЕ</span>
          <h1>Ваша история в одной карточке</h1>
          <p>Небольшой итог большого читательского путешествия.</p>
        </div>
      </div>
      <div className="story-workspace">
        <section className="story-controls">
          <h3>Каким был ваш месяц?</h3>
          <p>Выберите настроение и сохраните книги, которые стали частью вас.</p>
          <div className="segmented">
            <button
              className={mode === 'month' ? 'active' : ''}
              onClick={() => {
                setMode('month')
                setPeriod(localDate().slice(0, 7))
              }}
            >
              За месяц
            </button>
            <button
              className={mode === 'year' ? 'active' : ''}
              onClick={() => {
                setMode('year')
                setPeriod(localDate().slice(0, 4))
              }}
            >
              За год
            </button>
          </div>
          <label>
            {mode === 'month' ? 'Месяц' : 'Год'}
            {mode === 'month' ? (
              <input
                type="month"
                value={period}
                onChange={(e) => {
                  if (e.target.value) setPeriod(e.target.value)
                }}
              />
            ) : (
              <input
                type="number"
                min={1900}
                max={2200}
                value={Number(period)}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (n >= 1900 && n <= 2200) setPeriod(String(n))
                }}
              />
            )}
          </label>
          <span className="eyebrow">НАСТРОЕНИЕ КАРТОЧКИ</span>
          <div className="story-themes">
            {(
              [
                { id: 'hearth', name: 'Уют у камина', note: 'Cozy Hearth' },
                { id: 'academia', name: 'Тёмная академия', note: 'Dark Academia' },
                { id: 'botanical', name: 'Ботанический альбом', note: 'Botanical Parchment' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                className={theme === t.id ? 'selected' : ''}
                onClick={() => setTheme(t.id)}
              >
                <span className={`theme-swatch ${t.id}`}>Aa</span>
                <span>
                  {t.name}
                  <small>{t.note}</small>
                </span>
                <span className="theme-radio" />
              </button>
            ))}
          </div>
          <button
            className="button primary"
            disabled={!image || busy || rendering}
            onClick={() => void download()}
          >
            {busy || rendering ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            Скачать карточку PNG
          </button>
          <p className="export-note">
            1080 × 1920 px · Полное разрешение
            <br />
            Сохраняется на ваш компьютер
          </p>
        </section>
        <div className={`story-preview theme-${theme}`}>
          {image ? (
            <img src={image} alt={`Карточка итогов чтения за ${period}`} />
          ) : (
            <LoaderCircle className="spin" size={30} />
          )}
        </div>
      </div>
    </>
  )
}
