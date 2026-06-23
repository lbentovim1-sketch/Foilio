import { useState } from 'react'
import type { WatchlistItem } from '../types'
import { SPORTS, CARD_TYPES, CARD_YEARS, CARD_SETS, CARD_GRADES } from '../types'

interface Props {
  watchlist: WatchlistItem[]
  onSave: (items: WatchlistItem[]) => void
}

function sportEmoji(sport: string | null): string {
  const map: Record<string, string> = {
    basketball: '🏀', baseball: '⚾', tennis: '🎾',
    soccer: '⚽', football: '🏈', tcg: '🃏', other: '🎴',
  }
  return map[sport ?? ''] ?? '🃏'
}

function sportLabel(sport: string | null): string {
  return SPORTS.find(s => s.value === sport)?.label ?? sport ?? 'Unknown'
}

const BLANK: Omit<WatchlistItem, 'id' | 'profile_id' | 'created_at'> = {
  player_name: '',
  sport: null,
  card_types: ['serialized'],
  years: [],
  sets: [],
  grades: [],
  min_serial_print_run: null,
  max_price_usd: null,
  min_price_usd: null,
  keywords: [],
  active: true,
}

interface FormState {
  player_name: string
  sport: string
  card_types: string[]
  years: string[]
  sets_text: string
  grades: string[]
  max_price_usd: string
  min_price_usd: string
  keywords: string
}

function itemToForm(item: WatchlistItem): FormState {
  return {
    player_name: item.player_name,
    sport: item.sport ?? '',
    card_types: [...item.card_types],
    years: [...(item.years ?? [])],
    sets_text: (item.sets ?? []).join(', '),
    grades: [...(item.grades ?? [])],
    max_price_usd: item.max_price_usd != null ? String(item.max_price_usd) : '',
    min_price_usd: item.min_price_usd != null ? String(item.min_price_usd) : '',
    keywords: item.keywords.join(', '),
  }
}

function formToItem(form: FormState, base: WatchlistItem): WatchlistItem {
  return {
    ...base,
    player_name: form.player_name.trim(),
    sport: form.sport || null,
    card_types: form.card_types,
    years: form.years,
    sets: form.sets_text.split(',').map(s => s.trim()).filter(Boolean),
    grades: form.grades,
    max_price_usd: form.max_price_usd ? parseFloat(form.max_price_usd) : null,
    min_price_usd: form.min_price_usd ? parseFloat(form.min_price_usd) : null,
    keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
  }
}

interface WatchlistFormProps {
  title: string
  initial: FormState
  onSubmit: (form: FormState) => void
  onCancel: () => void
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  )
}

