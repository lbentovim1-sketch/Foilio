'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import type { Profile } from '@/lib/supabase/types';

function generateSlug(displayName: string): string {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).slice(2, 7);
}

export default function SettingsPage() {
  const supabase = createClient();
  const { showToast, ToastComponent } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    default_fee_pct: '13.25',
    default_shipping: '5.00',
    inventory_public: false,
    share_slug: '',
  });
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('*').single().then(({ data }) => {
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setForm({
          display_name: p.display_name ?? '',
          default_fee_pct: p.default_fee_pct?.toString() ?? '13.25',
          default_shipping: p.default_shipping?.toString() ?? '5.00',
          inventory_public: p.inventory_public ?? false,
          share_slug: p.share_slug ?? '',
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name,
      default_fee_pct: parseFloat(form.default_fee_pct),
      default_shipping: parseFloat(form.default_shipping),
      inventory_public: form.inventory_public,
      share_slug: form.share_slug || null,
    }).eq('id', profile!.id);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Settings saved', 'success');
    }
    setSaving(false);
  }

  async function handleGenerateSlug() {
    const slug = generateSlug(form.display_name || 'flipper');
    setForm(f => ({ ...f, share_slug: slug, inventory_public: true }));
    showToast('Slug generated — save your settings to activate', 'info');
  }

  function copyShareLink() {
    const url = `${window.location.origin}/p/${form.share_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-barlow)', fontWeight: 600 };
  const sectionStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '24px', marginBottom: '20px' };
  const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '18px', color: 'var(--text)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' };

  if (loading) return <div style={{ padding: '32px', color: 'var(--dim)' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '28px', color: 'var(--text)' }}>Settings</h1>
      </div>

      <form onSubmit={handleSave}>
        {/* Profile */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Profile</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Your name or handle" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={{ ...inputStyle, opacity: 0.6 }} value={profile?.email ?? ''} readOnly disabled />
            </div>
          </div>
        </div>

        {/* Default fees */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Default Selling Fees</h2>
          <p style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '16px' }}>
            Used as defaults in the Mark Sold modal. You can override per-sale.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Platform Fee %</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.01" style={inputStyle} value={form.default_fee_pct} onChange={e => setForm(f => ({ ...f, default_fee_pct: e.target.value }))} placeholder="13.25" />
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', fontSize: '14px' }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>eBay ~13.25%, Whatnot ~8%, Fanatics ~8%</div>
            </div>
            <div>
              <label style={labelStyle}>Default Shipping Out ($)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }}>$</span>
                <input type="number" step="0.01" style={{ ...inputStyle, paddingLeft: '22px' }} value={form.default_shipping} onChange={e => setForm(f => ({ ...f, default_shipping: e.target.value }))} placeholder="5.00" />
              </div>
            </div>
          </div>
        </div>

        {/* Public inventory share */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Public Inventory Link</h2>
          <p style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '16px' }}>
            Share a live view of your inventory with buyers — no spreadsheets, no DMs about what you have in stock.
            Only cards in <strong style={{ color: 'var(--text)' }}>Inventory</strong> or <strong style={{ color: 'var(--text)' }}>Listed</strong> status are shown. Cost, P/L, and financial data are always private.
          </p>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={form.inventory_public}
                onChange={e => setForm(f => ({ ...f, inventory_public: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }}
              />
              Make my inventory publicly viewable
            </label>
          </div>
          {form.inventory_public && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Your Share Slug</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={inputStyle}
                    value={form.share_slug}
                    onChange={e => setForm(f => ({ ...f, share_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    placeholder="your-name-abc12"
                  />
                  <button type="button" onClick={handleGenerateSlug} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 12px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Generate
                  </button>
                </div>
              </div>
              {form.share_slug && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--blue)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {typeof window !== 'undefined' ? window.location.origin : ''}/p/{form.share_slug}
                  </span>
                  <button type="button" onClick={copyShareLink} style={{ background: copySuccess ? 'var(--green)' : 'var(--blue)', border: 'none', borderRadius: '6px', color: '#0e1116', padding: '6px 12px', fontSize: '12px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
                    {copySuccess ? '✓ COPIED!' : 'COPY LINK'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} style={{ background: 'var(--gold)', border: 'none', borderRadius: '8px', color: '#0e1116', padding: '11px 24px', fontSize: '15px', fontFamily: 'var(--font-barlow)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, letterSpacing: '0.04em', width: '100%' }}>
          {saving ? 'SAVING…' : 'SAVE SETTINGS'}
        </button>
      </form>

      {/* Beta banner */}
      <div style={{ marginTop: '20px', background: 'rgba(230,185,63,0.08)', border: '1px solid rgba(230,185,63,0.3)', borderRadius: '10px', padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '15px', color: 'var(--gold)', marginBottom: '4px' }}>
          Beta — Free for Everyone
        </div>
        <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5 }}>
          Slabbed is free while we're in beta. No credit card, no trial timer, no limits. 
          We'll give you plenty of notice before anything changes.
        </div>
      </div>

      <ToastComponent />
    </div>
  );
}
