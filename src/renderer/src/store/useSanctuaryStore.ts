import { create } from 'zustand'
import {
  defaultSettings,
  type Book,
  type BookInput,
  type Settings,
  type Spread,
  type SaveState,
} from '../../../shared/types'

export type View = 'room' | 'library' | 'wishlist' | 'quotes' | 'progress' | 'story' | 'shelf'
type History = { past: Spread[]; future: Spread[] }
type State = {
  ready: boolean
  books: Book[]
  settings: Settings
  view: View
  query: string
  toast: string | null
  error: string | null
  activeBookId: string | null
  spreads: Spread[]
  activeSpreadId: string | null
  saveStates: Record<string, SaveState>
  histories: Record<string, History>
  epochs: Record<string, number>
  selectedItemId: string | null
  focusBookId: string | null
  bootstrap: () => Promise<void>
  refreshBooks: () => Promise<void>
  setView: (view: View) => void
  setQuery: (query: string) => void
  notify: (message: string) => void
  report: (error: unknown) => void
  saveBook: (input: BookInput, id?: string) => Promise<Book>
  deleteBook: (id: string) => Promise<void>
  saveSettings: (settings: Settings) => Promise<void>
  openJournal: (id: string) => Promise<void>
  closeJournal: () => Promise<boolean>
  setActiveSpread: (id: string) => Promise<void>
  addSpread: () => Promise<void>
  editSpread: (edit: (spread: Spread) => void, record?: boolean) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  flush: () => Promise<boolean>
  selectItem: (id: string | null) => void
  findBook: (book: Book) => void
}
const copy = <T>(value: T): T => structuredClone(value)
let toastTimer: ReturnType<typeof setTimeout> | undefined
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const inFlight = new Map<string, Promise<void>>()
let settingsQueue: Promise<unknown> = Promise.resolve()
let pendingSettings: Settings | null = null

function rememberJournalPosition(bookId: string, spreadId: string) {
  const store = useSanctuaryStore.getState()
  if (store.settings.journalPositions[bookId] === spreadId) return
  void store
    .saveSettings({
      ...store.settings,
      journalPositions: { ...store.settings.journalPositions, [bookId]: spreadId },
    })
    .catch(store.report)
}

async function flushOne(id: string): Promise<void> {
  const existing = inFlight.get(id)
  if (existing) {
    await existing
    return flushOne(id)
  }
  const state = useSanctuaryStore.getState()
  const spread = state.spreads.find((s) => s.id === id)
  if (!spread || state.saveStates[id] === 'saved') return
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
  const epoch = state.epochs[id] ?? 0
  const snapshot = copy(spread)
  useSanctuaryStore.setState((s) => ({ saveStates: { ...s.saveStates, [id]: 'saving' } }))
  const task = (async () => {
    try {
      const saved = await window.sanctuaryAPI.saveSpread(snapshot)
      useSanctuaryStore.setState((s) => ({
        spreads: s.spreads.map((d) => (d.id === id ? { ...d, revision: saved.revision } : d)),
        saveStates: { ...s.saveStates, [id]: (s.epochs[id] ?? 0) === epoch ? 'saved' : 'dirty' },
      }))
    } catch (error) {
      useSanctuaryStore.setState((s) => ({ saveStates: { ...s.saveStates, [id]: 'error' } }))
      throw error
    }
  })()
  inFlight.set(id, task)
  try {
    await task
  } finally {
    if (inFlight.get(id) === task) inFlight.delete(id)
  }
  if (useSanctuaryStore.getState().saveStates[id] === 'dirty') await flushOne(id)
}
function schedule(id: string) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.set(
    id,
    setTimeout(() => {
      void flushOne(id).catch((error) => useSanctuaryStore.getState().report(error))
    }, 500),
  )
}

