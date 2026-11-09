import { useEffect, useMemo, useRef, useState } from 'react'
import { useSaveState, useStore } from '@/store/store'
import { navigate, useRoute, type Route } from '@/store/ui'
import { catalogNo } from '@/lib/archive'
import { Dashboard } from '@/views/Dashboard'
import { FormulaEditor } from '@/views/FormulaEditor'
import { Library } from '@/views/Library'
import { Compare } from '@/views/Compare'
import { SettingsView } from '@/views/Settings'
import { ConfirmHost, ToastHost } from '@/components/Overlays'

const NAV = [
  { key: 'dashboard', label: 'Formulas', path: '/' },
  { key: 'library', label: 'Materials', path: '/library' },
  { key: 'compare', label: 'Compare', path: '/compare' },
  { key: 'settings', label: 'Settings', path: '/settings' }
] as const

export function App() {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  const formulas = useStore((s) => s.formulas)
  const noteColors = useStore((s) => s.settings.noteColors)
  const route = useRoute()
  const mainRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--note-top', noteColors.top)
    root.setProperty('--note-heart', noteColors.heart)
    root.setProperty('--note-base', noteColors.base)
  }, [noteColors])

  // Reset scroll on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [route.name, route.name === 'formula' ? route.id : ''])

  const recent = useMemo(() => [...formulas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6), [formulas])

  if (!ready) return <div style={{ height: '100%', background: '#000' }} />

  const active = route.name === 'formula' ? 'dashboard' : route.name

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand drag">
          <div className="brand-name">VIALINTIA</div>
          <div className="brand-sub">Formulation archive</div>
          <div className="brand-rule" />
        </div>
        <nav className="nav">
          {NAV.map((n, i) => (
            <button key={n.key} className={`nav-item${active === n.key ? ' active' : ''}`} onClick={() => navigate(n.path)}>
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              {n.label}
            </button>
          ))}
        </nav>
        {recent.length > 0 && (
          <>
            <div className="nav-section">
              <span>Recent</span>
              <span>{String(formulas.length).padStart(3, '0')}</span>
            </div>
            <nav className="nav">
              {recent.map((f) => (
                <button
                  key={f.id}
                  className={`nav-item recent-item${route.name === 'formula' && route.id === f.id ? ' active' : ''}`}
                  onClick={() => navigate(`/formula/${f.id}`)}
                  title={f.name}
                >
                  <span className="idx">{catalogNo(f, formulas)}</span>
                  <span>{f.name}</span>
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-foot">
          <span>Offline</span>
          <span>v1.2</span>
        </div>
      </aside>
      <main className="main" ref={mainRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
        <TopBar route={route} scrolled={scrolled} />
        {route.name === 'dashboard' && <Dashboard />}
        {route.name === 'formula' && <FormulaEditor key={route.id} id={route.id} />}
        {route.name === 'library' && <Library />}
        {route.name === 'compare' && <Compare a={route.a} b={route.b} />}
        {route.name === 'settings' && <SettingsView />}
      </main>
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}

function TopBar({ route, scrolled }: { route: Route; scrolled: boolean }) {
  const formulas = useStore((s) => s.formulas)
  const saving = useSaveState((s) => s.saving)
  const formula = route.name === 'formula' ? formulas.find((f) => f.id === route.id) : undefined
  const idx = NAV.findIndex((n) => n.key === (route.name === 'formula' ? 'dashboard' : route.name))
  const section = NAV[idx]

  return (
    <div className={`topbar drag${scrolled ? ' scrolled' : ''}`}>
      <div className="crumb">
        <span>Vialintia</span>
        <span className="sep">/</span>
        {formula ? (
          <>
            <button onClick={() => navigate('/')}>
              {String(idx + 1).padStart(2, '0')} {section.label}
            </button>
            <span className="sep">/</span>
            <span className="cur">
              N°{catalogNo(formula, formulas)} {formula.name}
            </span>
          </>
        ) : (
          <span className="cur">
            {String(idx + 1).padStart(2, '0')} {section.label}
          </span>
        )}
      </div>
      <div className={`savestate${saving ? ' saving' : ''}`}>
        <i />
        {saving ? 'Saving' : 'Saved'}
      </div>
    </div>
  )
}
