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

createRoot(document.getElementById('root')!).render(<App />)
