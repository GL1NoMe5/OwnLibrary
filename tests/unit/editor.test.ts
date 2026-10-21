import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSanctuaryStore } from '../../src/renderer/src/store/useSanctuaryStore'
import { emptySpread } from '../../src/main/seed'
import type { Spread } from '../../src/shared/types'
afterEach(() => {
  vi.unstubAllGlobals()
  useSanctuaryStore.setState({
    spreads: [],
    activeSpreadId: null,
    saveStates: {},
    histories: {},
    epochs: {},
    error: null,
  })
})
describe('Editor history and save queue', () => {
  it('retries failed settings before allowing the window to close', async () => {
    let fail = true
    vi.stubGlobal('window', {
      sanctuaryAPI: {
        saveSettings: async () => {
          if (fail) throw new Error('Диск недоступен')
        },
      },
    })
    const store = useSanctuaryStore.getState()
    await expect(
      store.saveSettings({ ...store.settings, goals: { '2026-10': 7 } }),
    ).rejects.toThrow('Диск недоступен')
    expect(await store.flush()).toBe(false)
    fail = false
    expect(await store.flush()).toBe(true)
  })
  it('keeps edits made while a previous revision is being written', async () => {
    const spread = emptySpread(crypto.randomUUID())
    let resolveFirst!: (s: Spread) => void
    const calls: Spread[] = []
    vi.stubGlobal('window', {
      sanctuaryAPI: {
        saveSpread: vi.fn((snapshot: Spread) => {
          calls.push(snapshot)
          return calls.length === 1
            ? new Promise<Spread>((resolve) => {
                resolveFirst = resolve
              })
            : Promise.resolve({ ...snapshot, revision: snapshot.revision + 1 })
        }),
      },
    })
    useSanctuaryStore.setState({
      spreads: [spread],
      activeSpreadId: spread.id,
      saveStates: { [spread.id]: 'saved' },
      histories: {},
      epochs: {},
    })
    useSanctuaryStore.getState().editSpread((d) => {
      d.paperStyle = 'VINTAGE_KRAFT'
    })
    const first = useSanctuaryStore.getState().flush()
    await new Promise((resolve) => setTimeout(resolve, 10))
    useSanctuaryStore.getState().editSpread((d) => {
      d.paperStyle = 'DARK_ACADEMIA'
    })
    const second = useSanctuaryStore.getState().flush()
    resolveFirst({ ...calls[0], revision: 1 })
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(calls).toHaveLength(2)
    expect(calls[1].revision).toBe(1)
    expect(calls[1].paperStyle).toBe('DARK_ACADEMIA')
    expect(useSanctuaryStore.getState().spreads[0].revision).toBe(2)
  })
  it('undoes and redoes mixed content without restoring an obsolete server revision', async () => {
    const spread = emptySpread(crypto.randomUUID())
    vi.stubGlobal('window', {
      sanctuaryAPI: { saveSpread: async (s: Spread) => ({ ...s, revision: s.revision + 1 }) },
    })
    useSanctuaryStore.setState({
      spreads: [spread],
      activeSpreadId: spread.id,
      saveStates: { [spread.id]: 'saved' },
      histories: {},
      epochs: {},
    })
    const store = useSanctuaryStore.getState()
    store.editSpread((d) => {
      d.paperStyle = 'LINED_CREAM'
    })
    await store.flush()
    store.undo()
    expect(useSanctuaryStore.getState().spreads[0].paperStyle).toBe('DOT_GRID')
    expect(useSanctuaryStore.getState().spreads[0].revision).toBe(1)
    store.redo()
    expect(useSanctuaryStore.getState().spreads[0].paperStyle).toBe('LINED_CREAM')
    await store.flush()
  })
})
