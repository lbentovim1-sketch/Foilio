'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { Card, CardStatus, PSALookupResult } from '@/lib/supabase/types';

const CATEGORIES = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Pokemon', 'Other TCG', 'Other'];
const GRADE_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'TAG', 'Raw'];
const PLATFORMS = ['eBay', 'Whatnot', 'Fanatics Collect', 'MySlabs', 'COMC', 'Local', 'Other'];

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

// ── PSA Lookup Preview ─────────────────────────────────────
type LookupState = 'idle' | 'loading' | 'success' | 'error';

interface PSAPreviewProps {
  onUse: (result: PSALookupResult) => void;
}

function PSACertLookup({ onUse }: PSAPreviewProps) {
  const [certInput, setCertInput] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PSALookupResult | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  async function lookup() {
    const cert = certInput.replace(/\D/g, '');
    if (!/^\d{7,10}$/.test(cert)) {
      setError('Enter a valid PSA cert number (7–10 digits).');
      setState('error');
      return;
    }
    setState('loading');
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/psa/lookup?cert=${cert}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'PSA lookup failed.');
        setState('error');
      } else {
        setResult(data as PSALookupResult);
        setState('success');
      }
    } catch {
      setError('Could not reach the lookup service — check your connection.');
      setState('error');
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); lookup(); }
  }

  function clear() {
    setCertInput('');
    setState('idle');
    setError('');
    setResult(null);
    setImgErrors({});
  }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', color: 'var(--dim)', fontFamily: 'var(--font-barlow)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
        PSA Cert Lookup — type or scan to auto-fill
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', letterSpacing: '0.06em' }}
          value={certInput}
          onChange={e => { setCertInput(e.target.value); if (state === 'error') setState('idle'); }}
          onKeyDown={handleKey}
          placeholder="e.g. 12345678  (scan or type)"
          inputMode="numeric"
          autoComplete="off"
          disabled={state === 'loading'}
        />
        <button
          type="button"
          onClick={lookup}
          disabled={state === 'loading'}
          style={{ background: 'var(--psa-red)', border: 'none', borderRadius: '6px', color: '#fff', padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: state === 'loading' ? 'wait' : 'pointer', opacity: state === 'loading' ? 0.7 : 1, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}
        >
          {state === 'loading' ? 'Looking up…' : 'LOOK UP'}
        </button>
      </div>

      {/* Error state */}
      {state === 'error' && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(227,90,82,0.08)', border: '1px solid rgba(227,90,82,0.3)', borderRadius: '6px', padding: '10px 12px' }}>
          <span style={{ color: 'var(--red)', fontSize: '14px', flexShrink: 0 }}>✕</span>
          <span style={{ color: 'var(--red)', fontSize: '13px', lineHeight: 1.4 }}>{error}</span>
        </div>
      )}

      {/* Loading shimmer */}
      {state === 'loading' && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '110px', background: 'var(--line)', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '80px', height: '110px', background: 'var(--line)', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ flex: 1 }}>
            {[100, 70, 50].map((w, i) => (
              <div key={i} style={{ height: '14px', background: 'var(--line)', borderRadius: '4px', marginBottom: '8px', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
        </div>
      )}

      {/* Success preview */}
      {state === 'success' && result && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            {/* Card images */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {[result.frontImageUrl, result.backImageUrl].map((url, i) => (
                url && !imgErrors[url] ? (
                  <div key={i} style={{ width: '80px', height: '110px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', flexShrink: 0 }}>
                    <img
                      src={url}
                      alt={i === 0 ? 'Front' : 'Back'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setImgErrors(p => ({ ...p, [url]: true }))}
                    />
                  </div>
                ) : (
                  <div key={i} style={{ width: '80px', height: '110px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '22px' }}>{i === 0 ? '🃏' : '↩'}</span>
                  </div>
                )
              ))}
            </div>

            {/* Card details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.3 }}>
                {result.title || `PSA Cert #${result.certNumber}`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <span style={{ background: '#f5f0e8', borderLeft: '3px solid var(--psa-red)', borderRadius: '3px', padding: '2px 7px', fontSize: '12px', color: '#1a1a1a', fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                  PSA {result.grade}
                </span>
                {result.gradeDescription && (
                  <span style={{ fontSize: '12px', color: 'var(--dim)' }}>{result.gradeDescription}</span>
                )}
                {result.autographGrade && (
                  <span style={{ fontSize: '12px', color: 'var(--gold)' }}>Auto: {result.autographGrade}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px' }}>
                <span style={{ color: 'var(--dim)' }}>Cert #<span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{result.certNumber}</span></span>
                {result.cardNumber && <span style={{ color: 'var(--dim)' }}>Card # <span style={{ color: 'var(--text)' }}>{result.cardNumber}</span></span>}
                {result.population !== null && (
                  <span style={{ color: 'var(--dim)' }}>Pop <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{result.population}</span></span>
                )}
                {result.populationHigher !== null && (
                  <span style={{ color: 'var(--dim)' }}>Pop Higher <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{result.populationHigher}</span></span>
                )}
                {result.itemStatus && (
                  <span style={{ color: 'var(--dim)' }}>Status <span style={{ color: result.itemStatus === 'Y' ? 'var(--green)' : 'var(--dim)' }}>{result.itemStatus === 'Y' ? 'Valid' : result.itemStatus}</span></span>
                )}
              </div>
            </div>
          </div>

          {/* Cache indicator */}
          {result.fromCache && (
            <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--green)' }}>⚡</span>
              Loaded from cache — no PSA API call used
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onUse(result)}
              style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: '7px', color: '#0e1116', padding: '10px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
            >
              USE THESE DETAILS ↓
            </button>
            <button
              type="button"
              onClick={clear}
              style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '7px', color: 'var(--dim)', padding: '10px 14px', fontSize: '13px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────

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
  // PSA cert fields
  cert_number: string;
  psa_spec_id: string;
  population: string;
  population_higher: string;
  front_image_url: string;
  back_image_url: string;
};

export default function CardFormModal({ initialData, defaultStatus = 'inventory', onSave, onClose }: CardFormModalProps) {
  const isEdit = !!initialData?.id;
  const [saving, setSaving] = useState(false);
  const [psaResult, setPsaResult] = useState<PSALookupResult | null>(null);

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
    cert_number: initialData?.cert_number ?? '',
    psa_spec_id: initialData?.psa_spec_id ?? '',
    population: initialData?.population?.toString() ?? '',
    population_higher: initialData?.population_higher?.toString() ?? '',
    front_image_url: initialData?.front_image_url ?? '',
    back_image_url: initialData?.back_image_url ?? '',
  });

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function applyPSAResult(result: PSALookupResult) {
    setPsaResult(result);
    setForm(f => ({
      ...f,
      name: result.title || f.name,
      grade_co: 'PSA',
      grade: result.grade,
      cert_number: result.certNumber,
      psa_spec_id: result.psaSpecId ?? '',
      population: result.population?.toString() ?? '',
      population_higher: result.populationHigher?.toString() ?? '',
      front_image_url: result.frontImageUrl ?? '',
      back_image_url: result.backImageUrl ?? '',
      category: mapPSACategory(result.category) || f.category,
    }));
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
      // PSA cert fields
      cert_number: form.cert_number || null,
      psa_spec_id: form.psa_spec_id || null,
      population: form.population ? parseInt(form.population) : null,
      population_higher: form.population_higher ? parseInt(form.population_higher) : null,
      front_image_url: form.front_image_url || null,
      back_image_url: form.back_image_url || null,
      cert_verified_at: psaResult ? new Date().toISOString() : (initialData?.cert_verified_at ?? null),
      cert_lookup_source: psaResult ? 'psa_api' : (initialData?.cert_lookup_source ?? null),
      cert_source_data: psaResult ? { psaCard: psaResult.rawPsaCard, imagesRaw: psaResult.imagesRaw } : (initialData?.cert_source_data ?? null),
    };
    await onSave(payload);
    setSaving(false);
  }

  const showTracking = form.status === 'incoming';
  const showGrading = form.status === 'grading';
  const showListing = form.status === 'listed';
  const hasPSAData = !!form.cert_number && form.grade_co === 'PSA';

  return (
    <Modal title={isEdit ? 'Edit Card' : 'Add Card'} onClose={onClose} maxWidth={620}>
      <form onSubmit={handleSubmit}>

        {/* PSA cert lookup — new cards only */}
        {!isEdit && <PSACertLookup onUse={applyPSAResult} />}

        {/* PSA data applied banner */}
        {hasPSAData && (
          <div style={{ background: 'rgba(63,190,126,0.08)', border: '1px solid rgba(63,190,126,0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--green)' }}>✓</span>
            <span style={{ color: 'var(--dim)' }}>PSA data applied — cert <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{form.cert_number}</span></span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

          {/* Card name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Card Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. 2023 Topps Chrome Mike Trout #1" required />
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
            <input style={inputStyle} value={form.grade} onChange={e => set('grade', e.target.value)} placeholder="10, 9.5, 8, etc." />
          </div>

          <div>
            <label style={labelStyle}>Serial #</label>
            <input style={inputStyle} value={form.serial} onChange={e => set('serial', e.target.value)} placeholder="29/50" />
          </div>

          <div>
            <label style={labelStyle}>Cost Basis ($) *</label>
            <input type="number" step="0.01" style={inputStyle} value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0.00" required />
          </div>

          <div>
            <label style={labelStyle}>Date Bought</label>
            <input type="date" style={inputStyle} value={form.date_bought} onChange={e => set('date_bought', e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Source / Bought From</label>
            <input style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)} placeholder="eBay, Card show, etc." />
          </div>

          <div>
            <label style={labelStyle}>True Value / Comp ($)</label>
            <input type="number" step="0.01" style={inputStyle} value={form.true_value} onChange={e => set('true_value', e.target.value)} placeholder="Market comp" />
          </div>

          {showTracking && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tracking Number</label>
              <input style={inputStyle} value={form.tracking} onChange={e => set('tracking', e.target.value)} placeholder="1Z999AA10123456784" />
            </div>
          )}

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
              <input type="number" step="0.01" style={inputStyle} value={form.grading_fee} onChange={e => set('grading_fee', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Submitted Date</label>
              <input type="date" style={inputStyle} value={form.submitted_date} onChange={e => set('submitted_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Expected Grade</label>
              <input style={inputStyle} value={form.expected_grade} onChange={e => set('expected_grade', e.target.value)} placeholder="PSA 10?" />
            </div>
          </>}

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
              <input type="number" step="0.01" style={inputStyle} value={form.list_price} onChange={e => set('list_price', e.target.value)} placeholder="0.00" />
            </div>
          </>}

          {/* PSA cert fields — editable if manually entered */}
          {form.grade_co === 'PSA' && (
            <>
              <div>
                <label style={labelStyle}>PSA Cert #</label>
                <input style={{ ...inputStyle, fontFamily: 'monospace' }} value={form.cert_number} onChange={e => set('cert_number', e.target.value.replace(/\D/g, ''))} placeholder="12345678" />
              </div>
              {(form.population || form.population_higher) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Pop</label>
                    <input type="number" style={inputStyle} value={form.population} onChange={e => set('population', e.target.value)} placeholder="0" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Pop Higher</label>
                    <input type="number" style={inputStyle} value={form.population_higher} onChange={e => set('population_higher', e.target.value)} placeholder="0" />
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this card…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '7px', color: 'var(--dim)', padding: '9px 20px', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ background: 'var(--gold)', border: 'none', borderRadius: '7px', color: '#0e1116', padding: '9px 24px', fontSize: '14px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, letterSpacing: '0.04em' }}>
            {saving ? 'Saving…' : isEdit ? 'SAVE CHANGES' : 'ADD CARD'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function mapPSACategory(psaCat: string): string {
  const c = psaCat?.toLowerCase() ?? '';
  if (c.includes('baseball')) return 'Baseball';
  if (c.includes('basketball')) return 'Basketball';
  if (c.includes('football')) return 'Football';
  if (c.includes('hockey')) return 'Hockey';
  if (c.includes('soccer')) return 'Soccer';
  if (c.includes('pokemon') || c.includes('pokémon')) return 'Pokemon';
  return '';
}
