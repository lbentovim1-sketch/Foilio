import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShellClient from './AppShellClient';
import type { Profile } from '@/lib/supabase/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const p = profile as Profile | null;

  // Subscription gate — allow trialing and active, block everything else
  if (p) {
    const status = p.subscription_status;

    // Check if trial has expired
    if (status === 'trialing' && p.trial_ends_at) {
      if (new Date(p.trial_ends_at) < new Date()) {
        const url = new URL('/app/settings', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
        url.searchParams.set('billing', '1');
        redirect(url.pathname + '?' + url.searchParams.toString());
      }
    }

    const isAllowed = status === 'trialing' || status === 'active';
    if (!isAllowed) {
      redirect('/app/settings?billing=1');
    }
  }

  return (
    <AppShellClient profile={p}>
      {children}
    </AppShellClient>
  );
}
