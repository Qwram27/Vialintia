import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist-mono'
import './styles/theme.css'
import { installPlatform, isWeb } from './platform'
import { App } from './App'

installPlatform()

if (isWeb) {
  document.documentElement.classList.add('is-web')
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.error('Service worker failed', err))
    })
  }
}

// iOS Home Screen apps with a translucent status bar can report a viewport that is one
// status-bar shorter than the screen, leaving a black band under the tab bar. On phones in
// standalone mode, size the app to the real screen height instead.
const nav = navigator as Navigator & { standalone?: boolean }
const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
const syncAppHeight = () => {
  let h = window.innerHeight
  if (standalone && window.innerWidth <= 700) {
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    h = Math.max(h, screenH)
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`)
}
syncAppHeight()
window.addEventListener('resize', syncAppHeight)
window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 300))

createRoot(document.getElementById('root')!).render(<App />)
