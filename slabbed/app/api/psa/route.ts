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

  const apiKey = process.env.PSA_API_KEY;

  try {
    // PSA public API — requires a PSA API key
    if (apiKey) {
      const res = await fetch(
        `https://api.psacard.com/publicapi/cert/GetByCertNumber/${cleanCert}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        }
      );

      if (res.ok) {
        const json = await res.json();
        const c = json?.PSACert;
        if (c) {
          return NextResponse.json(mapPSAResponse(c));
        }
      }
    }

    // Fallback: PSA public cert page scrape (no API key required)
    const pageRes = await fetch(
      `https://www.psacard.com/cert/${cleanCert}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Slabbed/1.0)',
          Accept: 'text/html',
        },
      }
    );

    if (!pageRes.ok) {
      return NextResponse.json({ error: 'Cert not found' }, { status: 404 });
    }

    const html = await pageRes.text();
    const parsed = parsePSAHtml(html, cleanCert);

    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse cert data' }, { status: 404 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('PSA lookup error:', err);
    return NextResponse.json({ error: 'Failed to reach PSA' }, { status: 502 });
  }
}

function mapPSAResponse(c: Record<string, string>) {
  const parts = [c.Year, c.Brand, c.Series, c.Subject, c.CardNumber ? `#${c.CardNumber}` : null].filter(Boolean);
  return {
    name: parts.join(' '),
    grade_co: 'PSA',
    grade: c.Grade ?? '',
    cert: c.CertNumber ?? '',
    year: c.Year ?? '',
    subject: c.Subject ?? '',
    set: `${c.Brand ?? ''} ${c.Series ?? ''}`.trim(),
  };
}

function parsePSAHtml(html: string, cert: string) {
  // Extract key fields from PSA cert page HTML
  const getMatch = (pattern: RegExp) => html.match(pattern)?.[1]?.trim() ?? '';

  const subject =
    getMatch(/class="subjectLine[^"]*">([^<]+)</) ||
    getMatch(/<h1[^>]*>([^<]+)<\/h1>/);

  const grade =
    getMatch(/PSA\s+(\d+(?:\.\d+)?)\s*</) ||
    getMatch(/Grade[^>]*>\s*PSA\s+(\S+)/i) ||
    getMatch(/grade.*?(\d+(?:\.\d+)?)/i);

  const year = getMatch(/(\d{4})/);

  if (!subject && !grade) return null;

  return {
    name: subject || `PSA Cert #${cert}`,
    grade_co: 'PSA',
    grade: grade || '',
    cert,
    year,
    subject,
    set: '',
  };
}
