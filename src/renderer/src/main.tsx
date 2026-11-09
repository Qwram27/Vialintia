import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist-mono'
import './styles/theme.css'
import { installPlatform, isWeb } from './platform'
import { flushAll } from './store/store'
import { App } from './App'

installPlatform()

if (isWeb) {
  document.documentElement.classList.add('is-web')
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // iOS keeps Home Screen apps alive in memory, so a reopen does not reload the page. Check for a
    // new release whenever the app comes back to the foreground; when the new service worker takes
    // over, save pending edits and reload once.
    const hadController = !!navigator.serviceWorker.controller
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return
      reloading = true
      flushAll()
      setTimeout(() => location.reload(), 400)
    })
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          const check = () => reg.update().catch(() => undefined)
          document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
          setInterval(check, 30 * 60 * 1000)
        })
        .catch((err) => console.error('Service worker failed', err))
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
