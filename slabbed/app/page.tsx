import Link from 'next/link';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="rgba(63,190,126,0.15)" />
      <path d="M5 8l2 2 4-4" stroke="#3fbe7e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  { icon: '📊', title: 'Real fee math on every sale', desc: 'Mark Sold pre-fills your platform fee % and shipping. See exact P/L before you confirm — eBay, Whatnot, Fanatics, all of them.' },
  { icon: '🔄', title: 'Full pipeline tracking', desc: 'One click moves a card: Incoming → Grading → Inventory → Listed → Sold. Your whole business in one tab.' },
  { icon: '🎯', title: 'Max-bid calculator', desc: 'Enter a comp and your max bid. Instantly see your expected profit after fees — so you know your ceiling before the auction ends.' },
  { icon: '📋', title: 'Tax-ready CSV exports', desc: 'Export your Sold history and Expenses to CSV anytime. Hand it to your accountant, done.' },
  { icon: '🔗', title: 'Live inventory share link', desc: 'Copy a link and share your live inventory with buyers. They see what you have and at what price — no spreadsheets, no DMs.' },
  { icon: '📈', title: 'Dashboard that shows your numbers', desc: 'Unrealized P/L, realized profit, category breakdown, biggest paper gains. Know if you\'re actually making money.' },
];

