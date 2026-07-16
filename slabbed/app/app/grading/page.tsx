'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import CardTable, { CardNameCell, DaysHeld, Money } from '@/components/cards/CardTable';
import CardFormModal from '@/components/cards/CardFormModal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Card } from '@/lib/supabase/types';

export default function GradingPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);

  useEffect(() => {
    supabase.from('cards').select('*').eq('status', 'grading').order('submitted_date', { ascending: true })
      .then(({ data }) => { if (data) setCards(data as Card[]); setLoading(false); });
  }, []);

  async function handleAdd(data: Partial<Card>) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newCard, error } = await supabase.from('cards').insert({ ...data, user_id: user!.id, status: 'grading' }).select().single();
    if (error) { showToast('Failed to add', 'error'); return; }
    setCards(prev => [newCard as Card, ...prev]);
    setShowAdd(false);
    showToast('Card added to grading queue', 'success');
  }

  async function handleEdit(data: Partial<Card>) {
    if (!editCard) return;
    const { data: updated, error } = await supabase.from('cards').update(data).eq('id', editCard.id).select().single();
    if (error) { showToast('Failed to save', 'error'); return; }
    setCards(prev => prev.map(c => c.id === editCard.id ? updated as Card : c));
    setEditCard(null);
    showToast('Updated', 'success');
  }

  async function handleReturned(card: Card) {
    const { data: updated, error } = await supabase.from('cards').update({ status: 'inventory' }).eq('id', card.id).select().single();
    if (error) { showToast('Failed to update', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Returned to Vault ✓', 'success');
  }

  async function handleDelete(card: Card) {
    if (!confirm(`Delete "${card.name}"?`)) return;
    await supabase.from('cards').delete().eq('id', card.id);
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Deleted', 'success');
  }

  function daysAtGrader(card: Card): string {
    if (!card.submitted_date) return '—';
    const days = Math.floor((Date.now() - new Date(card.submitted_date).getTime()) / 86400000);
    return `${days}d`;
  }

  const columns = [
    { key: 'name', label: 'Card', render: (c: Card) => <CardNameCell card={c} /> },
    { key: 'grading_co', label: 'Grader', render: (c: Card) => <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '13px', color: c.grading_co ? 'var(--psa-red)' : 'var(--dim)' }}>{c.grading_co ?? '—'}</span> },
    { key: 'grading_fee', label: 'Grading Fee', render: (c: Card) => <Money value={c.grading_fee} dim />, align: 'right' as const },
    { key: 'submitted_date', label: 'Submitted', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.submitted_date ? new Date(c.submitted_date).toLocaleDateString() : '—'}</span> },
    { key: 'days_grader', label: 'At Grader', render: (c: Card) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--dim)', fontSize: '13px' }}>{daysAtGrader(c)}</span>, align: 'right' as const },
    { key: 'expected_grade', label: 'Expected', render: (c: Card) => <span style={{ color: 'var(--gold)', fontSize: '13px' }}>{c.expected_grade ?? '—'}</span> },
    { key: 'cost', label: 'All-in Cost', render: (c: Card) => <Money value={c.cost + (c.grading_fee ?? 0)} />, align: 'right' as const },
  ];

  const actions = [
    { label: '✓ Returned — move to Vault', onClick: handleReturned, color: 'var(--green)' },
    { label: 'Delete', onClick: handleDelete, color: 'var(--red)' },
  ];

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Grading</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>Cards out for authentication & grading</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
        >
          + SUBMIT CARD
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No cards at graders"
          description="Track cards you've sent for PSA, BGS, SGC, or other grading. See days at grader and all-in cost including grading fees."
          action={
            <button onClick={() => setShowAdd(true)} style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}>
              + SUBMIT CARD
            </button>
          }
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <CardTable cards={cards} columns={columns} actions={actions} onEdit={card => setEditCard(card)} />
        </div>
      )}

      {showAdd && <CardFormModal defaultStatus="grading" onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editCard && <CardFormModal initialData={editCard} onSave={handleEdit} onClose={() => setEditCard(null)} />}
      <ToastComponent />
    </div>
  );
}
