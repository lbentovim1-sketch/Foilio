import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_BASE_ALT = 'https://api.psacard.com/publicapi/cert';

// Simple in-process rate limiter — resets on cold start, good enough for edge rate abuse
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function collectImageUrls(
  value: unknown,
  path = '',
  results: string[] = []
): string[] {
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

export async function GET(request: NextRequest) {
  // Auth check — must be signed in
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to use cert lookup.' }, { status: 401 });
  }

  // Rate limit per user
  const ip = request.headers.get('x-forwarded-for') ?? user.id;
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many lookups — please wait a minute.' }, { status: 429 });
  }

  // Validate cert number
  const certInput = request.nextUrl.searchParams.get('cert') ?? '';
  const certNumber = certInput.replace(/\D/g, '');
  if (!/^\d{7,10}$/.test(certNumber)) {
    return NextResponse.json(
      { error: 'Enter a valid PSA certification number (7–10 digits).' },
      { status: 400 }
    );
  }

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

  try {
    const detailsUrl = `${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`;
    const imagesUrl = `${PSA_API_BASE}/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`;
    console.log('PSA lookup URL:', detailsUrl);

    const [detailsRes, imagesRes] = await Promise.all([
      fetch(detailsUrl, { headers, cache: 'no-store' }),
      fetch(imagesUrl, { headers, cache: 'no-store' }),
    ]);

    if (detailsRes.status === 401 || detailsRes.status === 403) {
      return NextResponse.json({ error: 'PSA authentication failed — check your PSA_API_TOKEN in Vercel and redeploy.' }, { status: 502 });
    }

    if (!detailsRes.ok) {
      let psaError = '';
      try { psaError = await detailsRes.text(); } catch { /* ignore */ }
      console.error(`PSA details API ${detailsRes.status}:`, psaError);
      return NextResponse.json({
        error: `PSA returned status ${detailsRes.status}. ${psaError ? `Detail: ${psaError.slice(0, 200)}` : 'Try again or check the cert number.'}`,
      }, { status: 502 });
    }

    const details = await detailsRes.json();
    const imagesRaw = imagesRes.ok ? await imagesRes.json() : null;
    console.log('PSA details response:', JSON.stringify(details).slice(0, 500));
    console.log('PSA images status:', imagesRes.status);

    const psaCard = details?.PSACert;
    if (!psaCard || details?.IsValidRequest === false || details?.ServerMessage === 'No data found') {
      return NextResponse.json({ error: 'No PSA certification found for that number.' }, { status: 404 });
    }

    const imageUrls = collectImageUrls(imagesRaw);
    const frontImageUrl = imageUrls[0] ?? null;
    const backImageUrl = imageUrls[1] ?? null;

    const title = [psaCard.Year, psaCard.Brand, psaCard.Subject, psaCard.Variety]
      .filter(Boolean)
      .join(' ');

    return NextResponse.json({
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

      frontImageUrl,
      backImageUrl,
      images: imageUrls,

      // Raw response stored for debugging and future field mapping
      imagesRaw,
      rawPsaCard: psaCard,
    });
  } catch (err) {
    console.error('PSA lookup error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred during PSA lookup.' }, { status: 500 });
  }
}
