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

  // No subscription gate — app is free during beta
  return (
    <AppShellClient profile={profile as Profile | null}>
      {children}
    </AppShellClient>
  );
}
