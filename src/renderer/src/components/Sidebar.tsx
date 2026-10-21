import {
  LibraryBig,
  Bookmark,
  Quote,
  ChartNoAxesCombined,
  Image,
  Settings2,
  BookOpen,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useSanctuaryStore, type View } from '../store/useSanctuaryStore'
const links: { view: View; label: string; icon: typeof BookOpen }[] = [
  { view: 'library', label: 'Моя библиотека', icon: LibraryBig },
  { view: 'wishlist', label: 'Хочу прочитать', icon: Bookmark },
  { view: 'quotes', label: 'Цитаты и заметки', icon: Quote },
  { view: 'progress', label: 'Мой прогресс', icon: ChartNoAxesCombined },
  { view: 'story', label: 'Итоги чтения', icon: Image },
]
export function Sidebar({
  onSettings,
  collapsed,
  onToggle,
}: {
  onSettings: () => void
  collapsed: boolean
  onToggle: () => void
}) {
  const { view, setView, books } = useSanctuaryStore()
  const count = books.filter((b) => b.status === 'READ' && !b.isDemo).length
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        onClick={onToggle}
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>
      <div className="brand">
        <div className="brand-mark">
          <BookOpen size={26} strokeWidth={1.3} />
          <Leaf size={15} />
        </div>
        <div>
          Тихая глава<span>место для ваших историй</span>
        </div>
      </div>
      <div className="nav-caption">ВАШ ЧИТАТЕЛЬСКИЙ УГОЛОК</div>
      <nav>
        {links.map((link) => (
          <button
            key={link.view}
            aria-label={link.label}
            title={collapsed ? link.label : undefined}
            className={
              view === link.view || (view === 'shelf' && link.view === 'library')
                ? 'nav-link active'
                : 'nav-link'
            }
            onClick={() => setView(link.view)}
          >
            <link.icon size={19} strokeWidth={1.5} />
            <span>{link.label}</span>
            {link.view === 'wishlist' && (
              <small>{books.filter((b) => b.status === 'WISHLIST').length}</small>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <Leaf size={23} strokeWidth={1.2} />
          <p>
            Самые тихие вечера
            <br />
            оставляют самые
            <br />
            <em>тёплые истории.</em>
          </p>
        </div>
        <button
          className="settings-link"
          aria-label="Настроение и настройки"
          title={collapsed ? 'Настроение и настройки' : undefined}
          onClick={onSettings}
        >
          <Settings2 size={18} />
          <span>Настроение и настройки</span>
        </button>
        <div className="profile">
          <div className="profile-avatar">ТГ</div>
          <div>
            Моя тихая глава
            <small>
              {count} {count === 1 ? 'прочитанная книга' : 'прочитанных книг'}
            </small>
          </div>
          <span className="online-dot" title="Данные хранятся на вашем компьютере" />
        </div>
      </div>
    </aside>
  )
}
