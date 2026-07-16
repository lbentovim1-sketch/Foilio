'use client';

import { useState, useRef, useEffect } from 'react';
import SlabChip from '@/components/ui/SlabChip';
import PLBadge from '@/components/ui/PLBadge';
import type { Card, CardStatus } from '@/lib/supabase/types';

interface ActionItem {
  label: string;
  onClick: (card: Card) => void;
  color?: string;
}

interface CardTableProps {
  cards: Card[];
  columns: Array<{
    key: string;
    label: string;
    render: (card: Card) => React.ReactNode;
    align?: 'left' | 'right' | 'center';
  }>;
  actions?: ActionItem[];
  onEdit?: (card: Card) => void;
  emptyMessage?: string;
}

interface MenuState {
  cardId: string;
  x: number;
  y: number;
}

export default function CardTable({ cards, columns, actions, onEdit, emptyMessage }: CardTableProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    function handleClick() { setMenu(null); }
    if (menu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menu]);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, cardId: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ cardId, x: rect.right, y: rect.bottom });
  }

  if (cards.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--dim)', fontSize: '14px' }}>
        {emptyMessage ?? 'No cards yet.'}
      </div>
    );
  }

  const activeCard = menu ? cards.find(c => c.id === menu.cardId) : null;

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ textAlign: col.align ?? 'left' }}>{col.label}</th>
              ))}
              {(actions || onEdit) && <th style={{ width: '48px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {cards.map(card => (
              <tr key={card.id}>
                {columns.map(col => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                    {col.render(card)}
                  </td>
                ))}
                {(actions || onEdit) && (
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={e => openMenu(e, card.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: menu?.cardId === card.id ? 'var(--text)' : 'var(--dim)',
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      ⋯
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixed-position dropdown — escapes any overflow:hidden container */}
      {menu && activeCard && (
        <div
          style={{
            position: 'fixed',
            top: menu.y + 4,
            left: menu.x,
            transform: 'translateX(-100%)',
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            zIndex: 9999,
            minWidth: '170px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {onEdit && (
            <button
              onClick={() => { onEdit(activeCard); setMenu(null); }}
              style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
            >
              Edit
            </button>
          )}
          {actions?.map(action => (
            <button
              key={action.label}
              onClick={() => { action.onClick(activeCard); setMenu(null); }}
              style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: action.color ?? 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Shared renderers
export function CardNameCell({ card }: { card: Card }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: '13px' }}>{card.name}</span>
      <SlabChip gradeCo={card.grade_co} grade={card.grade} />
      {card.serial && <span style={{ fontSize: '11px', color: 'var(--dim)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--line)' }}>{card.serial}</span>}
    </div>
  );
}

export function DaysHeld({ dateBought, dateSold }: { dateBought: string | null; dateSold?: string | null }) {
  if (!dateBought) return <span style={{ color: 'var(--dim)' }}>—</span>;
  const start = new Date(dateBought);
  const end = dateSold ? new Date(dateSold) : new Date();
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return <span style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{days}d</span>;
}

export function Money({ value, dim }: { value: number | null; dim?: boolean }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--dim)' }}>—</span>;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-barlow)', color: dim ? 'var(--dim)' : 'var(--text)' }}>
      ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function StatusBadge({ status }: { status: CardStatus }) {
  const colors: Record<CardStatus, { bg: string; color: string }> = {
    incoming: { bg: 'rgba(91,156,245,0.15)', color: 'var(--blue)' },
    grading: { bg: 'rgba(230,185,63,0.15)', color: 'var(--gold)' },
    inventory: { bg: 'rgba(63,190,126,0.15)', color: 'var(--green)' },
    listed: { bg: 'rgba(91,156,245,0.15)', color: 'var(--blue)' },
    sold: { bg: 'rgba(139,148,163,0.15)', color: 'var(--dim)' },
    pc: { bg: 'rgba(200,16,46,0.15)', color: 'var(--psa-red)' },
  };
  const labels: Record<CardStatus, string> = {
    incoming: 'Incoming', grading: 'Grading', inventory: 'Inventory',
    listed: 'Listed', sold: 'Sold', pc: 'PC',
  };
  const { bg, color } = colors[status] ?? colors.inventory;
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-barlow)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {labels[status]}
    </span>
  );
}
