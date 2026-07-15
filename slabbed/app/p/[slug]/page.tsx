import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { PublicCard } from '@/lib/supabase/types';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface PageProps {
  params: { slug: string };
}

export default async function PublicInventoryPage({ params }: PageProps) {
  const { slug } = params;
  const supabase = getClient();

  const [profileRes, cardsRes] = await Promise.all([
    supabase.rpc('get_public_profile', { p_slug: slug }),
    supabase.rpc('get_public_inventory', { p_slug: slug }),
  ]);

  const profile = profileRes.data as { display_name: string; share_slug: string } | null;
  const cards = (cardsRes.data ?? []) as PublicCard[];

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '32px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '28px', marginBottom: '8px' }}>Inventory not found</h1>
        <p style={{ color: 'var(--dim)', fontSize: '14px', marginBottom: '24px' }}>This share link may be invalid or the seller has turned off public sharing.</p>
        <Link href="/" style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '14px' }}>← Back to Slabbed</Link>
      </div>
    );
  }

  const categories = cards.reduce<Record<string, PublicCard[]>>((acc, c) => {
    const cat = c.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const categoryList = Object.entries(categories).sort((a, b) => b[1].length - a[1].length);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '22px' }}>
          SLABB<span style={{ color: 'var(--gold)' }}>ED</span>
        </span>
        <Link href="/signup" style={{ background: 'var(--gold)', color: '#0e1116', textDecoration: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
          Track Your Collection →
        </Link>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '32px', color: 'var(--text)', marginBottom: '4px' }}>
            {profile.display_name}&apos;s Inventory
          </h1>
          <p style={{ color: 'var(--dim)', fontSize: '14px' }}>
            {cards.length} card{cards.length !== 1 ? 's' : ''} available · Live inventory from Slabbed
          </p>
        </div>

        {cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--dim)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🗃</div>
            <p style={{ fontSize: '16px' }}>No cards currently in inventory.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {categoryList.map(([category, catCards]) => (
              <div key={category}>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--line)' }}>
                  {category} <span style={{ color: 'var(--line)' }}>({catCards.length})</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {catCards.map((card, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{card.name}</span>
                          {(card.grade_co || card.grade) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f5f0e8', borderLeft: '3px solid #c8102e', borderRadius: '3px', padding: '1px 5px', fontSize: '11px', color: '#1a1a1a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {card.grade_co} {card.grade}
                            </span>
                          )}
                          {card.serial && (
                            <span style={{ fontSize: '11px', color: 'var(--dim)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--line)' }}>
                              {card.serial}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', background: card.status === 'listed' ? 'rgba(91,156,245,0.15)' : 'rgba(63,190,126,0.15)', color: card.status === 'listed' ? 'var(--blue)' : 'var(--green)', padding: '1px 6px', borderRadius: '4px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {card.status === 'listed' ? 'Listed' : 'Available'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {card.list_price !== null ? (
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                            ${card.list_price.toFixed(2)}
                          </div>
                        ) : card.true_value !== null ? (
                          <div>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>${card.true_value.toFixed(2)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--dim)' }}>est. value</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '14px', color: 'var(--dim)' }}>Ask for price</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '48px', textAlign: 'center', color: 'var(--dim)', fontSize: '13px' }}>
          Powered by{' '}
          <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>SLABBED</Link>
          {' '}· Track your card business →
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const supabase = getClient();
  const { data: profile } = await supabase.rpc('get_public_profile', { p_slug: params.slug });
  const p = profile as { display_name: string } | null;
  return {
    title: p ? `${p.display_name}'s Inventory | Slabbed` : 'Inventory | Slabbed',
    description: p ? `Browse ${p.display_name}'s live sports card inventory on Slabbed.` : 'Live sports card inventory',
  };
}
