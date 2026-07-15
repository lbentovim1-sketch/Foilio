'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import CardTable, { CardNameCell, DaysHeld, Money } from '@/components/cards/CardTable';
import EmptyState from '@/components/ui/EmptyState';
import PLBadge from '@/components/ui/PLBadge';
import { useToast } from '@/components/ui/Toast';
import type { Card } from '@/lib/supabase/types';

function calcPL(card: Card): number {
  if (card.sale_price === null) return 0;
  return card.sale_price - (card.fees ?? 0) - (card.shipping_out ?? 0) - card.cost;
}

function calcROI(card: Card): number {
  if (card.cost === 0) return 0;
  return (calcPL(card) / card.cost) * 100;
}

function exportCSV(cards: Card[]) {
  const headers = ['Name', 'Category', 'Grade Co', 'Grade', 'Cost', 'Sale Price', 'Fees', 'Shipping', 'Net Proceeds', 'Realized P/L', 'ROI %', 'Date Bought', 'Date Sold', 'Days Held', 'Platform', 'Source'];
  const rows = cards.map(c => {
    const pl = calcPL(c);
    const net = (c.sale_price ?? 0) - (c.fees ?? 0) - (c.shipping_out ?? 0);
    const days = c.date_bought && c.date_sold
      ? Math.floor((new Date(c.date_sold).getTime() - new Date(c.date_bought).getTime()) / 86400000)
      : '';
    return [
      `"${c.name}"`, c.category, c.grade_co ?? '', c.grade ?? '',
      c.cost.toFixed(2), (c.sale_price ?? 0).toFixed(2),
      (c.fees ?? 0).toFixed(2), (c.shipping_out ?? 0).toFixed(2),
      net.toFixed(2), pl.toFixed(2), calcROI(c).toFixed(1),
      c.date_bought ?? '', c.date_sold ?? '', days, c.platform ?? '', c.source ?? '',
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slabbed-sold-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SoldPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    supabase.from('cards').select('*').eq('status', 'sold').order('date_sold', { ascending: false })
      .then(({ data }) => { if (data) setCards(data as Card[]); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let result = cards;
    if (search) result = result.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (dateFrom) result = result.filter(c => c.date_sold && c.date_sold >= dateFrom);
    if (dateTo) result = result.filter(c => c.date_sold && c.date_sold <= dateTo);
    return result;
  }, [cards, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, c) => s + (c.sale_price ?? 0), 0);
    const cost = filtered.reduce((s, c) => s + c.cost, 0);
    const fees = filtered.reduce((s, c) => s + (c.fees ?? 0), 0);
    const shipping = filtered.reduce((s, c) => s + (c.shipping_out ?? 0), 0);
    const pl = filtered.reduce((s, c) => s + calcPL(c), 0);
    return { revenue, cost, fees, shipping, pl };
  }, [filtered]);

  async function handleDelete(card: Card) {
    if (!confirm(`Delete sale record for "${card.name}"?`)) return;
    await supabase.from('cards').delete().eq('id', card.id);
    setCards(prev => prev.filter(c => c.id !== card.id));
    showToast('Deleted', 'success');
  }

  const columns = [
    { key: 'name', label: 'Card', render: (c: Card) => <CardNameCell card={c} /> },
    { key: 'date_sold', label: 'Sold', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.date_sold ? new Date(c.date_sold).toLocaleDateString() : '—'}</span> },
    { key: 'sale_price', label: 'Sale Price', render: (c: Card) => <Money value={c.sale_price} />, align: 'right' as const },
    { key: 'cost', label: 'Cost', render: (c: Card) => <Money value={c.cost} dim />, align: 'right' as const },
    { key: 'fees', label: 'Fees', render: (c: Card) => <Money value={c.fees} dim />, align: 'right' as const },
    { key: 'pl', label: 'Realized P/L', render: (c: Card) => <PLBadge value={calcPL(c)} />, align: 'right' as const },
    { key: 'roi', label: 'ROI', render: (c: Card) => <PLBadge value={calcROI(c)} prefix="" />, align: 'right' as const },
    { key: 'days', label: 'Days Held', render: (c: Card) => <DaysHeld dateBought={c.date_bought} dateSold={c.date_sold} />, align: 'right' as const },
    { key: 'platform', label: 'Platform', render: (c: Card) => <span style={{ color: 'var(--dim)', fontSize: '13px' }}>{c.platform ?? '—'}</span> },
  ];

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Sold</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>Realized P/L · {cards.length} sales</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
        >
          ↓ EXPORT CSV
        </button>
      </div>

      {/* Summary totals */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Revenue', value: `$${totals.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
            { label: 'Cost Basis', value: `$${totals.cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
            { label: 'Total Fees', value: `$${totals.fees.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
            { label: 'Shipping Out', value: `$${totals.shipping.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-barlow)', fontWeight: 600, marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
          <div style={{ background: totals.pl >= 0 ? 'rgba(63,190,126,0.1)' : 'rgba(227,90,82,0.1)', border: `1px solid ${totals.pl >= 0 ? 'var(--green)' : 'var(--red)'}`, borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-barlow)', fontWeight: 600, marginBottom: '4px' }}>Realized P/L</div>
            <div style={{ fontSize: '18px', fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
              <PLBadge value={totals.pl} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input-base" style={{ maxWidth: '220px' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--dim)' }}>
          <span>From</span>
          <input type="date" className="input-base" style={{ width: '140px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span>to</span>
          <input type="date" className="input-base" style={{ width: '140px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No sales yet"
          description="When you mark a card as sold from Inventory, it appears here with full realized P/L, fees, and ROI. Perfect for tax season."
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <CardTable
            cards={filtered}
            columns={columns}
            actions={[{ label: 'Delete record', onClick: handleDelete, color: 'var(--red)' }]}
          />
        </div>
      )}

      <ToastComponent />
    </div>
  );
}
