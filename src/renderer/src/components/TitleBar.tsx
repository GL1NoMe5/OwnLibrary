import { Minus, Square, X, Volume2, VolumeX, CloudRain, BookOpen } from 'lucide-react'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
export function TitleBar() {
  const settings = useSanctuaryStore((s) => s.settings)
  const saveSettings = useSanctuaryStore((s) => s.saveSettings)
  const toggle = (key: 'sound' | 'rain') =>
    void saveSettings({
      ...settings,
      room: { ...settings.room, [key]: !settings.room[key] },
    }).catch(useSanctuaryStore.getState().report)
  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <BookOpen size={15} />
        <span>Cozy Reader’s Sanctuary</span>
      </div>
      <div className="titlebar-actions">
        <button
          title={settings.room.rain ? 'Выключить дождь' : 'Звуки дождя'}
          className={settings.room.rain ? 'active' : ''}
          onClick={() => toggle('rain')}
        >
          <CloudRain size={16} />
        </button>
        <button
          title={settings.room.sound ? 'Выключить звук' : 'Включить звуки уюта'}
          onClick={() => toggle('sound')}
        >
          {settings.room.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <span className="titlebar-separator" />
        <button aria-label="Свернуть" onClick={() => window.sanctuaryAPI.minimize()}>
          <Minus size={16} />
        </button>
        <button aria-label="Развернуть" onClick={() => window.sanctuaryAPI.maximize()}>
          <Square size={12} />
        </button>
        <button
          className="window-close"
          aria-label="Закрыть приложение"
          onClick={() => window.sanctuaryAPI.close()}
        >
          <X size={17} />
        </button>
      </div>
    </header>
  )
}
