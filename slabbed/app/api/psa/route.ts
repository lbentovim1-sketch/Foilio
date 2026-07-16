import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cert = request.nextUrl.searchParams.get('cert');
  if (!cert) {
    return NextResponse.json({ error: 'Missing cert number' }, { status: 400 });
  }

  const cleanCert = cert.trim().replace(/\D/g, '');
  if (!cleanCert) {
    return NextResponse.json({ error: 'Invalid cert number' }, { status: 400 });
  }

  // 1. Try PSA official API with key (most reliable)
  const apiKey = process.env.PSA_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.psacard.com/publicapi/cert/GetByCertNumber/${cleanCert}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          next: { revalidate: 0 },
        }
      );
      if (res.ok) {
        const json = await res.json();
        const c = json?.PSACert;
        if (c) return NextResponse.json(mapPSAResponse(c));
      }
    } catch { /* fall through */ }
  }

  // 2. Try PSA public API without key (sometimes works for basic lookups)
  try {
    const res = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${cleanCert}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      }
    );
    if (res.ok) {
      const json = await res.json();
      const c = json?.PSACert;
      if (c) return NextResponse.json(mapPSAResponse(c));
    }
  } catch { /* fall through */ }

  // 3. Try PSA cert verification JSON endpoint
  try {
    const res = await fetch(
      `https://www.psacard.com/publicapi/cert/GetByCertNumber/${cleanCert}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        next: { revalidate: 0 },
      }
    );
    if (res.ok) {
      const json = await res.json();
      const c = json?.PSACert;
      if (c) return NextResponse.json(mapPSAResponse(c));
    }
  } catch { /* fall through */ }

  // Nothing worked
  return NextResponse.json(
    {
      error: !apiKey
        ? 'PSA_API_KEY not configured — add it in Vercel environment variables for reliable lookups'
        : 'Cert not found — check the number and try again',
    },
    { status: 404 }
  );
}

function mapPSAResponse(c: Record<string, string>) {
  const nameParts = [
    c.Year,
    c.Brand,
    c.Series,
    c.Subject,
    c.CardNumber ? `#${c.CardNumber}` : null,
  ].filter(Boolean);

  return {
    name: nameParts.join(' ') || `PSA Cert #${c.CertNumber}`,
    grade_co: 'PSA',
    grade: c.Grade ?? '',
    cert: c.CertNumber ?? '',
    year: c.Year ?? '',
    subject: c.Subject ?? '',
    set: [c.Brand, c.Series].filter(Boolean).join(' '),
  };
}
