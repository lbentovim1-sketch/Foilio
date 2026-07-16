import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';

// Simple in-process rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function collectImageUrls(value: unknown, path = '', results: string[] = []): string[] {
  if (typeof value === 'string') {
    const looksLikeUrl = /^https?:\/\//i.test(value);
    const imageRelatedPath = /(image|scan|front|back|url)/i.test(path);
    if (looksLikeUrl && imageRelatedPath && !results.includes(value)) results.push(value);
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectImageUrls(item, `${path}.${i}`, results));
    return results;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      collectImageUrls(child, `${path}.${key}`, results)
    );
  }
  return results;
}

function buildNormalized(psaCard: Record<string, string>, imageUrls: string[]) {
  const title = [psaCard.Year, psaCard.Brand, psaCard.Subject, psaCard.Variety]
    .filter(Boolean).join(' ');

  return {
    gradingCompany: 'PSA',
    certNumber: psaCard.CertNumber,
    psaSpecId: psaCard.SpecID ?? null,
    title,
    year: psaCard.Year ?? '',
    brand: psaCard.Brand ?? '',
    category: psaCard.Category ?? '',
    cardNumber: psaCard.CardNumber ?? '',
    subject: psaCard.Subject ?? '',
    variety: psaCard.Variety ?? '',
    grade: psaCard.CardGrade ?? '',
    gradeDescription: psaCard.GradeDescription ?? '',
    autographGrade: psaCard.AutographGrade ?? '',
    population: psaCard.TotalPopulation ?? null,
    populationHigher: psaCard.PopulationHigher ?? null,
    itemStatus: psaCard.ItemStatus ?? '',
    frontImageUrl: imageUrls[0] ?? null,
    backImageUrl: imageUrls[1] ?? null,
    images: imageUrls,
  };
}

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to use cert lookup.' }, { status: 401 });
  }

  // Rate limit per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Too many lookups — please wait a minute.' }, { status: 429 });
  }

  // Validate cert number
  const certInput = request.nextUrl.searchParams.get('cert') ?? '';
  const certNumber = certInput.replace(/\D/g, '');
  if (!/^\d{7,10}$/.test(certNumber)) {
    return NextResponse.json(
      { error: 'Enter a valid PSA cert number (7–10 digits).' },
      { status: 400 }
    );
  }

  // ── 1. Check cache first ────────────────────────────────
  const { data: cached } = await supabase
    .from('psa_cert_cache')
    .select('normalized, cached_at, expires_at')
    .eq('cert_number', certNumber)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached?.normalized) {
    console.log(`PSA cache HIT for cert ${certNumber}`);
    return NextResponse.json({
      ...cached.normalized,
      // Tell the frontend this came from cache
      rawPsaCard: {},
      imagesRaw: null,
      fromCache: true,
      cachedAt: cached.cached_at,
    });
  }

  console.log(`PSA cache MISS for cert ${certNumber} — calling PSA API`);

  // ── 2. Check API token ──────────────────────────────────
  const psaToken = process.env.PSA_API_TOKEN;
  if (!psaToken) {
    return NextResponse.json(
      { error: 'PSA lookup is not configured — add PSA_API_TOKEN in Vercel settings.' },
      { status: 503 }
    );
  }

  const headers = {
    Authorization: `Bearer ${psaToken}`,
    Accept: 'application/json',
  };

  // ── 3. Call PSA API ─────────────────────────────────────
  try {
    const [detailsRes, imagesRes] = await Promise.all([
      fetch(`${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, {
        headers, cache: 'no-store',
      }),
      fetch(`${PSA_API_BASE}/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`, {
        headers, cache: 'no-store',
      }),
    ]);

    if (detailsRes.status === 401 || detailsRes.status === 403) {
      return NextResponse.json(
        { error: 'PSA authentication failed — check your PSA_API_TOKEN in Vercel and redeploy.' },
        { status: 502 }
      );
    }

    if (!detailsRes.ok) {
      let psaError = '';
      try { psaError = await detailsRes.text(); } catch { /* ignore */ }
      console.error(`PSA details API ${detailsRes.status}:`, psaError);
      return NextResponse.json({
        error: `PSA returned status ${detailsRes.status}. ${psaError ? `Detail: ${psaError.slice(0, 300)}` : 'Try again or check the cert number.'}`,
      }, { status: 502 });
    }

    const details = await detailsRes.json();
    const imagesRaw = imagesRes.ok ? await imagesRes.json() : null;

    const psaCard = details?.PSACert;
    if (!psaCard || details?.IsValidRequest === false || details?.ServerMessage === 'No data found') {
      return NextResponse.json(
        { error: 'No PSA certification found for that number.' },
        { status: 404 }
      );
    }

    const imageUrls = collectImageUrls(imagesRaw);
    const normalized = buildNormalized(psaCard as Record<string, string>, imageUrls);

    // ── 4. Store in cache ───────────────────────────────────
    await supabase.from('psa_cert_cache').upsert({
      cert_number: certNumber,
      normalized,
      raw_psa: psaCard,
      raw_images: imagesRaw,
      front_image_url: imageUrls[0] ?? null,
      back_image_url: imageUrls[1] ?? null,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    }, { onConflict: 'cert_number' });

    console.log(`PSA cert ${certNumber} cached successfully`);

    return NextResponse.json({
      ...normalized,
      rawPsaCard: psaCard,
      imagesRaw,
      fromCache: false,
    });
  } catch (err) {
    console.error('PSA lookup error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during PSA lookup.' },
      { status: 500 }
    );
  }
}
