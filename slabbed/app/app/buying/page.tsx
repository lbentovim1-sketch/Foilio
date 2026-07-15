'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import PLBadge from '@/components/ui/PLBadge';
import { useToast } from '@/components/ui/Toast';
import type { WatchlistItem, Profile } from '@/lib/supabase/types';

const PRIORITIES = ['High', 'Medium', 'Low'];

interface WatchlistFormModalProps {
  initial?: Partial<WatchlistItem>;
  onSave: (data: Partial<WatchlistItem>) => Promise<void>;
  onClose: () => void;
}

function WatchlistFormModal({ initial, onSave, onClose }: WatchlistFormModalProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    recent_comp: initial?.recent_comp?.toString() ?? '',
    max_bid: initial?.max_bid?.toString() ?? '',
    priority: initial?.priority ?? 'Medium',
    auction_end: initial?.auction_end ? initial.auction_end.split('T')[0] : '',
    link: initial?.link ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: form.name,
      recent_comp: form.recent_comp ? parseFloat(form.recent_comp) : null,
      max_bid: form.max_bid ? parseFloat(form.max_bid) : null,
      priority: form.priority,
      auction_end: form.auction_end ? new Date(form.auction_end).toISOString() : null,
      link: form.link || null,
      notes: form.notes || null,
    });
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '14px', outline: 'none', width: '100%' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-barlow)', fontWeight: 600 };

  return (
    <Modal title={initial?.id ? 'Edit Target' : 'Add Buying Target'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Card Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 2023 Topps Chrome Shohei #1" required />
          </div>
          <div>
            <label style={labelStyle}>Recent Comp ($)</label>
            <input type="number" step="0.01" style={inputStyle} value={form.recent_comp} onChange={e => setForm(f => ({ ...f, recent_comp: e.target.value }))} placeholder="What it's selling for" />
          </div>
          <div>
            <label style={labelStyle}>Max Bid ($)</label>
            <input type="number" step="0.01" style={inputStyle} value={form.max_bid} onChange={e => setForm(f => ({ ...f, max_bid: e.target.value }))} placeholder="Your ceiling" />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Auction End</label>
            <input type="date" style={inputStyle} value={form.auction_end} onChange={e => setForm(f => ({ ...f, auction_end: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Listing Link</label>
            <input style={inputStyle} value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://ebay.com/..." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this target…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '7px', color: 'var(--dim)', padding: '9px 20px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ background: 'var(--gold)', border: 'none', borderRadius: '7px', color: '#0e1116', padding: '9px 24px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : initial?.id ? 'SAVE' : 'ADD TARGET'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  High: 'var(--red)',
  Medium: 'var(--gold)',
  Low: 'var(--dim)',
};

export default function BuyingPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<WatchlistItem | null>(null);

  useEffect(() => {
    async function load() {
      const [wRes, pRes] = await Promise.all([
        supabase.from('watchlist').select('*').order('auction_end', { ascending: true }),
        supabase.from('profiles').select('*').single(),
      ]);
      if (wRes.data) setItems(wRes.data as WatchlistItem[]);
      if (pRes.data) setProfile(pRes.data as Profile);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(data: Partial<WatchlistItem>) {
    if (editItem) {
      const { data: updated, error } = await supabase.from('watchlist').update(data).eq('id', editItem.id).select().single();
      if (error) { showToast('Failed to save', 'error'); return; }
      setItems(prev => prev.map(i => i.id === editItem.id ? updated as WatchlistItem : i));
      setEditItem(null);
    } else {
      const { data: newItem, error } = await supabase.from('watchlist').insert(data).select().single();
      if (error) { showToast('Failed to add', 'error'); return; }
      setItems(prev => [newItem as WatchlistItem, ...prev]);
      setShowAdd(false);
    }
    showToast('Saved', 'success');
  }

  async function handleDelete(item: WatchlistItem) {
    if (!confirm(`Remove "${item.name}" from watchlist?`)) return;
    await supabase.from('watchlist').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('Removed', 'success');
  }

  async function handleWon(item: WatchlistItem) {
    // Move to incoming
    const { error } = await supabase.from('cards').insert({
      name: item.name,
      cost: item.max_bid ?? 0,
      status: 'incoming',
      category: 'Other',
    });
    if (error) { showToast('Failed to move to Incoming', 'error'); return; }
    await supabase.from('watchlist').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('Moved to Incoming — update cost + tracking there!', 'success');
  }

  function calcExpectedProfit(item: WatchlistItem): number | null {
    if (!item.recent_comp || !item.max_bid) return null;
    const feePct = profile?.default_fee_pct ?? 13.25;
    const shipping = profile?.default_shipping ?? 5;
    return item.recent_comp * (1 - feePct / 100) - shipping - item.max_bid;
  }

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Buying</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>Watchlist & max-bid calculator</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
        >
          + ADD TARGET
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No buying targets yet"
          description="Add cards you're hunting. Set a max bid and see your expected profit before you bid — so you never overpay again."
          action={
            <button
              onClick={() => setShowAdd(true)}
              style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
            >
              + ADD FIRST TARGET
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map(item => {
            const expectedProfit = calcExpectedProfit(item);
            const isGood = expectedProfit !== null && expectedProfit > 0;
            return (
              <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-barlow)', fontWeight: 700, color: PRIORITY_COLOR[item.priority] ?? 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {item.priority}
                      </span>
                      {item.auction_end && (
                        <span style={{ fontSize: '12px', color: 'var(--dim)' }}>
                          Ends {new Date(item.auction_end).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
                      {item.recent_comp !== null && (
                        <span style={{ color: 'var(--dim)' }}>Comp: <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${item.recent_comp.toFixed(2)}</span></span>
                      )}
                      {item.max_bid !== null && (
                        <span style={{ color: 'var(--dim)' }}>Max bid: <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${item.max_bid.toFixed(2)}</span></span>
                      )}
                      {expectedProfit !== null && (
                        <span style={{ color: 'var(--dim)' }}>
                          Expected profit: <PLBadge value={expectedProfit} />
                        </span>
                      )}
                    </div>
                    {item.notes && <p style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '6px' }}>{item.notes}</p>}
                  </div>

                  {/* Profit indicator */}
                  {expectedProfit !== null && (
                    <div style={{
                      background: isGood ? 'rgba(63,190,126,0.1)' : 'rgba(227,90,82,0.1)',
                      border: `1px solid ${isGood ? 'var(--green)' : 'var(--red)'}`,
                      borderRadius: '8px',
                      padding: '8px 14px',
                      textAlign: 'center',
                      minWidth: '80px',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Expected</div>
                      <PLBadge value={expectedProfit} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleWon(item)} style={{ background: 'var(--green)', border: 'none', borderRadius: '6px', color: '#0e1116', padding: '6px 12px', fontSize: '12px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}>
                    WON IT →
                  </button>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--dim)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                      View Listing ↗
                    </a>
                  )}
                  <button onClick={() => setEditItem(item)} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--dim)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(item)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <WatchlistFormModal onSave={handleSave} onClose={() => setShowAdd(false)} />}
      {editItem && <WatchlistFormModal initial={editItem} onSave={handleSave} onClose={() => setEditItem(null)} />}
      <ToastComponent />
    </div>
  );
}
