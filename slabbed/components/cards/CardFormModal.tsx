'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { Card, CardStatus } from '@/lib/supabase/types';

const CATEGORIES = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Pokemon', 'Other TCG', 'Other'];
const GRADE_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'TAG', 'Raw'];
const PLATFORMS = ['eBay', 'Whatnot', 'Fanatics Collect', 'MySlabs', 'COMC', 'Local', 'Other'];

interface CardFormModalProps {
  initialData?: Partial<Card>;
  defaultStatus?: CardStatus;
  onSave: (data: Partial<Card>) => Promise<void>;
  onClose: () => void;
}

type FormData = {
  name: string;
  category: string;
  grade_co: string;
  grade: string;
  serial: string;
  status: CardStatus;
  cost: string;
  date_bought: string;
  source: string;
  true_value: string;
  platform: string;
  list_price: string;
  tracking: string;
  grading_co: string;
  grading_fee: string;
  submitted_date: string;
  expected_grade: string;
  notes: string;
};

export default function CardFormModal({ initialData, defaultStatus = 'inventory', onSave, onClose }: CardFormModalProps) {
  const isEdit = !!initialData?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: initialData?.name ?? '',
    category: initialData?.category ?? 'Other',
    grade_co: initialData?.grade_co ?? '',
    grade: initialData?.grade ?? '',
    serial: initialData?.serial ?? '',
    status: initialData?.status ?? defaultStatus,
    cost: initialData?.cost?.toString() ?? '0',
    date_bought: initialData?.date_bought ?? '',
    source: initialData?.source ?? '',
    true_value: initialData?.true_value?.toString() ?? '',
    platform: initialData?.platform ?? '',
    list_price: initialData?.list_price?.toString() ?? '',
    tracking: initialData?.tracking ?? '',
    grading_co: initialData?.grading_co ?? '',
    grading_fee: initialData?.grading_fee?.toString() ?? '',
    submitted_date: initialData?.submitted_date ?? '',
    expected_grade: initialData?.expected_grade ?? '',
    notes: initialData?.notes ?? '',
  });

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Partial<Card> = {
      name: form.name,
      category: form.category,
      grade_co: form.grade_co || null,
      grade: form.grade || null,
      serial: form.serial || null,
      status: form.status,
      cost: parseFloat(form.cost) || 0,
      date_bought: form.date_bought || null,
      source: form.source || null,
      true_value: form.true_value ? parseFloat(form.true_value) : null,
      platform: form.platform || null,
      list_price: form.list_price ? parseFloat(form.list_price) : null,
      tracking: form.tracking || null,
      grading_co: form.grading_co || null,
      grading_fee: form.grading_fee ? parseFloat(form.grading_fee) : null,
      submitted_date: form.submitted_date || null,
      expected_grade: form.expected_grade || null,
      notes: form.notes || null,
    };
    await onSave(payload);
    setSaving(false);
  }

  const showTracking = form.status === 'incoming';
  const showGrading = form.status === 'grading';
  const showListing = form.status === 'listed';

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '8px 10px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
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
    <Modal title={isEdit ? 'Edit Card' : 'Add Card'} onClose={onClose} maxWidth={600}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Name - full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Card Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. 2023 Topps Chrome Mike Trout #1"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value as CardStatus)}>
              <option value="incoming">Incoming</option>
              <option value="grading">Grading</option>
              <option value="inventory">Inventory</option>
              <option value="listed">Listed</option>
              <option value="pc">PC (Personal Collection)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Grade Co</label>
            <select style={inputStyle} value={form.grade_co} onChange={e => set('grade_co', e.target.value)}>
              <option value="">Raw / None</option>
              {GRADE_COMPANIES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Grade</label>
            <input
              style={inputStyle}
              value={form.grade}
              onChange={e => set('grade', e.target.value)}
              placeholder="10, 9.5, 8, etc."
            />
          </div>

          <div>
            <label style={labelStyle}>Serial #</label>
            <input
              style={inputStyle}
              value={form.serial}
              onChange={e => set('serial', e.target.value)}
              placeholder="29/50"
            />
          </div>

          <div>
            <label style={labelStyle}>Cost Basis ($) *</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={form.cost}
              onChange={e => set('cost', e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Date Bought</label>
            <input
              type="date"
              style={inputStyle}
              value={form.date_bought}
              onChange={e => set('date_bought', e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Source / Bought From</label>
            <input
              style={inputStyle}
              value={form.source}
              onChange={e => set('source', e.target.value)}
              placeholder="eBay, Card show, etc."
            />
          </div>

          <div>
            <label style={labelStyle}>True Value / Comp ($)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={form.true_value}
              onChange={e => set('true_value', e.target.value)}
              placeholder="Market comp"
            />
          </div>

          {/* Incoming */}
          {showTracking && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tracking Number</label>
              <input
                style={inputStyle}
                value={form.tracking}
                onChange={e => set('tracking', e.target.value)}
                placeholder="1Z999AA10123456784"
              />
            </div>
          )}

          {/* Grading */}
          {showGrading && <>
            <div>
              <label style={labelStyle}>Grading Company</label>
              <select style={inputStyle} value={form.grading_co} onChange={e => set('grading_co', e.target.value)}>
                <option value="">Select…</option>
                {['PSA', 'BGS', 'SGC', 'CGC', 'TAG'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Grading Fee ($)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={form.grading_fee}
                onChange={e => set('grading_fee', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={labelStyle}>Submitted Date</label>
              <input
                type="date"
                style={inputStyle}
                value={form.submitted_date}
                onChange={e => set('submitted_date', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Expected Grade</label>
              <input
                style={inputStyle}
                value={form.expected_grade}
                onChange={e => set('expected_grade', e.target.value)}
                placeholder="PSA 10?"
              />
            </div>
          </>}

          {/* Listed */}
          {showListing && <>
            <div>
              <label style={labelStyle}>Platform</label>
              <select style={inputStyle} value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="">Select…</option>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>List Price ($)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={form.list_price}
                onChange={e => set('list_price', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>}

          {/* Notes - full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this card…"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
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
            type="submit"
            disabled={saving}
            style={{
              background: 'var(--gold)',
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
            {saving ? 'Saving…' : isEdit ? 'SAVE CHANGES' : 'ADD CARD'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
