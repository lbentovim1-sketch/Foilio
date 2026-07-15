'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import type { Profile } from '@/lib/supabase/types';

interface AppShellClientProps {
  profile: Profile | null;
  children: React.ReactNode;
}

export default function AppShellClient({ profile, children }: AppShellClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="desktop-sidebar">
        <Sidebar profile={profile} />
      </div>

      {/* Actual desktop sidebar (always shown on md+) */}
      <div style={{
        width: '220px',
        minWidth: '220px',
        height: '100vh',
        display: 'flex',
        flexShrink: 0,
      }}
      className="hidden-mobile"
      >
        <Sidebar profile={profile} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <div style={{
            position: 'relative',
            width: '240px',
            height: '100%',
            zIndex: 41,
          }}>
            <Sidebar profile={profile} mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile topbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
        }}
        className="mobile-topbar"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
            }}
          >
            ☰
          </button>
          <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '22px' }}>
            SLABB<span style={{ color: 'var(--gold)' }}>ED</span>
          </span>
        </div>

        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .mobile-topbar { display: none !important; }
          .hidden-mobile { display: flex !important; }
        }
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .mobile-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
