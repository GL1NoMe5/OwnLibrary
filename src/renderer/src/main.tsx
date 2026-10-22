import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/caveat/400.css'
import '@fontsource/marck-script/400.css'
import './styles.css'
import { App } from './App'
import { restoreInterfaceAppearance } from './interfaceAppearance'
import './ui-themes.css'
import './ui-motion.css'

restoreInterfaceAppearance()

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  render() {
    if (this.state.error)
      return (
        <div className="app-loading">
          <h1>Не удалось открыть страницу</h1>
          <p>{this.state.error}</p>
          <button className="button primary" onClick={() => location.reload()}>
            Открыть приложение заново
          </button>
        </div>
      )
    return this.props.children
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
