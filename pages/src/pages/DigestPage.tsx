import { useState, useCallback, useRef, useEffect } from 'react'
import type { WatchlistItem, ScanResult } from '../types'

interface Props {
  watchlist: WatchlistItem[]
}

interface PlayerScanState {
  status: 'idle' | 'scanning' | 'done' | 'error'
  results: ScanResult[]
  error?: string
  totalFound?: number
  scannedAt?: string
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

function formatPrice(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`
}

function formatDiscount(pct: number): string {
  if (pct === 0) return '0%'
  return `${pct > 0 ? '-' : '+'}${Math.abs(pct).toFixed(1)}%`
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return `${Math.floor(h / 24)}d`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function isUrgent(dateStr?: string): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() - Date.now() < 3600000 * 4
}

function sportEmoji(sport: string | null): string {
  const map: Record<string, string> = {
    basketball: '🏀', baseball: '⚾', tennis: '🎾',
    soccer: '⚽', football: '🏈', tcg: '🃏', other: '🎴',
  }
  return map[sport ?? ''] ?? '🃏'
}

interface DealCardProps {
  result: ScanResult
}

function DealCard({ result }: DealCardProps) {
  const { listing, score } = result
  const [showAnalysis, setShowAnalysis] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)
  const price = parseFloat(listing.price?.value || '0')
  const discountPositive = score.discountPercent > 0
  const hasComp = !!(score.lastCompPrice || score.estimatedValue)

  useEffect(() => {
    if (analysisRef.current) {
      analysisRef.current.style.maxHeight = showAnalysis
        ? `${analysisRef.current.scrollHeight}px`
        : '0px'
    }
  }, [showAnalysis])

  return (
    <div className={`deal-card grade-${score.grade}`}>
      {/* Image */}
      <div className="deal-card-img-wrap">
        {listing.imageUrl
          ? <img className="deal-card-image" src={listing.imageUrl} alt={listing.title} loading="lazy" />
          : <div className="deal-card-image-placeholder">🃏</div>
        }
        <div className={`grade-pill grade-${score.grade}`}>{score.grade}</div>
        {listing.itemEndDate && isUrgent(listing.itemEndDate) && (
          <div className="ending-pill urgent">⏱ {timeUntil(listing.itemEndDate)}</div>
        )}
      </div>

      <div className="deal-card-body">
        {/* Title */}
        <div className="deal-card-title">{listing.title}</div>

        {/* Price + score row */}
        <div className="deal-price-row">
          <span className="deal-price">{price > 0 ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>
          {score.discountPercent !== 0 && hasComp && Math.abs(score.discountPercent) <= 95 && (
            <span className={`deal-discount ${discountPositive ? 'positive' : 'negative'}`}>
              {formatDiscount(score.discountPercent)}
            </span>
          )}
          {listing.itemEndDate && !isUrgent(listing.itemEndDate) && (
            <span className="auction-timer" style={{ marginLeft: 'auto', fontSize: 11 }}>
              ⏱ {timeUntil(listing.itemEndDate)}
            </span>
          )}
        </div>

        {/* Score bar */}
        <div className="score-bar-wrap">
          <div className="score-bar">
            <div className="score-bar-fill" style={{ width: `${score.score}%` }} />
          </div>
          <span className="score-num">{score.score}</span>
        </div>

        {/* Comp snapshot */}
        <div className="comp-snapshot">
          <div className="comp-cell">
            <span className="comp-label">Last Sold</span>
            <span className="comp-value">
              {score.lastCompPrice && score.lastCompDate
                ? <>{formatPrice(score.lastCompPrice)} <span className="comp-date">· {new Date(score.lastCompDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>
                : <span style={{ color: 'var(--text4)' }}>—</span>
              }
            </span>
          </div>
          <div className="comp-cell">
            <span className="comp-label">Est. Value</span>
            <span className="comp-value">
              {score.estimatedValue ? formatPrice(score.estimatedValue) : <span style={{ color: 'var(--text4)' }}>—</span>}
            </span>
          </div>
          <div className="comp-cell">
            <span className="comp-label">{score.trend7dPercent !== null ? '7d Trend' : 'Comps'}</span>
            <span className="comp-value">
              {score.trend7dPercent !== null
                ? <span style={{ color: score.trend7dPercent >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
                    {score.trend7dPercent >= 0 ? '↑' : '↓'} {Math.abs(score.trend7dPercent).toFixed(1)}%
                  </span>
                : score.compCount > 0
                  ? `${score.compCount} sales`
                  : <span style={{ color: 'var(--text4)' }}>—</span>
              }
            </span>
          </div>
        </div>

        {/* AI Analysis toggle */}
        <button
          className="ai-toggle-btn"
          onClick={() => setShowAnalysis(p => !p)}
        >
          <span className="ai-toggle-icon">✦</span>
          <span>AI Analysis</span>
          <span className={`conf-dot conf-${score.confidence}`} />
          <span className="ai-toggle-chevron">{showAnalysis ? '▲' : '▼'}</span>
        </button>
        <div ref={analysisRef} className="ai-analysis-panel">
          <div className="ai-analysis-inner">{score.aiSummary}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="deal-card-footer">
        <div className="seller-info">
          <span className="seller-name">{listing.seller.username}</span>
          <span className="seller-sep">·</span>
          <span>{listing.seller.feedbackPercentage}%</span>
        </div>
        <a
          href={listing.itemWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          View ↗
        </a>
      </div>
    </div>
  )
}

export default function DigestPage({ watchlist }: Props) {
  const activeItems = watchlist.filter(w => w.active)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [scanStates, setScanStates] = useState<Record<string, PlayerScanState>>({})
  const [scanning, setScanning] = useState(false)

  const updateScan = useCallback((id: string, update: Partial<PlayerScanState>) => {
    setScanStates(prev => ({ ...prev, [id]: { ...prev[id], ...update } }))
  }, [])

  async function scanPlayer(item: WatchlistItem) {
    if (!WORKER_URL) {
      updateScan(item.id, { status: 'error', error: 'VITE_WORKER_URL not set. Add it to .env.local', results: [] })
      return
    }
    updateScan(item.id, { status: 'scanning', results: [], error: undefined })
    try {
      const res = await fetch(`${WORKER_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: item.player_name,
        sport: item.sport,
        cardTypes: item.card_types,
        years: item.years ?? [],
        sets: item.sets ?? [],
        grades: item.grades ?? [],
        maxPriceUsd: item.max_price_usd ?? undefined,
        minPriceUsd: item.min_price_usd ?? undefined,
        limit: 5,
      }),
      })
      if (!res.ok) throw new Error(`Worker error ${res.status}`)
      const data = await res.json() as {
        success: boolean; results: ScanResult[]; totalFound: number; scannedAt: string; error?: string
      }
      if (!data.success) throw new Error(data.error || 'Scan failed')
      updateScan(item.id, {
        status: 'done',
        results: data.results,
        totalFound: data.totalFound,
        scannedAt: data.scannedAt,
      })
    } catch (e: any) {
      console.error('Scan error:', e)
      updateScan(item.id, { status: 'error', error: e.message || 'Unknown error — check console (F12)', results: [] })
    }
  }

  async function scanAll() {
    setScanning(true)
    for (const item of activeItems) {
      await scanPlayer(item)
    }
    setScanning(false)
  }

  const allResults: ScanResult[] = Object.values(scanStates)
    .flatMap(s => s.results)
    .sort((a, b) => b.score.score - a.score.score)

  const displayResults = selectedPlayer
    ? (scanStates[selectedPlayer]?.results ?? [])
    : allResults

  const totalScanned = Object.values(scanStates).reduce((acc, s) => acc + (s.totalFound ?? 0), 0)
  const totalDeals = allResults.length
  const topScore = allResults[0]?.score.score ?? 0

  const anyScanned = Object.keys(scanStates).length > 0

  return (
    <>
      <div className="page-header">
        <div className="page-title">Daily Digest</div>
        <div className="page-subtitle">Scan your watchlist for underpriced cards on eBay</div>
      </div>

      <div className="digest-wrap">
        {!WORKER_URL && (
          <div className="error-banner">
            ⚠️ <strong>VITE_WORKER_URL</strong> is not set. Create <code>pages/.env.local</code> with your worker URL to enable scanning.
          </div>
        )}

        {anyScanned && (
          <div className="digest-stats">
            <div className="stat-card">
              <div className="stat-value">{totalScanned}</div>
              <div className="stat-label">Listings Scanned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value accent">{totalDeals}</div>
              <div className="stat-label">Deals Scored</div>
            </div>
            <div className="stat-card">
              <div className={`stat-value ${topScore >= 75 ? 'accent' : ''}`}>{topScore}</div>
              <div className="stat-label">Top Score</div>
            </div>
          </div>
        )}

        <div className="digest-controls">
          <div className="player-pills">
            <button
              className={`pill ${selectedPlayer === null ? 'active' : ''}`}
              onClick={() => setSelectedPlayer(null)}
            >
              All
              {allResults.length > 0 && <span className="pill-count">{allResults.length}</span>}
            </button>
            {activeItems.map(item => {
              const state = scanStates[item.id]
              const count = state?.results.length ?? 0
              return (
                <button
                  key={item.id}
                  className={`pill ${selectedPlayer === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlayer(item.id)}
                >
                  {sportEmoji(item.sport)} {item.player_name}
                  {state?.status === 'scanning' && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
                  {count > 0 && <span className="pill-count">{count}</span>}
                  {state?.status === 'error' && <span style={{ color: 'var(--danger)' }}>!</span>}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {selectedPlayer && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const item = activeItems.find(i => i.id === selectedPlayer)
                  if (item) scanPlayer(item)
                }}
                disabled={scanStates[selectedPlayer]?.status === 'scanning'}
              >
                {scanStates[selectedPlayer]?.status === 'scanning'
                  ? <><span className="spinner" />Scanning…</>
                  : '🔍 Scan'}
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={scanAll}
              disabled={scanning || activeItems.length === 0}
            >
              {scanning
                ? <><span className="spinner" />Scanning all…</>
                : `⚡ Scan All (${activeItems.length})`}
            </button>
          </div>
        </div>

        {Object.entries(scanStates).filter(([, s]) => s.status === 'error').map(([id, s]) => {
          const item = activeItems.find(i => i.id === id)
          return (
            <div key={id} className="error-banner">
              ⚠️ <strong>{item?.player_name ?? id}:</strong> {s.error}
            </div>
          )
        })}

        {displayResults.length > 0 ? (
          <div className="results-grid">
            {displayResults.map(r => (
              <DealCard key={r.listing.itemId} result={r} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <div className="empty-title">
              {activeItems.length === 0 ? 'No active watchlist items' : 'Ready to snipe'}
            </div>
            <div className="empty-desc">
              {activeItems.length === 0
                ? 'Go to Watchlist and add players to monitor.'
                : 'Click "Scan All" to discover underpriced cards across your watchlist.'}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
