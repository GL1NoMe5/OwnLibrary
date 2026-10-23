import { useState } from 'react'
import { version } from '../../../../package.json'
import {
  Volume2,
  CloudRain,
  Flame,
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  LoaderCircle,
  Image,
  RotateCcw,
} from 'lucide-react'
import { useSanctuaryStore } from '../store/useSanctuaryStore'
import type { InterfaceTheme } from '../../../shared/types'
import { Modal } from './Modal'
import './theme-picker.css'
import './room-picture-settings.css'

const interfaceThemes: { value: InterfaceTheme; label: string; description: string }[] = [
  { value: 'light', label: 'Светлая', description: 'Бумага и шалфей' },
  { value: 'dark', label: 'Тёмная', description: 'Тёплый графит' },
  { value: 'christmas', label: 'Рождественская', description: 'Хвоя и золото' },
]

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings, books, report, notify, refreshBooks, bootstrap } =
    useSanctuaryStore()
  const [busy, setBusy] = useState(false)
  const room = settings.room
  const change = (patch: Partial<typeof room>) =>
    void saveSettings({ ...settings, room: { ...room, ...patch } }).catch(report)
  async function savePicture(pictureUrl: string | null) {
    const current = useSanctuaryStore.getState()
    await current.saveSettings({
      ...current.settings,
      room: { ...current.settings.room, pictureUrl },
    })
  }
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      report(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Настроение и забота о библиотеке"
      onClose={() => {
        if (!busy) onClose()
      }}
      className="settings-modal"
    >
      <div className="settings-body">
        <fieldset className="theme-picker" disabled={busy}>
          <legend className="eyebrow">ОФОРМЛЕНИЕ ИНТЕРФЕЙСА</legend>
          <div className="theme-options">
            {interfaceThemes.map((theme) => (
              <label className={`theme-option theme-option-${theme.value}`} key={theme.value}>
                <input
                  type="radio"
                  name="interface-theme"
                  value={theme.value}
                  checked={settings.interfaceTheme === theme.value}
                  onChange={() =>
                    void saveSettings({ ...settings, interfaceTheme: theme.value }).catch(report)
                  }
                />
                <span className="theme-option-card">
                  <span className="theme-option-swatches" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-option-title">{theme.label}</span>
                  <small>{theme.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="settings-divider" />
        <span className="eyebrow">ЗВУКИ ТИХОГО ВЕЧЕРА</span>
        <label className="toggle-row">
          <span>
            <Volume2 size={19} />
            Звуки уюта<small>Включайте, когда хочется замедлиться</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={room.sound}
            onChange={(e) => change({ sound: e.target.checked })}
          />
        </label>
        <div className="form-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={room.rain}
              onChange={(e) => change({ rain: e.target.checked })}
            />
            <CloudRain size={17} />
            Дождь за окном
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={room.fireplaceActive}
              onChange={(e) => change({ fireplaceActive: e.target.checked })}
            />
            <Flame size={17} />
            Камин и его треск
          </label>
        </div>
        <label className="volume-control">
          Громкость
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={room.volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
          />
          <small>{Math.round(room.volume * 100)}%</small>
        </label>
        <div className="settings-divider" />
        <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО</span>
        <fieldset className="room-picture-settings" disabled={busy}>
          <legend>Картина над камином</legend>
          <div className="room-picture-options">
            <div className="room-picture-preview">
              {room.pictureUrl ? (
                <img src={room.pictureUrl} alt="Ваша фотография над камином" />
              ) : (
                <Image size={28} strokeWidth={1.2} aria-hidden="true" />
              )}
            </div>
            <div className="room-picture-controls">
              <small>Вертикальное или горизонтальное фото — целиком, без обрезки.</small>
              <div className="room-picture-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    void run(async () => {
                      const url = await window.sanctuaryAPI.importImage()
                      if (url) await savePicture(url)
                    })
                  }
                >
                  <Upload size={15} />
                  {room.pictureUrl ? 'Заменить фото' : 'Выбрать фото'}
                </button>
                {room.pictureUrl && (
                  <button
                    className="button secondary room-picture-reset"
                    onClick={() => void run(() => savePicture(null))}
                  >
                    <RotateCcw size={14} />
                    Вернуть картину
                  </button>
                )}
              </div>
            </div>
          </div>
        </fieldset>
        <label>
          Дерево книжных полок
          <select
            value={room.woodTheme}
            onChange={(e) => change({ woodTheme: e.target.value as typeof room.woodTheme })}
          >
            <option value="WALNUT">Тёплый орех</option>
            <option value="OAK">Светлый дуб</option>
            <option value="MAHOGANY">Красное дерево</option>
          </select>
        </label>
        <label>
          Качество графики комнаты
          <select
            aria-label="Качество графики комнаты"
            value={room.quality}
            onChange={(e) => change({ quality: e.target.value as typeof room.quality })}
          >
            <option value="LOW">Экономное — без теней, до 30 кадров/с</option>
            <option value="MEDIUM">Сбалансированное — мягкие тени</option>
            <option value="HIGH">Высокое — тени и свечение</option>
          </select>
        </label>
        <label className="toggle-row">
          <span>
            Гирлянды<small>Тёплые огоньки над полками</small>
          </span>
          <input
            role="switch"
            type="checkbox"
            checked={room.fairyLights}
            onChange={(e) => change({ fairyLights: e.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>
            Уменьшить анимацию<small>Меньше движения в интерфейсе и комнате</small>
          </span>
          <input
            role="switch"
            type="checkbox"
            checked={room.reducedMotion}
            onChange={(e) => change({ reducedMotion: e.target.checked })}
          />
        </label>
        <div className="settings-divider" />
        <span className="eyebrow">ВАШИ ДАННЫЕ</span>
        <div className="data-note">
          <ShieldCheck size={25} strokeWidth={1.3} />
          <p>
            Книги, записи и фотографии хранятся на вашем компьютере. Архив поможет сохранить их или
            перенести на другой.
          </p>
        </div>
        <div className="backup-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (await window.sanctuaryAPI.exportBackup()) notify('Резервная копия сохранена')
              })
            }
          >
            <Download size={17} />
            Сохранить архив
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (await window.sanctuaryAPI.importBackup()) {
                  await bootstrap()
                  notify('Библиотека восстановлена')
                }
              })
            }
          >
            <Upload size={17} />
            Восстановить
          </button>
        </div>
        {books.some((b) => b.isDemo) && (
          <button
            className="remove-demo"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Удалить все демонстрационные книги и их дневники? Ваши книги останутся.',
                )
              )
                void run(async () => {
                  await window.sanctuaryAPI.removeDemo()
                  await refreshBooks()
                  notify('Примеры удалены. Теперь здесь только ваши истории.')
                })
            }}
          >
            <Trash2 size={15} />
            Убрать демонстрационные книги
          </button>
        )}
        {busy && (
          <p className="loading-line">
            <LoaderCircle className="spin" size={17} />
            Пожалуйста, подождите…
          </p>
        )}
        <small className="version-label">Cozy Reader’s Sanctuary · {version}</small>
      </div>
    </Modal>
  )
}
