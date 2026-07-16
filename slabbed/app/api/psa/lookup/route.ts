import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PARSE_SCRAPER_URL = 'https://api.parse.bot/scraper/311daf8c-242f-4c68-af70-b50617fd1d13';
const PSA_API_BASE = 'https://api.psacard.com/publicapi';

// Simple in-process rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function collectImageUrls(value: unknown, path = '', results: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /(image|scan|front|back|url)/i.test(path) && !results.includes(value))
      results.push(value);
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectImageUrls(item, `${path}.${i}`, results));
    return results;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      collectImageUrls(v, `${path}.${k}`, results)
    );
  }
  return results;
}

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to use cert lookup.' }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Too many lookups — please wait a minute.' }, { status: 429 });
  }

  // Validate cert number
  const certInput = request.nextUrl.searchParams.get('cert') ?? '';
  const certNumber = certInput.replace(/\D/g, '');
  if (!/^\d{7,10}$/.test(certNumber)) {
    return NextResponse.json({ error: 'Enter a valid PSA cert number (7–10 digits).' }, { status: 400 });
  }

  // ── 1. Check Supabase cache first ──────────────────────
  const { data: cached } = await supabase
    .from('psa_cert_cache')
    .select('normalized, cached_at')
    .eq('cert_number', certNumber)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached?.normalized) {
    console.log(`Cache HIT for cert ${certNumber}`);
    return NextResponse.json({ ...cached.normalized, rawPsaCard: {}, imagesRaw: null, fromCache: true, cachedAt: cached.cached_at });
  }

  console.log(`Cache MISS for cert ${certNumber}`);

  // ── 2. Try Parse.bot first (no daily limit) ────────────
  const parseKey = process.env.PARSE_API_KEY;
  if (parseKey) {
    try {
      const res = await fetch(`${PARSE_SCRAPER_URL}/get_cert_details?cert_number=${encodeURIComponent(certNumber)}`, {
        headers: {
          'X-API-Key': parseKey,
          'API-Snapshot-Version': '5',
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      console.log('Parse.bot response status:', res.status);

      if (res.ok) {
        const json = await res.json();
        console.log('Parse.bot response:', JSON.stringify(json).slice(0, 400));
        const data = json?.data ?? json;

        if (data) {
          // Parse.bot returns: card_title, grade, images (array), subject, year, brand, population, cert_number
          const images: string[] = Array.isArray(data.images) ? data.images : [];
          const gradeRaw: string = data.grade ?? '';
          // grade comes as "GEM MT 10" — extract the number
          const gradeNum = gradeRaw.match(/\d+(?:\.\d+)?$/)?.[0] ?? gradeRaw;

          const normalized = {
            gradingCompany: 'PSA',
            certNumber: certNumber,
            psaSpecId: null,
            title: data.card_title ?? data.title ?? '',
            year: data.year ?? '',
            brand: data.brand ?? '',
            category: data.category ?? '',
            cardNumber: data.card_number ?? '',
            subject: data.subject ?? '',
            variety: data.variety ?? '',
            grade: gradeNum,
            gradeDescription: gradeRaw,
            autographGrade: data.autograph_grade ?? '',
            population: data.population ? parseInt(String(data.population).replace(/\D/g, '')) || null : null,
            populationHigher: data.population_higher ?? null,
            itemStatus: data.item_status ?? '',
            frontImageUrl: images[0] ?? null,
            backImageUrl: images[1] ?? null,
            images,
          };

          // Cache it
          await supabase.from('psa_cert_cache').upsert({
            cert_number: certNumber,
            normalized,
            raw_psa: data,
            raw_images: { images },
            front_image_url: images[0] ?? null,
            back_image_url: images[1] ?? null,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'cert_number' });

          return NextResponse.json({ ...normalized, rawPsaCard: data, imagesRaw: null, fromCache: false });
        }
      }

      // Parse.bot failed — log why and fall through to PSA
      const errText = await res.text().catch(() => '');
      console.error(`Parse.bot ${res.status}:`, errText.slice(0, 300));
    } catch (e) {
      console.error('Parse.bot error:', e);
    }
  } else {
    console.log('PARSE_API_KEY not set — skipping Parse.bot');
  }

  // ── 3. Fallback: PSA official API ──────────────────────
  const psaToken = process.env.PSA_API_TOKEN;
  if (!psaToken) {
    return NextResponse.json(
      { error: 'No lookup service configured. Add PARSE_API_KEY or PSA_API_TOKEN in Vercel settings.' },
      { status: 503 }
    );
  }

  try {
    const headers = { Authorization: `Bearer ${psaToken}`, Accept: 'application/json' };
    const [detailsRes, imagesRes] = await Promise.all([
      fetch(`${PSA_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, { headers, cache: 'no-store' }),
      fetch(`${PSA_API_BASE}/cert/GetImagesByCertNumber/${encodeURIComponent(certNumber)}`, { headers, cache: 'no-store' }),
    ]);

    if (detailsRes.status === 401 || detailsRes.status === 403) {
      return NextResponse.json({ error: 'PSA authentication failed — check PSA_API_TOKEN in Vercel.' }, { status: 502 });
    }

    if (!detailsRes.ok) {
      const body = await detailsRes.text().catch(() => '');
      return NextResponse.json({ error: `PSA returned status ${detailsRes.status}. ${body.slice(0, 200)}` }, { status: 502 });
    }

    const details = await detailsRes.json();
    const imagesRaw = imagesRes.ok ? await imagesRes.json() : null;
    const psaCard = details?.PSACert;

    if (!psaCard || details?.IsValidRequest === false) {
      return NextResponse.json({ error: 'No PSA certification found for that number.' }, { status: 404 });
    }

    const imageUrls = collectImageUrls(imagesRaw);
    const title = [psaCard.Year, psaCard.Brand, psaCard.Subject, psaCard.Variety].filter(Boolean).join(' ');
    const normalized = {
      gradingCompany: 'PSA', certNumber: psaCard.CertNumber, psaSpecId: psaCard.SpecID ?? null,
      title, year: psaCard.Year ?? '', brand: psaCard.Brand ?? '', category: psaCard.Category ?? '',
      cardNumber: psaCard.CardNumber ?? '', subject: psaCard.Subject ?? '', variety: psaCard.Variety ?? '',
      grade: psaCard.CardGrade ?? '', gradeDescription: psaCard.GradeDescription ?? '',
      autographGrade: psaCard.AutographGrade ?? '',
      population: psaCard.TotalPopulation ?? null, populationHigher: psaCard.PopulationHigher ?? null,
      itemStatus: psaCard.ItemStatus ?? '',
      frontImageUrl: imageUrls[0] ?? null, backImageUrl: imageUrls[1] ?? null, images: imageUrls,
    };

    await supabase.from('psa_cert_cache').upsert({
      cert_number: certNumber, normalized, raw_psa: psaCard, raw_images: imagesRaw,
      front_image_url: imageUrls[0] ?? null, back_image_url: imageUrls[1] ?? null,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'cert_number' });

    return NextResponse.json({ ...normalized, rawPsaCard: psaCard, imagesRaw, fromCache: false });
  } catch (err) {
    console.error('PSA API error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
