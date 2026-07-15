'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import PLBadge from '@/components/ui/PLBadge';
import type { Card, DashboardStats } from '@/lib/supabase/types';
import Link from 'next/link';

function KPICard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: '10px',
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--dim)', fontFamily: 'var(--font-barlow)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontFamily: 'var(--font-barlow)', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function CategoryBar({ name, cost, value, count }: { name: string; cost: number; value: number; count: number }) {
  const maxVal = Math.max(cost, value, 1);
  const pctCost = Math.min(100, (cost / maxVal) * 100);
  const pctVal = Math.min(100, (value / maxVal) * 100);
  const pl = value - cost;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
          {name} <span style={{ color: 'var(--dim)', fontSize: '12px' }}>({count})</span>
        </span>
        <PLBadge value={pl} />
      </div>
      <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctCost}%`, background: 'var(--dim)', borderRadius: '3px' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctVal}%`, background: pl >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.6, borderRadius: '3px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '11px', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
        <span>Cost ${cost.toFixed(0)}</span>
        <span>Value ${value.toFixed(0)}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heldCards, setHeldCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsRes, cardsRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase
          .from('cards')
          .select('*')
          .in('status', ['incoming', 'grading', 'inventory', 'listed'])
          .order('true_value', { ascending: false }),
      ]);
      if (statsRes.data) setStats(statsRes.data as DashboardStats);
      if (cardsRes.data) setHeldCards(cardsRes.data as Card[]);
      setLoading(false);
    }
    load();
  }, []);

  const categories = heldCards.reduce<Record<string, { cost: number; value: number; count: number }>>((acc, c) => {
    const cat = c.category || 'Other';
    if (!acc[cat]) acc[cat] = { cost: 0, value: 0, count: 0 };
    acc[cat].cost += c.cost;
    acc[cat].value += c.true_value ?? c.cost;
    acc[cat].count++;
    return acc;
  }, {});
  const categoryList = Object.entries(categories).sort((a, b) => b[1].value - a[1].value);

  const biggestGains = [...heldCards]
    .filter(c => c.true_value !== null && c.true_value > 0)
    .map(c => ({ ...c, paperPl: (c.true_value ?? 0) - c.cost }))
    .sort((a, b) => b.paperPl - a.paperPl)
    .slice(0, 5);

  const unrealizedPL = stats ? (stats.inventory_value ?? 0) - (stats.inventory_cost ?? 0) : 0;

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '30px', color: 'var(--text)', lineHeight: 1 }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--dim)', fontSize: '14px', marginTop: '4px' }}>Your card business at a glance</p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <KPICard label="Cards Held" value={stats?.held_count ?? 0} sub="in pipeline" />
        <KPICard
          label="Inventory Cost"
          value={`$${(stats?.inventory_cost ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="all-in basis"
        />
        <KPICard
          label="Est. Value"
          value={`$${(stats?.inventory_value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="based on comps"
        />
        <KPICard
          label="Unrealized P/L"
          value={<PLBadge value={unrealizedPL} />}
          sub="paper gains"
        />
        <KPICard label="Cards Sold" value={stats?.sold_count ?? 0} sub="all time" />
        <KPICard
          label="Realized Profit"
          value={<PLBadge value={stats?.realized_pl ?? 0} />}
          sub="after fees &amp; shipping"
        />
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Category Breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '16px', marginBottom: '16px', color: 'var(--text)' }}>
            Category Breakdown
          </h2>
          {categoryList.length === 0 ? (
            <p style={{ color: 'var(--dim)', fontSize: '13px' }}>
              No held cards yet.{' '}
              <Link href="/app/inventory" style={{ color: 'var(--blue)' }}>Add your first card →</Link>
            </p>
          ) : (
            categoryList.map(([name, data]) => (
              <CategoryBar key={name} name={name} {...data} />
            ))
          )}
        </div>

        {/* Biggest Paper Gains */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '16px', marginBottom: '16px', color: 'var(--text)' }}>
            Biggest Paper Gains
          </h2>
          {biggestGains.length === 0 ? (
            <p style={{ color: 'var(--dim)', fontSize: '13px' }}>
              Add true values / comps to your held cards to see your biggest gainers here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {biggestGains.map((card, i) => (
                <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--dim)', marginRight: '6px', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                      {card.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '1px' }}>{card.category}</div>
                  </div>
                  <PLBadge value={card.paperPl} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '16px', marginBottom: '16px', color: 'var(--text)' }}>
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { href: '/app/inventory', label: 'Add card to inventory', icon: '🗃' },
              { href: '/app/buying', label: 'Track a buying target', icon: '🎯' },
              { href: '/app/incoming', label: 'Log an inbound card', icon: '📦' },
              { href: '/app/expenses', label: 'Log a business expense', icon: '📋' },
              { href: '/app/sold', label: 'View P/L report & export CSV', icon: '📊' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  color: 'var(--text)',
                  fontSize: '13px',
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
