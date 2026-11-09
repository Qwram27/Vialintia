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

// Visible viewport (shrinks when the iOS keyboard is open) → CSS vars for full-height sheets.
const vv = window.visualViewport
const syncViewport = () => {
  const st = document.documentElement.style
  st.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`)
  st.setProperty('--vvt', `${vv ? vv.offsetTop : 0}px`)
}
syncViewport()
vv?.addEventListener('resize', syncViewport)
vv?.addEventListener('scroll', syncViewport)
window.addEventListener('resize', syncViewport)

createRoot(document.getElementById('root')!).render(<App />)
