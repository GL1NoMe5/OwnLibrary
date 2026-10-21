import { useEffect, useRef, useState } from 'react'
import {
  X,
  MousePointer2,
  Pencil,
  Highlighter,
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  StickyNote,
  Quote,
  Image,
  Sticker,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Layers,
  Check,
  LoaderCircle,
  Save,
  Flower2,
  Scissors,
} from 'lucide-react'
import {
  stickers,
  type PaperStyle,
  type ScrapbookItem,
  type Side,
  type Tool,
} from '../../../shared/types'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import { DrawingCanvas } from './DrawingCanvas'
import { ScrapbookObject } from './ScrapbookObject'
import { audio } from '../audio/AmbientAudioEngine'
const tools: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: 'select', label: 'Выбор', icon: MousePointer2 },
  { id: 'pen', label: 'Карандаш', icon: Pencil },
  { id: 'marker', label: 'Маркер', icon: Highlighter },
  { id: 'fountain', label: 'Перо', icon: PenTool },
  { id: 'eraser', label: 'Ластик', icon: Eraser },
]
const papers: { value: PaperStyle; label: string }[] = [
  { value: 'DOT_GRID', label: 'Точечная' },
  { value: 'VINTAGE_KRAFT', label: 'Винтажный крафт' },
  { value: 'DARK_ACADEMIA', label: 'Dark Academia' },
  { value: 'LINED_CREAM', label: 'Линованная' },
]
const palette = ['#3e352b', '#7c9070', '#b37a5d', '#8c6681', '#cba260', '#466e84', '#faf6f0']
export function JournalSpreadModal() {
  const state = useSanctuaryStore()
  const {
    activeBookId,
    activeSpreadId,
    spreads,
    books,
    selectedItemId,
    editSpread,
    selectItem,
    report,
  } = state
  const spread = spreads.find((s) => s.id === activeSpreadId)
  const book = books.find((b) => b.id === activeBookId)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(palette[0])
  const [size, setSize] = useState(4)
  const [side, setSide] = useState<Side>('left')
  const [picker, setPicker] = useState<'sticker' | 'image' | null>(null)
  const [scale, setScale] = useState(0.7)
  const [turn, setTurn] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const item = spread?.items.find((i) => i.id === selectedItemId)
  const saveState = spread ? state.saveStates[spread.id] : 'saved'
  useEffect(() => {
    const element = viewport.current!
    const observer = new ResizeObserver((entries) => {
      const bounds = entries[0].contentRect
      setScale(Math.max(0.2, Math.min((bounds.width - 64) / 1240, (bounds.height - 40) / 840, 1)))
    })
    observer.observe(element)
    const previous = document.activeElement as HTMLElement | null
    root.current?.focus()
    return () => {
      observer.disconnect()
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusable = Array.from(
          root.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ).filter((element) => element.offsetParent !== null)
        const first = focusable[0],
          last = focusable[focusable.length - 1]
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === root.current)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === root.current)
        ) {
          event.preventDefault()
          first?.focus()
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void state.flush()
        return
      }
      if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (selectedItemId) selectItem(null)
        else void state.closeJournal()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? state.redo() : state.undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void state.flush()
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItemId) {
        event.preventDefault()
        editSpread((d) => {
          d.items = d.items.filter((i) => i.id !== selectedItemId)
        })
        selectItem(null)
      }
    }
    root.current!.addEventListener('keydown', handler)
    return () => root.current?.removeEventListener('keydown', handler)
  }, [state, selectedItemId])
  if (!spread || !book) return null
  function add(type: ScrapbookItem['type'], content = '') {
    const dimensions =
      type === 'polaroid'
        ? [280, 330]
        : type === 'sticker'
          ? [95, 95]
          : type === 'tape'
            ? [190, 45]
            : [300, 210]
    const item: ScrapbookItem = {
      id: crypto.randomUUID(),
      side,
      type,
      x: 100 + (spread!.items.length % 3) * 35,
      y: 120 + (spread!.items.length % 4) * 40,
      width: dimensions[0],
      height: dimensions[1],
      rotation: type === 'quote' ? 0 : -3,
      zIndex: Math.max(0, ...spread!.items.map((i) => i.zIndex)) + 1,
      content:
        type === 'note'
          ? 'Мысли между строк…'
          : type === 'quote'
            ? 'Слова, которые хочется запомнить…'
            : content,
      caption: 'мой тихий момент',
      bg: type === 'polaroid' ? '#ffffff' : type === 'note' ? '#e6dfb8' : '#f1e7cf',
      fontFamily: type === 'quote' ? 'Cormorant Garamond' : 'Caveat',
      fontSize: type === 'sticker' ? 70 : 26,
      tapeStyle: 'botanical',
    }
    editSpread((d) => {
      d.items.push(item)
    })
    selectItem(item.id)
    setTool('select')
    setPicker(null)
  }
  const patch = (changes: Partial<ScrapbookItem>) =>
    editSpread((d) => {
      const target = d.items.find((i) => i.id === selectedItemId)
      if (target) Object.assign(target, changes)
    })
  const go = async (id: string) => {
    if (!(await state.flush())) return
    setTurn(true)
    audio.pageFlip()
    await state.setActiveSpread(id)
    setTimeout(() => setTurn(false), state.settings.room.reducedMotion ? 0 : 250)
  }
  const index = spreads.findIndex((s) => s.id === spread.id)
  const history = state.histories[spread.id]
  return (
    <div
      className="journal-overlay"
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Дневник: ${book.title}`}
    >
      <header className="journal-header">
        <button className="button secondary small" onClick={() => void state.closeJournal()}>
          <ChevronLeft size={16} />
          {state.view === 'room' ? 'В комнату' : 'В библиотеку'}
        </button>
        <div className="journal-heading">
          <span className="eyebrow">ЧИТАТЕЛЬСКИЙ ДНЕВНИК</span>
          <h2>{book.title}</h2>
          <span>{book.author}</span>
        </div>
        <div className={`save-status ${saveState}`} aria-live="polite">
          {saveState === 'saved' ? (
            <>
              <Check size={15} />
              Сохранено в дневник
            </>
          ) : saveState === 'saving' ? (
            <>
              <LoaderCircle className="spin" size={15} />
              Сохраняем…
            </>
          ) : saveState === 'error' ? (
            <button onClick={() => void state.flush()}>
              <Save size={15} />
              Повторить сохранение
            </button>
          ) : (
            <>
              <span className="pending-dot" />
              Есть изменения
            </>
          )}
        </div>
        <button
          aria-label="Закрыть дневник"
          className="icon-button"
          onClick={() => void state.closeJournal()}
        >
          <X size={23} />
        </button>
      </header>
      <div className="journal-toolbar">
        <div className="tool-group">
          {tools.map((t) => (
            <button
              key={t.id}
              aria-label={t.label}
              title={t.label}
              aria-pressed={tool === t.id}
              className={tool === t.id ? 'tool active' : 'tool'}
              onClick={() => {
                setTool(t.id)
                selectItem(null)
              }}
            >
              <t.icon size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="tool-group colors">
          {palette.map((c) => (
            <button
              key={c}
              className={`color-dot ${color === c ? 'selected' : ''}`}
              style={{ background: c }}
              title={c}
              aria-label={`Цвет ${c}`}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            aria-label="Свой цвет кисти"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <label className="brush-size">
          <input
            aria-label="Толщина кисти"
            type="range"
            min={2}
            max={24}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span>{size}px</span>
        </label>
        <div className="tool-group history-tools">
          <button
            className="tool"
            aria-label="Отменить"
            disabled={!history?.past.length}
            onClick={state.undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="tool"
            aria-label="Повторить"
            disabled={!history?.future.length}
            onClick={state.redo}
          >
            <Redo2 size={18} />
          </button>
          <button
            className="tool"
            title="Очистить рисунок на выбранной странице"
            aria-label="Очистить рисунок"
            onClick={() => {
              if (window.confirm('Удалить все штрихи на выбранной странице? Предметы останутся.'))
                editSpread((d) => {
                  if (side === 'left') d.leftStrokes = []
                  else d.rightStrokes = []
                })
            }}
          >
            <Scissors size={17} />
          </button>
        </div>
      </div>
      <div className="journal-body">
        <aside className="journal-inserts">
          <span className="eyebrow">ДОБАВИТЬ</span>
          <button onClick={() => add('note')}>
            <StickyNote size={22} />
            <span>Заметка</span>
          </button>
          <button onClick={() => add('quote')}>
            <Quote size={22} />
            <span>Цитата</span>
          </button>
          <div className="insert-popover-wrap">
            <button
              className={picker === 'image' ? 'active' : ''}
              onClick={() => setPicker(picker === 'image' ? null : 'image')}
            >
              <Image size={22} />
              <span>Полароид</span>
            </button>
            {picker === 'image' && (
              <div className="insert-popover illustration-picker">
                <strong>Маленькие воспоминания</strong>
                <div>
                  {['garden', 'forest', 'night', 'desert'].map((name) => (
                    <button
                      key={name}
                      onClick={() => add('polaroid', `./illustrations/${name}.svg`)}
                    >
                      <img src={`./illustrations/${name}.svg`} alt={name} />
                    </button>
                  ))}
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    void window.sanctuaryAPI
                      .importImage()
                      .then((url) => {
                        if (url) add('polaroid', url)
                      })
                      .catch(report)
                  }}
                >
                  Загрузить фотографию
                </button>
              </div>
            )}
          </div>
          <button onClick={() => add('tape')}>
            <span className="tape-icon" />
            <span>Скотч</span>
          </button>
          <div className="insert-popover-wrap">
            <button
              className={picker === 'sticker' ? 'active' : ''}
              onClick={() => setPicker(picker === 'sticker' ? null : 'sticker')}
            >
              <Sticker size={22} />
              <span>Стикер</span>
            </button>
            {picker === 'sticker' && (
              <div className="insert-popover sticker-picker">
                {stickers.map((symbol) => (
                  <button
                    key={symbol}
                    aria-label={`Стикер ${symbol}`}
                    onClick={() => add('sticker', symbol)}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="insert-divider" />
          <label className="page-target">
            На страницу
            <select
              aria-label="Страница для новых предметов"
              value={side}
              onChange={(e) => setSide(e.target.value as Side)}
            >
              <option value="left">Левую</option>
              <option value="right">Правую</option>
            </select>
          </label>
          <Flower2 size={32} className="insert-flower" strokeWidth={1} />
        </aside>
        <div className="journal-viewport" ref={viewport}>
          <div
            className={`journal-book ${turn ? 'turning' : ''}`}
            style={{ width: 1240 * scale, height: 840 * scale }}
          >
            <div className="journal-spread" style={{ transform: `scale(${scale})` }}>
              {(['left', 'right'] as const).map((pageSide) => (
                <div
                  key={`${spread.id}-${pageSide}`}
                  className={`journal-page paper-${spread.paperStyle} page-${pageSide} ${side === pageSide ? 'target-page' : ''}`}
                  data-page-side={pageSide}
                  onPointerDown={(event) => {
                    if (tool === 'select' && event.target === event.currentTarget) selectItem(null)
                    setSide(pageSide)
                  }}
                >
                  <span className="page-watermark">
                    {pageSide === 'left' ? 'МЕЖДУ СТРОК' : 'МАЛЕНЬКИЕ ВОСПОМИНАНИЯ'}
                  </span>
                  <DrawingCanvas
                    side={pageSide}
                    strokes={pageSide === 'left' ? spread.leftStrokes : spread.rightStrokes}
                    tool={tool}
                    color={color}
                    size={size}
                    onActivate={() => {
                      setSide(pageSide)
                      selectItem(null)
                    }}
                  />
                  {spread.items
                    .filter((i) => i.side === pageSide)
                    .map((i) => (
                      <ScrapbookObject key={i.id} item={i} tool={tool} />
                    ))}
                  <span className="page-number">{index * 2 + (pageSide === 'left' ? 1 : 2)}</span>
                </div>
              ))}
              <div className="journal-crease" />
              <div className="bookmark-ribbon" />
            </div>
          </div>
        </div>
        <aside className="journal-inspector">
          <span className="eyebrow">ОФОРМЛЕНИЕ</span>
          <label>
            Бумага
            <select
              aria-label="Стиль бумаги"
              value={spread.paperStyle}
              onChange={(e) =>
                editSpread((d) => {
                  d.paperStyle = e.target.value as PaperStyle
                })
              }
            >
              {papers.map((p) => (
                <option value={p.value} key={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className={`paper-sample paper-${spread.paperStyle}`}>
            <span>Aa</span>
          </div>
          {item ? (
            <>
              <div className="inspector-divider" />
              <span className="eyebrow">ВЫБРАННЫЙ ПРЕДМЕТ</span>
              {['note', 'quote', 'polaroid', 'sticker'].includes(item.type) && (
                <>
                  <label>
                    Шрифт
                    <select
                      value={item.fontFamily}
                      onChange={(e) => patch({ fontFamily: e.target.value })}
                    >
                      {['Caveat', 'Cormorant Garamond', 'Marck Script', 'Nunito'].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Размер текста
                    <input
                      type="range"
                      min={10}
                      max={item.type === 'sticker' ? 120 : 60}
                      value={item.fontSize}
                      onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                    />
                    <small>{item.fontSize} px</small>
                  </label>
                </>
              )}
              <label>
                Цвет фона
                <input
                  type="color"
                  value={item.bg}
                  onChange={(e) => patch({ bg: e.target.value })}
                />
              </label>
              {item.type === 'tape' && (
                <label>
                  Узор
                  <select
                    value={item.tapeStyle}
                    onChange={(e) =>
                      patch({ tapeStyle: e.target.value as ScrapbookItem['tapeStyle'] })
                    }
                  >
                    <option value="plaid">Клетка</option>
                    <option value="botanical">Ботаника</option>
                    <option value="stars">Звёзды</option>
                  </select>
                </label>
              )}
              <div className="object-actions">
                <button
                  className="button secondary small"
                  onClick={() =>
                    patch({ zIndex: Math.max(...spread.items.map((i) => i.zIndex)) + 1 })
                  }
                >
                  <Layers size={15} />
                  Вперёд
                </button>
                <button
                  className="button secondary small"
                  onClick={() => {
                    editSpread((d) => {
                      for (const other of d.items) other.zIndex++
                      const target = d.items.find((i) => i.id === item.id)
                      if (target) target.zIndex = 0
                    })
                  }}
                >
                  Назад
                </button>
                <button
                  className="button danger small"
                  onClick={() => {
                    editSpread((d) => {
                      d.items = d.items.filter((i) => i.id !== item.id)
                    })
                    selectItem(null)
                  }}
                >
                  <Trash2 size={15} />
                  Удалить
                </button>
              </div>
            </>
          ) : (
            <p className="inspector-hint">
              Выберите предмет, чтобы изменить его оформление.
              <br />
              <br />
              Перетаскивайте за середину. Потяните за угол, чтобы изменить размер.
            </p>
          )}
          <div className="journal-tip">
            Каждая заметка —<br />
            <em>кусочек вашей истории.</em>
          </div>
        </aside>
      </div>
      <footer className="journal-footer">
        <span>Ваши мысли остаются здесь. Только для вас.</span>
        <div>
          <button
            className="icon-button"
            aria-label="Предыдущий разворот"
            disabled={index === 0}
            onClick={() => void go(spreads[index - 1].id)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Разворот {index + 1} / {spreads.length}
          </span>
          <button
            className="icon-button"
            aria-label="Следующий разворот"
            disabled={index === spreads.length - 1}
            onClick={() => void go(spreads[index + 1].id)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          className="button secondary small"
          onClick={() => {
            void state.addSpread().catch(report)
            audio.pageFlip()
          }}
        >
          <Plus size={16} />
          Новый разворот
        </button>
      </footer>
    </div>
  )
}
