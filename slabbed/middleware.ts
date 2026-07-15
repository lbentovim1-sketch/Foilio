import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Protect /app/* routes
  if (path.startsWith('/app')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check subscription status (allow trialing + active)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (profile) {
      const status = profile.subscription_status;
      const isAllowed = status === 'trialing' || status === 'active';

      // Check trial expiry
      if (status === 'trialing' && profile.trial_ends_at) {
        const trialEnd = new Date(profile.trial_ends_at);
        if (trialEnd < new Date()) {
          const settingsUrl = new URL('/app/settings', request.url);
          settingsUrl.searchParams.set('billing', '1');
          return NextResponse.redirect(settingsUrl);
        }
      }

      if (!isAllowed && path !== '/app/settings') {
        const settingsUrl = new URL('/app/settings', request.url);
        settingsUrl.searchParams.set('billing', '1');
        return NextResponse.redirect(settingsUrl);
      }
    }
  }

  // Redirect authenticated users away from auth pages
  if ((path === '/login' || path === '/signup') && user) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
