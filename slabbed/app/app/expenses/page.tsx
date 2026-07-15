'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Expense } from '@/lib/supabase/types';

const EXPENSE_CATEGORIES = ['Shipping/Supplies', 'Grading', 'Platform Fees', 'Travel', 'Insurance', 'Storage', 'Other'];

function ExpenseFormModal({ initial, onSave, onClose }: {
  initial?: Partial<Expense>;
  onSave: (data: Partial<Expense>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    date: initial?.date ?? new Date().toISOString().split('T')[0],
    vendor: initial?.vendor ?? '',
    category: initial?.category ?? 'Other',
    description: initial?.description ?? '',
    amount: initial?.amount?.toString() ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      date: form.date,
      vendor: form.vendor || null,
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount) || 0,
    });
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '14px', outline: 'none', width: '100%' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-barlow)', fontWeight: 600 };

  return (
    <Modal title={initial?.id ? 'Edit Expense' : 'Log Expense'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Amount ($) *</label>
            <input type="number" step="0.01" style={inputStyle} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Vendor</label>
            <input style={inputStyle} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="USPS, PSA, etc." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '7px', color: 'var(--dim)', padding: '9px 20px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ background: 'var(--gold)', border: 'none', borderRadius: '7px', color: '#0e1116', padding: '9px 24px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'LOG EXPENSE'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function exportExpensesCSV(expenses: Expense[]) {
  const headers = ['Date', 'Category', 'Vendor', 'Description', 'Amount'];
  const rows = expenses.map(e => [e.date, e.category, e.vendor ?? '', `"${e.description ?? ''}"`, e.amount.toFixed(2)].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slabbed-expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const CAT_COLOR: Record<string, string> = {
  'Shipping/Supplies': 'var(--blue)',
  'Grading': 'var(--psa-red)',
  'Platform Fees': 'var(--gold)',
  'Travel': 'var(--green)',
  'Insurance': 'var(--dim)',
  'Storage': 'var(--dim)',
  'Other': 'var(--dim)',
};

export default function ExpensesPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    supabase.from('expenses').select('*').order('date', { ascending: false })
      .then(({ data }) => { if (data) setExpenses(data as Expense[]); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let result = expenses;
    if (dateFrom) result = result.filter(e => e.date >= dateFrom);
    if (dateTo) result = result.filter(e => e.date <= dateTo);
    return result;
  }, [expenses, dateFrom, dateTo]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  // Category totals
  const catTotals = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const catList = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  async function handleSave(data: Partial<Expense>) {
    if (editExpense) {
      const { data: updated, error } = await supabase.from('expenses').update(data).eq('id', editExpense.id).select().single();
      if (error) { showToast('Failed to save', 'error'); return; }
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? updated as Expense : e));
      setEditExpense(null);
    } else {
      const { data: newExp, error } = await supabase.from('expenses').insert(data).select().single();
      if (error) { showToast('Failed to add', 'error'); return; }
      setExpenses(prev => [newExp as Expense, ...prev]);
      setShowAdd(false);
    }
    showToast('Saved', 'success');
  }

  async function handleDelete(expense: Expense) {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', expense.id);
    setExpenses(prev => prev.filter(e => e.id !== expense.id));
    showToast('Deleted', 'success');
  }

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Expenses</h1>
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '2px' }}>Business expense log · {expenses.length} entries</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => exportExpensesCSV(filtered)}
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', padding: '9px 16px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
          >
            ↓ EXPORT CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '9px 18px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}
          >
            + LOG EXPENSE
          </button>
        </div>
      </div>

      {/* Date filter + summary */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--dim)' }}>
          <span>From</span>
          <input type="date" className="input-base" style={{ width: '140px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span>to</span>
          <input type="date" className="input-base" style={{ width: '140px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {filtered.length > 0 && (
          <div style={{ fontSize: '15px', fontFamily: 'var(--font-barlow)', fontWeight: 700, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
            Total: -${totalFiltered.toFixed(2)}
          </div>
        )}
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No expenses logged"
          description="Track shipping supplies, grading fees, platform costs, travel, and anything else related to your card business. Export to CSV at tax time."
          action={
            <button onClick={() => setShowAdd(true)} style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer' }}>
              + LOG FIRST EXPENSE
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Expense list */}
          <div style={{ gridColumn: '1 / -1' }}>
            {catList.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {catList.map(([cat, total]) => (
                  <div key={cat} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '7px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat}</div>
                    <div style={{ fontSize: '16px', fontFamily: 'var(--font-barlow)', fontWeight: 700, color: CAT_COLOR[cat] ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      ${total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(expense => (
                    <tr key={expense.id}>
                      <td style={{ color: 'var(--dim)', fontSize: '13px' }}>{new Date(expense.date).toLocaleDateString()}</td>
                      <td>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-barlow)', fontWeight: 700, color: CAT_COLOR[expense.category] ?? 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {expense.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--dim)', fontSize: '13px' }}>{expense.vendor ?? '—'}</td>
                      <td style={{ color: 'var(--text)', fontSize: '13px' }}>{expense.description ?? '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                        -${expense.amount.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditExpense(expense)} style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}>Edit</button>
                          <button onClick={() => handleDelete(expense)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAdd && <ExpenseFormModal onSave={handleSave} onClose={() => setShowAdd(false)} />}
      {editExpense && <ExpenseFormModal initial={editExpense} onSave={handleSave} onClose={() => setEditExpense(null)} />}
      <ToastComponent />
    </div>
  );
}