export const useSanctuaryStore = create<State>((set, get) => ({
  ready: false,
  books: [],
  settings: defaultSettings(),
  view: 'library',
  query: '',
  toast: null,
  error: null,
  activeBookId: null,
  spreads: [],
  activeSpreadId: null,
  saveStates: {},
  histories: {},
  epochs: {},
  selectedItemId: null,
  focusBookId: null,
  bootstrap: async () => {
    try {
      const data = await window.sanctuaryAPI.bootstrap()
      set({ ...data, ready: true, error: null })
    } catch (error) {
      get().report(error)
    }
  },
  refreshBooks: async () => set({ books: await window.sanctuaryAPI.listBooks() }),
  setView: (view) => set({ view, query: '', focusBookId: null }),
  setQuery: (query) => set({ query }),
  notify: (toast) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 4200)
  },
  report: (error) =>
    set({
      error:
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : String(error),
    }),
  saveBook: async (input, id) => {
    const book = id
      ? await window.sanctuaryAPI.updateBook(id, input)
      : await window.sanctuaryAPI.createBook(input)
    await get().refreshBooks()
    get().notify(id ? 'Книга обновлена' : 'Новая история на вашей полке')
    return book
  },
  deleteBook: async (id) => {
    await window.sanctuaryAPI.deleteBook(id)
    await get().refreshBooks()
    get().notify('Книга удалена')
  },
  saveSettings: async (settings) => {
    set({ settings })
    pendingSettings = settings
    const action = settingsQueue.then(async () => {
      await window.sanctuaryAPI.saveSettings(settings)
      if (pendingSettings === settings) pendingSettings = null
    })
    settingsQueue = action.catch((error) => get().report(error))
    await action
  },
  openJournal: async (id) => {
    if (!(await get().flush())) return
    const spreads = await window.sanctuaryAPI.getSpreads(id)
    if (!spreads.length) spreads.push(await window.sanctuaryAPI.addSpread(id))
    const remembered = get().settings.journalPositions[id]
    const activeSpreadId = spreads.find((spread) => spread.id === remembered)?.id ?? spreads[0].id
    set({
      activeBookId: id,
      spreads,
      activeSpreadId,
      selectedItemId: null,
      histories: {},
      epochs: {},
      saveStates: Object.fromEntries(spreads.map((s) => [s.id, 'saved'])),
    })
    rememberJournalPosition(id, activeSpreadId)
  },
  closeJournal: async () => {
    if (!(await get().flush())) return false
    set({ activeBookId: null, spreads: [], activeSpreadId: null, selectedItemId: null })
    return true
  },
  setActiveSpread: async (id) => {
    if (!(await get().flush())) return
    const spread = get().spreads.find(
      (spread) => spread.id === id && spread.bookId === get().activeBookId,
    )
    if (!spread) return
    set({ activeSpreadId: id, selectedItemId: null })
    rememberJournalPosition(spread.bookId, id)
  },
  addSpread: async () => {
    if (!(await get().flush()) || !get().activeBookId) return
    const spread = await window.sanctuaryAPI.addSpread(get().activeBookId!)
    set((s) => ({
      spreads: [...s.spreads, spread],
      activeSpreadId: spread.id,
      selectedItemId: null,
      saveStates: { ...s.saveStates, [spread.id]: 'saved' },
    }))
    rememberJournalPosition(spread.bookId, spread.id)
  },
  checkpoint: () => {
    const s = get()
    const spread = s.spreads.find((d) => d.id === s.activeSpreadId)
    if (!spread) return
    const previous = s.histories[spread.id] ?? { past: [], future: [] }
    set({
      histories: {
        ...s.histories,
        [spread.id]: { past: [...previous.past.slice(-99), copy(spread)], future: [] },
      },
    })
  },
  editSpread: (edit, record = true) => {
    const state = get()
    const spread = state.spreads.find((s) => s.id === state.activeSpreadId)
    if (!spread) return
    if (record) get().checkpoint()
    const next = copy(spread)
    edit(next)
    set((s) => ({
      spreads: s.spreads.map((d) => (d.id === next.id ? next : d)),
      saveStates: { ...s.saveStates, [next.id]: 'dirty' },
      epochs: { ...s.epochs, [next.id]: (s.epochs[next.id] ?? 0) + 1 },
    }))
    schedule(next.id)
  },
  undo: () => {
    const s = get()
    const current = s.spreads.find((d) => d.id === s.activeSpreadId)
    if (!current) return
    const history = s.histories[current.id]
    if (!history?.past.length) return
    const previous = copy(history.past[history.past.length - 1])
    previous.revision = current.revision
    set({
      histories: {
        ...s.histories,
        [current.id]: {
          past: history.past.slice(0, -1),
          future: [copy(current), ...history.future],
        },
      },
    })
    get().editSpread((d) => Object.assign(d, previous), false)
  },
  redo: () => {
    const s = get()
    const current = s.spreads.find((d) => d.id === s.activeSpreadId)
    if (!current) return
    const history = s.histories[current.id]
    if (!history?.future.length) return
    const next = copy(history.future[0])
    next.revision = current.revision
    set({
      histories: {
        ...s.histories,
        [current.id]: { past: [...history.past, copy(current)], future: history.future.slice(1) },
      },
    })
    get().editSpread((d) => Object.assign(d, next), false)
  },
  flush: async () => {
    try {
      for (const spread of get().spreads) await flushOne(spread.id)
      await settingsQueue
      if (pendingSettings) await get().saveSettings(pendingSettings)
      return true
    } catch (error) {
      get().report(error)
      return false
    }
  },
  selectItem: (selectedItemId) => set({ selectedItemId }),
  findBook: (book) => set({ view: 'room', focusBookId: book.id, query: '' }),
}))
