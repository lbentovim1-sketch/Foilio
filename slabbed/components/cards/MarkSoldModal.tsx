'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import PLBadge from '@/components/ui/PLBadge';
import type { Card } from '@/lib/supabase/types';

const PLATFORMS = ['eBay', 'Whatnot', 'Fanatics Collect', 'MySlabs', 'COMC', 'Local', 'Other'];

interface MarkSoldModalProps {
  card: Card;
  defaultFeePct: number;
  defaultShipping: number;
  onSave: (data: { sale_price: number; fees: number; shipping_out: number; platform: string; date_sold: string }) => Promise<void>;
  onClose: () => void;
}

export default function MarkSoldModal({ card, defaultFeePct, defaultShipping, onSave, onClose }: MarkSoldModalProps) {
  const [salePrice, setSalePrice] = useState((card.list_price ?? card.true_value ?? card.cost ?? 0).toString());
  const [feePct, setFeePct] = useState(defaultFeePct.toString());
  const [shipping, setShipping] = useState(defaultShipping.toString());
  const [platform, setPlatform] = useState(card.platform ?? 'eBay');
  const [dateSold, setDateSold] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const calcs = useMemo(() => {
    const price = parseFloat(salePrice) || 0;
    const pct = parseFloat(feePct) || 0;
    const ship = parseFloat(shipping) || 0;
    const feeAmt = price * (pct / 100);
    const net = price - feeAmt - ship;
    const pl = net - card.cost;
    const roi = card.cost > 0 ? (pl / card.cost) * 100 : 0;
    return { price, feeAmt, net, pl, roi };
  }, [salePrice, feePct, shipping, card.cost]);

  async function handleSave() {
    setSaving(true);
    await onSave({
      sale_price: calcs.price,
      fees: calcs.feeAmt,
      shipping_out: parseFloat(shipping) || 0,
      platform,
      date_sold: dateSold,
    });
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '8px 10px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    fontVariantNumeric: 'tabular-nums',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'var(--dim)',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-barlow)',
    fontWeight: 600,
  };

  return (
    <Modal title="Mark as Sold" onClose={onClose} maxWidth={480}>
      {/* Card info */}
      <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', border: '1px solid var(--line)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{card.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--dim)' }}>
          Cost basis: <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${card.cost.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Sale Price ($)</label>
          <input
            type="number"
            step="0.01"
            style={{ ...inputStyle, fontSize: '18px', fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            value={salePrice}
            onChange={e => setSalePrice(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Platform Fee (%)</label>
          <input
            type="number"
            step="0.01"
            style={inputStyle}
            value={feePct}
            onChange={e => setFeePct(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Shipping Out ($)</label>
          <input
            type="number"
            step="0.01"
            style={inputStyle}
            value={shipping}
            onChange={e => setShipping(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Platform</label>
          <select style={inputStyle} value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Date Sold</label>
          <input
            type="date"
            style={inputStyle}
            value={dateSold}
            onChange={e => setDateSold(e.target.value)}
          />
        </div>
      </div>

      {/* Live P/L calculation */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--dim)' }}>Sale price</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${calcs.price.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--dim)' }}>Platform fees ({feePct}%)</span>
            <span style={{ color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>-${calcs.feeAmt.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--dim)' }}>Shipping out</span>
            <span style={{ color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>-${(parseFloat(shipping) || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
            <span style={{ color: 'var(--dim)' }}>Net proceeds</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${calcs.net.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--dim)' }}>Cost basis</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>-${card.cost.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontFamily: 'var(--font-barlow)', fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
            <span>Realized P/L</span>
            <PLBadge value={calcs.pl} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--dim)' }}>ROI</span>
            <PLBadge value={calcs.roi} prefix="" className="tabular" />
            <span style={{ color: calcs.roi >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: '7px',
            color: 'var(--dim)',
            padding: '9px 20px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--green)',
            border: 'none',
            borderRadius: '7px',
            color: '#0e1116',
            padding: '9px 24px',
            fontSize: '14px',
            fontFamily: 'var(--font-barlow)',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            letterSpacing: '0.04em',
          }}
        >
          {saving ? 'Saving…' : 'CONFIRM SALE'}
        </button>
      </div>
    </Modal>
  );
}
