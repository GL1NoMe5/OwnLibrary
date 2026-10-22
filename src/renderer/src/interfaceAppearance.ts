import type { InterfaceTheme } from '../../shared/types'

const storageKey = 'sanctuary-interface-theme'
const isTheme = (value: string | null): value is InterfaceTheme =>
  value === 'light' || value === 'dark' || value === 'christmas'

// SQLite remains authoritative. This small cache prevents a bright first frame on restart.
export function restoreInterfaceAppearance() {
  try {
    const cached = localStorage.getItem(storageKey)
    if (isTheme(cached)) document.documentElement.dataset.theme = cached
  } catch {
    // The library can still load its saved theme if browser storage is unavailable.
  }
}

export function applyInterfaceTheme(theme: InterfaceTheme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    // Saving the actual preference uses the application's normal settings path.
  }
}
