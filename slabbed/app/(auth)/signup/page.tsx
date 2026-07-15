'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/app');
      router.refresh();
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '32px', color: 'var(--text)' }}>
              SLABB<span style={{ color: 'var(--gold)' }}>ED</span>
            </span>
          </Link>
          <p style={{ color: 'var(--dim)', fontSize: '14px', marginTop: '4px' }}>14-day free trial • No card required</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '24px', marginBottom: '8px', color: 'var(--text)' }}>
            Create your account
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--dim)', marginBottom: '24px' }}>
            Start tracking your card business — free for 14 days.
          </p>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--dim)', marginBottom: '6px' }}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input-base"
                placeholder="Your name or handle"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--dim)', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-base"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--dim)', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
                placeholder="Min. 8 characters"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(227,90,82,0.1)', border: '1px solid var(--red)', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--gold)',
                color: '#0e1116',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px',
                fontFamily: 'var(--font-barlow)',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: '0.05em',
              }}
            >
              {loading ? 'Creating account…' : 'START FREE TRIAL'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--dim)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
          <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--dim)' }}>
            $10/month after trial. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
