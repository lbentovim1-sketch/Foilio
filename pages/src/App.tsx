import { useState } from 'react'
import './App.css'
import DigestPage from './pages/DigestPage'
import ProfilePage from './pages/ProfilePage'
import type { WatchlistItem } from './types'
import { DEFAULT_WATCHLIST } from './types'

const STORAGE_KEY = 'snipecard_watchlist'

function loadWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_WATCHLIST.map((d, i) => ({
    ...d, id: `default_${i}`, profile_id: '', created_at: new Date().toISOString(),
  }))
}

type Page = 'digest' | 'watchlist'

export default function App() {
  const [page, setPage] = useState<Page>('digest')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(loadWatchlist)

  function saveWatchlist(items: WatchlistItem[]) {
    setWatchlist(items)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">🎯</div>
          <div className="logo-text">Snipe<span>Card</span></div>
        </div>
        <nav className="nav">
          <button className={`nav-link ${page === 'digest' ? 'active' : ''}`} onClick={() => setPage('digest')}>
            <span className="nav-icon">📊</span>Daily Digest
          </button>
          <button className={`nav-link ${page === 'watchlist' ? 'active' : ''}`} onClick={() => setPage('watchlist')}>
            <span className="nav-icon">👁️</span>Watchlist
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Monitoring</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{watchlist.filter(w => w.active).length}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>active targets</div>
        </div>
      </aside>
      <main className="main">
        {page === 'digest' && <DigestPage watchlist={watchlist} />}
        {page === 'watchlist' && <ProfilePage watchlist={watchlist} onSave={saveWatchlist} />}
      </main>
    </div>
  )
}
