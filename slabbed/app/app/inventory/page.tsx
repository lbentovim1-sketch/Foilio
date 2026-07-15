'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import CardTable, { CardNameCell, DaysHeld, Money, StatusBadge } from '@/components/cards/CardTable';
import CardFormModal from '@/components/cards/CardFormModal';
import MarkSoldModal from '@/components/cards/MarkSoldModal';
import EmptyState from '@/components/ui/EmptyState';
import PLBadge from '@/components/ui/PLBadge';
import { useToast } from '@/components/ui/Toast';
import type { Card, Profile } from '@/lib/supabase/types';

export default function InventoryPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inventory' | 'listed' | 'pc'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [sellCard, setSellCard] = useState<Card | null>(null);

  useEffect(() => {
    async function load() {
      const [cardsRes, profileRes] = await Promise.all([
        supabase.from('cards').select('*').in('status', ['inventory', 'listed', 'pc']).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').single(),
      ]);
      if (cardsRes.data) setCards(cardsRes.data as Card[]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = cards;
    if (filter !== 'all') result = result.filter(c => c.status === filter);
    if (search) result = result.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [cards, filter, search]);

  async function handleAdd(data: Partial<Card>) {
    const { data: newCard, error } = await supabase.from('cards').insert({ ...data, status: data.status ?? 'inventory' }).select().single();
    if (error) { showToast('Failed to add card', 'error'); return; }
    setCards(prev => [newCard as Card, ...prev]);
    setShowAdd(false);
    showToast('Card added', 'success');
  }

  async function handleEdit(data: Partial<Card>) {
    if (!editCard) return;
    const { data: updated, error } = await supabase.from('cards').update(data).eq('id', editCard.id).select().single();
    if (error) { showToast('Failed to save', 'error'); return; }
    setCards(prev => prev.map(c => c.id === editCard.id ? updated as Card : c));
    setEditCard(null);
    showToast('Card updated', 'success');
  }

  async function handleDelete(card: Card) {
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('cards').delete().eq('id', card.id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Card deleted', 'success');
  }

  async function handleMoveToGrading(card: Card) {
    const { data: updated, error } = await supabase.from('cards').update({ status: 'grading' }).eq('id', card.id).select().single();
    if (error) { showToast('Failed to update', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Moved to Grading', 'success');
  }

  async function handleMarkSold(saleData: { sale_price: number; fees: number; shipping_out: number; platform: string; date_sold: string }) {
    if (!sellCard) return;
    const { data: updated, error } = await supabase.from('cards').update({ ...saleData, status: 'sold' }).eq('id', sellCard.id).select().single();
    if (error) { showToast('Failed to mark sold', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== sellCard.id));
    setSellCard(null);
    showToast('Sold! 🎉', 'success');
  }

  const columns = [
    { key: 'name', label: 'Card', render: (c: Card) => <CardNameCell card={c} /> },
    { key: 'category', label: 'Category', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.category}</span> },
    { key: 'status', label: 'Status', render: (c: Card) => <StatusBadge status={c.status} /> },
    { key: 'cost', label: 'Cost', render: (c: Card) => <Money value={c.cost} />, align: 'right' as const },
    { key: 'value', label: 'Value', render: (c: Card) => <Money value={c.true_value} />, align: 'right' as const },
    { key: 'pl', label: 'Paper P/L', render: (c: Card) => c.true_value !== null ? <PLBadge value={c.true_value - c.cost} /> : <span style={{ color: 'var(--dim)' }}>—</span>, align: 'right' as const },
    { key: 'list_price', label: 'List $', render: (c: Card) => <Money value={c.list_price} dim />, align: 'right' as const },
    { key: 'days', label: 'Days Held', render: (c: Card) => <DaysHeld dateBought={c.date_bought} />, align: 'right' as const },
  ];

  const actions = [
    { label: 'Mark as Sold', onClick: (c: Card) => setSellCard(c), color: 'var(--green)' },
    { label: 'Send to Grading', onClick: handleMoveToGrading },
    { label: 'Delete', onClick: handleDelete, color: 'var(--red)' },
  ];

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Inventory</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>{cards.length} cards in vault</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
        >
          + ADD CARD
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          className="input-base"
          style={{ maxWidth: '280px' }}
          placeholder="Search cards…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'inventory', 'listed', 'pc'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--surface-2)' : 'transparent',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                color: filter === f ? 'var(--text)' : 'var(--dim)',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f === 'pc' ? 'PC' : f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {cards.length === 0 ? (
        <EmptyState
          icon="🗃"
          title="Your vault is empty"
          description="Add cards you own, have listed, or keep in your personal collection. Track paper P/L and know your numbers."
          action={
            <button
              onClick={() => setShowAdd(true)}
              style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
            >
              + ADD YOUR FIRST CARD
            </button>
          }
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <CardTable
            cards={filtered}
            columns={columns}
            actions={actions}
            onEdit={card => setEditCard(card)}
          />
        </div>
      )}

      {showAdd && (
        <CardFormModal defaultStatus="inventory" onSave={handleAdd} onClose={() => setShowAdd(false)} />
      )}
      {editCard && (
        <CardFormModal initialData={editCard} onSave={handleEdit} onClose={() => setEditCard(null)} />
      )}
      {sellCard && (
        <MarkSoldModal
          card={sellCard}
          defaultFeePct={profile?.default_fee_pct ?? 13.25}
          defaultShipping={profile?.default_shipping ?? 5}
          onSave={handleMarkSold}
          onClose={() => setSellCard(null)}
        />
      )}
      <ToastComponent />
    </div>
  );
}
