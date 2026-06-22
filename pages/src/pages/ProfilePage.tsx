import { useState } from 'react'
import type { WatchlistItem } from '../types'
import { SPORTS, CARD_TYPES } from '../types'

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
  min_serial_print_run: null,
  max_price_usd: null,
  keywords: [],
  active: true,
}

interface FormState {
  player_name: string
  sport: string
  card_types: string[]
  max_price_usd: string
  keywords: string
}

function itemToForm(item: WatchlistItem): FormState {
  return {
    player_name: item.player_name,
    sport: item.sport ?? '',
    card_types: [...item.card_types],
    max_price_usd: item.max_price_usd != null ? String(item.max_price_usd) : '',
    keywords: item.keywords.join(', '),
  }
}

function formToItem(form: FormState, base: WatchlistItem): WatchlistItem {
  return {
    ...base,
    player_name: form.player_name.trim(),
    sport: form.sport || null,
    card_types: form.card_types,
    max_price_usd: form.max_price_usd ? parseFloat(form.max_price_usd) : null,
    keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
  }
}

interface WatchlistFormProps {
  title: string
  initial: FormState
  onSubmit: (form: FormState) => void
  onCancel: () => void
}

function WatchlistForm({ title, initial, onSubmit, onCancel }: WatchlistFormProps) {
  const [form, setForm] = useState<FormState>(initial)

  function toggleCardType(val: string) {
    setForm(prev => ({
      ...prev,
      card_types: prev.card_types.includes(val)
        ? prev.card_types.filter(t => t !== val)
        : [...prev.card_types, val],
    }))
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{title}</div>

        <div className="field">
          <label>Player / Card Name *</label>
          <input
            type="text"
            placeholder="e.g. Jalen Brunson"
            value={form.player_name}
            onChange={e => setForm(prev => ({ ...prev, player_name: e.target.value }))}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Sport</label>
          <select value={form.sport} onChange={e => setForm(prev => ({ ...prev, sport: e.target.value }))}>
            <option value="">Select sport…</option>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Card Types</label>
          <div className="checkbox-group">
            {CARD_TYPES.map(ct => (
              <label key={ct.value} className={`checkbox-item ${form.card_types.includes(ct.value) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={form.card_types.includes(ct.value)}
                  onChange={() => toggleCardType(ct.value)}
                />
                <span>{ct.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Max Price (USD)</label>
          <input
            type="number"
            placeholder="e.g. 500"
            min={0}
            step={1}
            value={form.max_price_usd}
            onChange={e => setForm(prev => ({ ...prev, max_price_usd: e.target.value }))}
          />
        </div>

        <div className="field">
          <label>Extra Keywords (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. Prizm, Optic, 1/1"
            value={form.keywords}
            onChange={e => setForm(prev => ({ ...prev, keywords: e.target.value }))}
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
    const newItem: WatchlistItem = {
      ...BLANK,
      ...formToItem(form, {
        ...BLANK,
        id: `local_${Date.now()}`,
        profile_id: '',
        created_at: new Date().toISOString(),
      }),
      id: `local_${Date.now()}`,
      profile_id: '',
      created_at: new Date().toISOString(),
    }
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
        <div className="page-subtitle">Manage the players and cards you're hunting</div>
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
                    {item.max_price_usd ? ` · Max $${item.max_price_usd}` : ''}
                  </div>
                  {item.card_types.length > 0 && (
                    <div className="wc-tags">
                      {item.card_types.map(ct => (
                        <span key={ct} className="tag tag-accent">
                          {CARD_TYPES.find(c => c.value === ct)?.label ?? ct}
                        </span>
                      ))}
                      {item.keywords.map(kw => (
                        <span key={kw} className="tag">{kw}</span>
                      ))}
                    </div>
                  )}
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
          initial={{ ...BLANK, sport: '', card_types: ['serialized'], max_price_usd: '', keywords: '' }}
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
