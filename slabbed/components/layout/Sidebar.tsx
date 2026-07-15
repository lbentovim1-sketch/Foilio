'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: '▦', exact: true },
  { href: '/app/buying', label: 'Buying', icon: '🎯' },
  { href: '/app/incoming', label: 'Incoming', icon: '📦' },
  { href: '/app/grading', label: 'Grading', icon: '🔍' },
  { href: '/app/inventory', label: 'Inventory', icon: '🗃' },
  { href: '/app/sold', label: 'Sold', icon: '✓' },
  { href: '/app/expenses', label: 'Expenses', icon: '📋' },
];

interface SidebarProps {
  profile: Profile | null;
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ profile, mobile, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside style={{
      width: mobile ? '100%' : '220px',
      minWidth: mobile ? undefined : '220px',
      background: 'var(--surface)',
      borderRight: mobile ? 'none' : '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <Link href="/app" style={{ textDecoration: 'none' }} onClick={onClose}>
          <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '26px', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            SLABB<span style={{ color: 'var(--gold)' }}>ED</span>
          </span>
        </Link>
        {profile?.display_name && (
          <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.display_name}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '7px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '2px',
              background: isActive(item.href, item.exact) ? 'var(--surface-2)' : 'transparent',
              color: isActive(item.href, item.exact) ? 'var(--text)' : 'var(--dim)',
              transition: 'all 0.1s',
              borderLeft: isActive(item.href, item.exact) ? '2px solid var(--gold)' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--line)' }}>
        <Link
          href="/app/settings"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '7px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '2px',
            background: isActive('/app/settings') ? 'var(--surface-2)' : 'transparent',
            color: isActive('/app/settings') ? 'var(--text)' : 'var(--dim)',
            borderLeft: isActive('/app/settings') ? '2px solid var(--gold)' : '2px solid transparent',
          }}
        >
          <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>⚙</span>
          Settings
        </Link>

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '7px',
            fontSize: '14px',
            fontWeight: 500,
            width: '100%',
            background: 'transparent',
            color: 'var(--dim)',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>↩</span>
          Sign out
        </button>

        {/* Subscription badge */}
        {profile && (
          <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {profile.subscription_status === 'trialing' ? 'Free Trial' :
               profile.subscription_status === 'active' ? 'Pro' :
               profile.subscription_status}
            </div>
            {profile.subscription_status === 'trialing' && profile.trial_ends_at && (
              <div style={{ fontSize: '12px', color: 'var(--gold)', marginTop: '2px' }}>
                Ends {new Date(profile.trial_ends_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