const FAQ = [
  {
    q: 'Does it import from my existing spreadsheet?',
    a: 'v1.1 will have a CSV import wizard for spreadsheet migration. For now, add cards manually — most flippers add their active inventory in under 30 minutes.',
  },
  {
    q: 'Will you add eBay/Whatnot API sync?',
    a: 'It\'s on the roadmap. v1 is a fast, accurate ledger. Integrations come after we make sure the core is rock solid.',
  },
  {
    q: 'What platforms does the fee calculator support?',
    a: 'You set your own fee % per sale — works with any platform. Default is 13.25% (eBay), but you can override it for Whatnot (8%), Fanatics (8%), or any other platform.',
  },
  {
    q: 'Is my data private?',
    a: 'Completely. Cost, P/L, and financial data are always private. The optional public share link only shows card names, grades, and asking prices — nothing sensitive.',
  },
  {
    q: 'What happens after the 14-day trial?',
    a: '$10/month. No card required to start the trial. Cancel anytime from Settings.',
  },
];

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--line)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px', position: 'sticky', top: 0, background: 'rgba(14,17,22,0.95)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '24px' }}>
          SLABB<span style={{ color: 'var(--gold)' }}>ED</span>
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/login" style={{ color: 'var(--dim)', textDecoration: 'none', fontSize: '14px' }}>Sign in</Link>
          <Link href="/signup" style={{ background: 'var(--gold)', color: '#0e1116', textDecoration: 'none', padding: '7px 16px', borderRadius: '7px', fontSize: '14px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>
            START FREE TRIAL
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 32px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(230,185,63,0.1)', border: '1px solid rgba(230,185,63,0.3)', borderRadius: '20px', padding: '4px 14px', fontSize: '13px', color: 'var(--gold)', marginBottom: '20px', fontWeight: 500 }}>
            QuickBooks for card flippers
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 'clamp(36px, 6vw, 64px)', lineHeight: 1.05, marginBottom: '20px', color: 'var(--text)' }}>
            Know your actual profit<br />on every flip.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--dim)', maxWidth: '560px', margin: '0 auto 32px', lineHeight: 1.6 }}>
            Fee-aware P/L on every sale. Buy-to-sold pipeline tracking. Tax-ready exports. $10/month — cancel anytime.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ background: 'var(--gold)', color: '#0e1116', textDecoration: 'none', padding: '13px 28px', borderRadius: '8px', fontSize: '16px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>
              START 14-DAY FREE TRIAL
            </Link>
            <Link href="/login" style={{ background: 'transparent', color: 'var(--text)', textDecoration: 'none', padding: '13px 28px', borderRadius: '8px', fontSize: '16px', border: '1px solid var(--line)' }}>
              Sign in
            </Link>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '12px' }}>No credit card required to start.</p>
        </div>

        {/* Dashboard mockup */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '24px', marginBottom: '80px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          {/* Fake KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Cards Held', value: '47' },
              { label: 'Inventory Cost', value: '$8,240' },
              { label: 'Est. Value', value: '$11,800' },
              { label: 'Unrealized P/L', value: '+$3,560', green: true },
              { label: 'Cards Sold', value: '183' },
              { label: 'Realized Profit', value: '+$12,440', green: true },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</div>
                <div style={{ fontSize: '20px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: k.green ? 'var(--green)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              </div>
            ))}
          </div>
          {/* Fake table rows */}
          <div style={{ background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 2 }}>Card</span>
              <span style={{ fontSize: '11px', color: 'var(--dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, textAlign: 'right' }}>Cost</span>
              <span style={{ fontSize: '11px', color: 'var(--dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, textAlign: 'right' }}>Value</span>
              <span style={{ fontSize: '11px', color: 'var(--dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, textAlign: 'right' }}>Paper P/L</span>
            </div>
            {[
              { name: '2023 Topps Chrome Shohei Ohtani RC #700', chip: 'PSA 10', cost: '$240', value: '$580', pl: '+$340', good: true },
              { name: '2021 Prizm Ja Morant #65 Silver', chip: 'BGS 9.5', cost: '$180', value: '$310', pl: '+$130', good: true },
              { name: '2020 Topps Bowman Wander Franco Auto', chip: 'SGC 10', cost: '$420', value: '$340', pl: '-$80', good: false },
              { name: '2022 Panini Prizm LeBron James #112', chip: 'PSA 9', cost: '$95', value: '$165', pl: '+$70', good: true },
            ].map((row, i) => (
              <div key={i} style={{ padding: '11px 14px', borderBottom: i < 3 ? '1px solid var(--line)' : 'none', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 2, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{row.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f5f0e8', borderLeft: '3px solid var(--psa-red)', borderRadius: '3px', padding: '1px 5px', fontSize: '10px', color: '#1a1a1a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                    {row.chip}
                  </span>
                </div>
                <span style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--dim)', fontSize: '13px' }}>{row.cost}</span>
                <span style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px' }}>{row.value}</span>
                <span style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: row.good ? 'var(--green)' : 'var(--red)' }}>{row.pl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Problem statement */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '32px', marginBottom: '16px' }}>
            Stop running your card business in a spreadsheet.
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--dim)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.6 }}>
            Spreadsheets don't know about eBay fees. They don't track grading timelines. They can't tell you your real profit after all costs. <strong style={{ color: 'var(--text)' }}>Slabbed does all of that, automatically.</strong>
          </p>
        </div>

        {/* Features grid */}
        <div style={{ marginBottom: '80px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '28px', textAlign: 'center', marginBottom: '32px' }}>
            Everything a serious card flipper needs
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{f.icon}</div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--dim)', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '32px', marginBottom: '8px' }}>Simple pricing</h2>
          <p style={{ color: 'var(--dim)', fontSize: '15px', marginBottom: '32px' }}>One plan, everything included.</p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: '14px', padding: '36px 40px', display: 'inline-block', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '48px', color: 'var(--gold)', marginBottom: '4px' }}>$10</div>
            <div style={{ color: 'var(--dim)', fontSize: '14px', marginBottom: '24px' }}>per month</div>
            <ul style={{ listStyle: 'none', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                'Unlimited cards & sales',
                'Full pipeline tracking',
                'Real fee math & P/L',
                'Max-bid calculator',
                'Public inventory share link',
                'CSV exports (tax-ready)',
                'Business expense log',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                  <CheckIcon /> {item}
                </li>
              ))}
            </ul>
            <Link href="/signup" style={{ display: 'block', background: 'var(--gold)', color: '#0e1116', textDecoration: 'none', padding: '12px', borderRadius: '8px', fontSize: '15px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em', textAlign: 'center' }}>
              START 14-DAY FREE TRIAL
            </Link>
            <p style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '10px' }}>No credit card required. Cancel anytime.</p>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: '80px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '28px', textAlign: 'center', marginBottom: '28px' }}>
            FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px', margin: '0 auto' }}>
            {FAQ.map(item => (
              <div key={item.q} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '8px', color: 'var(--text)' }}>{item.q}</div>
                <div style={{ fontSize: '14px', color: 'var(--dim)', lineHeight: 1.5 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '36px', marginBottom: '16px' }}>
            Ready to know your actual numbers?
          </h2>
          <Link href="/signup" style={{ display: 'inline-block', background: 'var(--gold)', color: '#0e1116', textDecoration: 'none', padding: '14px 32px', borderRadius: '8px', fontSize: '17px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>
            START FREE TRIAL →
          </Link>
          <p style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '10px' }}>14 days free. No card required.</p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '24px 32px', textAlign: 'center', fontSize: '13px', color: 'var(--dim)' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginRight: '16px' }}>SLABBED</span>
        © {new Date().getFullYear()} · Built for card flippers, by card flippers.
      </footer>
    </div>
  );
}
