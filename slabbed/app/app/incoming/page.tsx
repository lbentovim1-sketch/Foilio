'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import CardTable, { CardNameCell, DaysHeld, Money } from '@/components/cards/CardTable';
import CardFormModal from '@/components/cards/CardFormModal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Card } from '@/lib/supabase/types';

export default function IncomingPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);

  useEffect(() => {
    supabase.from('cards').select('*').eq('status', 'incoming').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setCards(data as Card[]); setLoading(false); });
  }, []);

  async function handleAdd(data: Partial<Card>) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newCard, error } = await supabase.from('cards').insert({ ...data, user_id: user!.id, status: 'incoming' }).select().single();
    if (error) { showToast('Failed to add', 'error'); return; }
    setCards(prev => [newCard as Card, ...prev]);
    setShowAdd(false);
    showToast('Card added to incoming', 'success');
  }

  async function handleEdit(data: Partial<Card>) {
    if (!editCard) return;
    const { data: updated, error } = await supabase.from('cards').update(data).eq('id', editCard.id).select().single();
    if (error) { showToast('Failed to save', 'error'); return; }
    setCards(prev => prev.map(c => c.id === editCard.id ? updated as Card : c));
    setEditCard(null);
    showToast('Updated', 'success');
  }

  async function handleArrived(card: Card) {
    const { data: updated, error } = await supabase.from('cards').update({ status: 'inventory' }).eq('id', card.id).select().single();
    if (error) { showToast('Failed to update', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Moved to Inventory ✓', 'success');
  }

  async function handleSendToGrading(card: Card) {
    const { data: updated, error } = await supabase.from('cards').update({ status: 'grading' }).eq('id', card.id).select().single();
    if (error) { showToast('Failed to update', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Moved to Grading', 'success');
  }

  async function handleDelete(card: Card) {
    if (!confirm(`Delete "${card.name}"?`)) return;
    await supabase.from('cards').delete().eq('id', card.id);
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Deleted', 'success');
  }

  const columns = [
    { key: 'name', label: 'Card', render: (c: Card) => <CardNameCell card={c} /> },
    { key: 'category', label: 'Category', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.category}</span> },
    { key: 'cost', label: 'Cost', render: (c: Card) => <Money value={c.cost} />, align: 'right' as const },
    {
      key: 'tracking', label: 'Tracking', render: (c: Card) => c.tracking
        ? <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--blue)' }}>{c.tracking}</span>
        : <span style={{ color: 'var(--dim)', fontSize: '13px' }}>No tracking</span>
    },
    { key: 'source', label: 'Source', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.source ?? '—'}</span> },
    { key: 'days', label: 'Days', render: (c: Card) => <DaysHeld dateBought={c.date_bought} />, align: 'right' as const },
  ];

  const actions = [
    { label: '✓ Arrived — move to Vault', onClick: handleArrived, color: 'var(--green)' },
    { label: 'Send to Grading', onClick: handleSendToGrading },
    { label: 'Delete', onClick: handleDelete, color: 'var(--red)' },
  ];

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Incoming</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>Cards purchased and in transit</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
        >
          + LOG PURCHASE
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Nothing in transit"
          description="Log cards you've purchased but haven't received yet. Track the tracking number and move them to Inventory when they arrive."
          action={
            <button onClick={() => setShowAdd(true)} style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}>
              + LOG PURCHASE
            </button>
          }
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <CardTable cards={cards} columns={columns} actions={actions} onEdit={card => setEditCard(card)} />
        </div>
      )}

      {showAdd && <CardFormModal defaultStatus="incoming" onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editCard && <CardFormModal initialData={editCard} onSave={handleEdit} onClose={() => setEditCard(null)} />}
      <ToastComponent />
    </div>
  );
}