function WatchlistForm({ title, initial, onSubmit, onCancel }: WatchlistFormProps) {
  const [form, setForm] = useState<FormState>(initial)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{title}</div>

        {/* ── Player & Sport ── */}
        <div className="field">
          <label>Player / Card Name *</label>
          <input
            type="text"
            placeholder="e.g. Jalen Brunson"
            value={form.player_name}
            onChange={e => setForm(p => ({ ...p, player_name: e.target.value }))}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Sport</label>
          <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}>
            <option value="">Select sport…</option>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* ── Card Type ── */}
        <SectionLabel>Card Type</SectionLabel>
        <div className="checkbox-group" style={{ marginBottom: 16 }}>
          {CARD_TYPES.map(ct => (
            <label key={ct.value} className={`checkbox-item ${form.card_types.includes(ct.value) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={form.card_types.includes(ct.value)}
                onChange={() => setForm(p => ({ ...p, card_types: toggle(p.card_types, ct.value) }))}
              />
              <span>{ct.label}</span>
            </label>
          ))}
        </div>

        {/* ── Grade ── */}
        <SectionLabel>Graded Cards Only (leave blank for any)</SectionLabel>
        <div className="checkbox-group" style={{ marginBottom: 16 }}>
          {CARD_GRADES.map(g => (
            <label key={g.value} className={`checkbox-item ${form.grades.includes(g.value) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={form.grades.includes(g.value)}
                onChange={() => setForm(p => ({ ...p, grades: toggle(p.grades, g.value) }))}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>

        {/* ── Years ── */}
        <SectionLabel>Year(s) (leave blank for any)</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {CARD_YEARS.map(y => (
            <button
              key={y}
              type="button"
              className={`pill ${form.years.includes(y) ? 'active' : ''}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setForm(p => ({ ...p, years: toggle(p.years, y) }))}
            >
              {y}
            </button>
          ))}
        </div>

        {/* ── Sets ── */}
        <div className="field">
          <label>Set / Brand (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. Prizm, Optic, Topps Chrome"
            value={form.sets_text}
            onChange={e => setForm(p => ({ ...p, sets_text: e.target.value }))}
          />
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CARD_SETS.map(s => (
              <button
                key={s}
                type="button"
                className="tag"
                style={{ cursor: 'pointer', fontSize: 11 }}
                onClick={() => {
                  const current = form.sets_text.split(',').map(x => x.trim()).filter(Boolean)
                  if (!current.includes(s)) {
                    setForm(p => ({ ...p, sets_text: [...current, s].join(', ') }))
                  }
                }}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Price Range ── */}
        <SectionLabel>Price Range</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Min Price ($)</label>
            <input
              type="number"
              placeholder="e.g. 20"
              min={0}
              step={1}
              value={form.min_price_usd}
              onChange={e => setForm(p => ({ ...p, min_price_usd: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Max Price ($)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              min={0}
              step={1}
              value={form.max_price_usd}
              onChange={e => setForm(p => ({ ...p, max_price_usd: e.target.value }))}
            />
          </div>
        </div>

        {/* ── Keywords ── */}
        <div className="field">
          <label>Extra Keywords (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. /25, /10, 1/1, rookie"
            value={form.keywords}
            onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(form)}
            disabled={!form.player_name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage({ watchlist, onSave }: Props) {
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  function handleAdd(form: FormState) {
    const id = `local_${Date.now()}`
    const newItem: WatchlistItem = formToItem(form, {
      ...BLANK, id, profile_id: '', created_at: new Date().toISOString(),
    })
    onSave([...watchlist, newItem])
    setAddingNew(false)
  }

  function handleEdit(form: FormState) {
    if (!editingItem) return
    onSave(watchlist.map(w => w.id === editingItem.id ? formToItem(form, editingItem) : w))
    setEditingItem(null)
  }

  function handleDelete(id: string) {
    onSave(watchlist.filter(w => w.id !== id))
  }

  function handleToggleActive(id: string) {
    onSave(watchlist.map(w => w.id === id ? { ...w, active: !w.active } : w))
  }

  const active = watchlist.filter(w => w.active)
  const inactive = watchlist.filter(w => !w.active)

  return (
    <>
      <div className="page-header">
        <div className="page-title">Watchlist</div>
        <div className="page-subtitle">Define exactly what cards you're hunting — player, year, set, grade, price range</div>
      </div>

      <div className="watchlist-wrap">
        <div className="watchlist-controls">
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {active.length} active · {inactive.length} paused
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setAddingNew(true)}>
            + Add Target
          </button>
        </div>

        {watchlist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👁️</div>
            <div className="empty-title">No targets yet</div>
            <div className="empty-desc">Add players or cards you want to track deals for.</div>
          </div>
        ) : (
          <div className="watchlist-grid">
            {watchlist.map(item => (
              <div key={item.id} className={`watchlist-card ${!item.active ? 'inactive' : ''}`}>
                <div className="wc-sport-icon">{sportEmoji(item.sport)}</div>
                <div className="wc-body">
                  <div className="wc-player">{item.player_name}</div>
                  <div className="wc-meta">
                    {item.sport ? sportLabel(item.sport) : 'No sport'}
                    {item.years && item.years.length > 0 ? ` · ${item.years.join('/')}` : ''}
                    {item.min_price_usd ? ` · Min $${item.min_price_usd}` : ''}
                    {item.max_price_usd ? ` · Max $${item.max_price_usd}` : ''}
                  </div>
                  <div className="wc-tags">
                    {(item.grades ?? []).map(g => (
                      <span key={g} className="tag tag-accent">{g}</span>
                    ))}
                    {item.card_types.map(ct => (
                      <span key={ct} className="tag tag-accent">
                        {CARD_TYPES.find(c => c.value === ct)?.label ?? ct}
                      </span>
                    ))}
                    {(item.sets ?? []).map(s => (
                      <span key={s} className="tag">{s}</span>
                    ))}
                    {item.keywords.map(kw => (
                      <span key={kw} className="tag">{kw}</span>
                    ))}
                  </div>
                </div>
                <div className="wc-actions">
                  <button
                    className="btn btn-ghost btn-icon"
                    title={item.active ? 'Pause' : 'Activate'}
                    onClick={() => handleToggleActive(item.id)}
                  >
                    {item.active ? '⏸' : '▶️'}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Edit"
                    onClick={() => setEditingItem(item)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Delete"
                    onClick={() => handleDelete(item.id)}
                    style={{ color: 'var(--danger)' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addingNew && (
        <WatchlistForm
          title="Add Target"
          initial={{
            player_name: '', sport: '', card_types: ['serialized'],
            years: [], sets_text: '', grades: [],
            max_price_usd: '', min_price_usd: '', keywords: '',
          }}
          onSubmit={handleAdd}
          onCancel={() => setAddingNew(false)}
        />
      )}

      {editingItem && (
        <WatchlistForm
          title={`Edit — ${editingItem.player_name}`}
          initial={itemToForm(editingItem)}
          onSubmit={handleEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </>
  )
}
