import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { Check, Leaf, LoaderCircle, X, AlertCircle, BookOpen } from 'lucide-react'
import type { Book, BookStatus } from '../../shared/types'
import { useSanctuaryStore } from './store/useSanctuaryStore'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Library } from './components/Library'
import { QuotesView, ProgressView, StoryView } from './components/Insights'
import { AddBookModal } from './components/AddBookModal'
import { SettingsModal } from './components/SettingsModal'
import { JournalSpreadModal } from './components/JournalSpreadModal'
import { audio } from './audio/AmbientAudioEngine'
import { applyInterfaceTheme } from './interfaceAppearance'

const RoomView = lazy(() => import('./components/RoomView'))

export function App() {
  const ready = useSanctuaryStore((s) => s.ready)
  const view = useSanctuaryStore((s) => s.view)
  const activeBookId = useSanctuaryStore((s) => s.activeBookId)
  const toast = useSanctuaryStore((s) => s.toast)
  const error = useSanctuaryStore((s) => s.error)
  const room = useSanctuaryStore((s) => s.settings.room)
  const interfaceTheme = useSanctuaryStore((s) => s.settings.interfaceTheme)
  const [bookModal, setBookModal] = useState<Book | 'new' | null>(null)
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('READ')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsedSidebar, setCollapsedSidebar] = useState(false)
  useEffect(() => {
    void useSanctuaryStore.getState().bootstrap()
    return window.sanctuaryAPI.onBeforeClose(() => useSanctuaryStore.getState().flush())
  }, [])
  useLayoutEffect(() => {
    document.documentElement.dataset.reducedMotion = String(room.reducedMotion)
  }, [room.reducedMotion])
  useLayoutEffect(() => {
    if (ready) applyInterfaceTheme(interfaceTheme)
  }, [ready, interfaceTheme])
  useEffect(() => {
    void audio.update(room).catch(useSanctuaryStore.getState().report)
  }, [room.sound, room.volume, room.rain, room.fireplaceActive, room.radioPlaying])
  useEffect(() => () => audio.stop(), [])
  return (
    <>
      <TitleBar />
      {ready ? (
        <div
          className={`app-shell ${activeBookId ? 'journal-is-open' : ''}`}
          inert={activeBookId ? true : undefined}
        >
          <Sidebar
            onSettings={() => setSettingsOpen(true)}
            collapsed={collapsedSidebar}
            onToggle={() => setCollapsedSidebar((value) => !value)}
          />
          <main
            className={`main-content ${view === 'room' ? 'room-content' : ''}`}
            data-view={view}
          >
            {view === 'room' ? (
              <Suspense
                fallback={
                  <div className="app-loading">
                    <LoaderCircle className="spin" />
                    Открываем комнату…
                  </div>
                }
              >
                <RoomView
                  onAdd={() => {
                    setNewBookStatus('READ')
                    setBookModal('new')
                  }}
                />
              </Suspense>
            ) : view === 'library' || view === 'wishlist' || view === 'shelf' ? (
              <Library
                onAdd={(status = 'READ') => {
                  setNewBookStatus(status)
                  setBookModal('new')
                }}
                onEdit={setBookModal}
              />
            ) : view === 'quotes' ? (
              <QuotesView />
            ) : view === 'progress' ? (
              <ProgressView />
            ) : (
              <StoryView />
            )}
          </main>
        </div>
      ) : (
        <div className="app-loading">
          <BookOpen size={48} strokeWidth={1} />
          <h1>Тихая глава</h1>
          <p>
            <LoaderCircle className="spin" size={16} />
            Открываем вашу библиотеку…
          </p>
        </div>
      )}
      {bookModal && (
        <AddBookModal
          book={bookModal === 'new' ? undefined : bookModal}
          status={newBookStatus}
          onClose={() => setBookModal(null)}
        />
      )}{' '}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}{' '}
      {activeBookId && <JournalSpreadModal />}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <Leaf size={16} />
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button
            aria-label="Скрыть сообщение об ошибке"
            onClick={() => useSanctuaryStore.setState({ error: null })}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
