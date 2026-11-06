import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppStateProvider } from './state/AppState'
import { ToastProvider } from './state/Toasts'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppStateProvider>
  </StrictMode>,
)

// Service worker apenas em produção normal (não no build de ficheiro único).
if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
