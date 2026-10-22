import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type Settings } from '../../src/shared/types'
import { settingsSchema } from '../../src/shared/validation'
import { emptySpread } from '../../src/main/seed'
import { useSanctuaryStore } from '../../src/renderer/src/store/useSanctuaryStore'

beforeEach(() => {
  useSanctuaryStore.setState({
    settings: defaultSettings(),
    activeBookId: null,
    activeSpreadId: null,
    spreads: [],
    saveStates: {},
    histories: {},
    epochs: {},
    error: null,
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('Remembered journal spread', () => {
  it('retains each book position through closing, another book and a restored session', async () => {
    const first = crypto.randomUUID(),
      second = crypto.randomUUID()
    const firstSpreads = [emptySpread(first, 0), emptySpread(first, 1)]
    const secondSpreads = [emptySpread(second, 0), emptySpread(second, 1)]
    let persisted: Settings = defaultSettings()
    vi.stubGlobal('window', {
      sanctuaryAPI: {
        getSpreads: async (id: string) =>
          structuredClone(id === first ? firstSpreads : secondSpreads),
        saveSettings: async (settings: Settings) => {
          persisted = structuredClone(settings)
          return settings
        },
        bootstrap: async () => ({ books: [], settings: structuredClone(persisted) }),
      },
    })
    const store = useSanctuaryStore.getState()
    await store.openJournal(first)
    await store.setActiveSpread(firstSpreads[1].id)
    expect(await store.closeJournal()).toBe(true)
    await store.openJournal(second)
    await store.setActiveSpread(secondSpreads[1].id)
    await store.closeJournal()
    useSanctuaryStore.setState({ settings: defaultSettings() })
    await store.bootstrap()
    await store.openJournal(first)
    expect(useSanctuaryStore.getState().activeSpreadId).toBe(firstSpreads[1].id)
    await store.openJournal(second)
    expect(useSanctuaryStore.getState().activeSpreadId).toBe(secondSpreads[1].id)
    expect(persisted.journalPositions).toEqual({
      [first]: firstSpreads[1].id,
      [second]: secondSpreads[1].id,
    })
    await store.flush()
  })

  it('falls back from a missing spread, ignores unknown navigation and remembers a new spread', async () => {
    const book = crypto.randomUUID(),
      spread = emptySpread(book),
      added = emptySpread(book, 1)
    useSanctuaryStore.setState({
      settings: { ...defaultSettings(), journalPositions: { [book]: crypto.randomUUID() } },
    })
    vi.stubGlobal('window', {
      sanctuaryAPI: {
        getSpreads: async () => [spread],
        addSpread: async () => added,
        saveSettings: async (settings: Settings) => settings,
      },
    })
    const store = useSanctuaryStore.getState()
    await store.openJournal(book)
    expect(useSanctuaryStore.getState().activeSpreadId).toBe(spread.id)
    await store.setActiveSpread(crypto.randomUUID())
    expect(useSanctuaryStore.getState().activeSpreadId).toBe(spread.id)
    await store.addSpread()
    await store.flush()
    expect(useSanctuaryStore.getState().settings.journalPositions[book]).toBe(added.id)
  })

  it('opens settings and backups from before journal positions existed', () => {
    const current = defaultSettings()
    expect(
      settingsSchema.parse({ goals: current.goals, room: current.room }).journalPositions,
    ).toEqual({})
  })
})
