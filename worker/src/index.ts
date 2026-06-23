import { getEbayToken, searchListings, getSoldComps, type EbayListing } from './ebay';
import { scoreDeal } from './scorer';
import { getCardSightComps } from './cardsight';
import type { CompListing } from './ebay';

export interface Env {
  EBAY_CLIENT_ID: string;
  EBAY_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CARDSIGHT_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function supabaseRequest(env: Env, path: string, method: string, body?: unknown) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Supabase error: ${await response.text()}`);
  return response.json();
}

async function handleScan(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    watchlistItemId?: string;
    playerName: string;
    sport?: string;
    cardTypes?: string[];
    years?: string[];
    sets?: string[];
    grades?: string[];
    maxPriceUsd?: number;
    minPriceUsd?: number;
    limit?: number;
  };
  if (!body.playerName) return json({ error: 'playerName is required' }, 400);

  try {
    const token = await getEbayToken(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
    const listings = await searchListings(
      token, body.playerName, body.cardTypes || ['serialized'],
      body.maxPriceUsd, body.minPriceUsd,
      body.years, body.sets, body.grades
    );
    const limit = Math.min(body.limit || 5, 10);

    // Score all listings in parallel instead of sequentially
    const results = await Promise.all(
      listings.slice(0, limit).map(async (listing) => {
        // Prefer CardSight comps (real cross-platform sales) over eBay Finding API
        let listingComps: CompListing[] = [];
        if (env.CARDSIGHT_API_KEY) {
          const csSales = await getCardSightComps(body.playerName, listing.title, env.CARDSIGHT_API_KEY);
          listingComps = csSales.map(s => ({ title: s.title, price: s.price, soldDate: s.date }));
        }
        // Fall back to eBay Finding API if CardSight returned nothing
        if (listingComps.length === 0) {
          listingComps = await getSoldComps(
            env.EBAY_CLIENT_ID, body.playerName, body.cardTypes || ['serialized'],
            body.years, body.sets, body.grades, listing.title
          );
        }
        const score = await scoreDeal(listing, listingComps, env.ANTHROPIC_API_KEY);
        if (body.watchlistItemId && env.SUPABASE_URL) {
          try {
            const [savedListing] = await supabaseRequest(env, '/listings', 'POST', {
              ebay_item_id: listing.itemId,
              title: listing.title,
              current_price: parseFloat(listing.price?.value || '0'),
              auction_end_time: listing.itemEndDate || null,
              condition: listing.condition,
              image_url: listing.image?.imageUrl,
              ebay_url: listing.itemWebUrl,
              seller_username: listing.seller?.username,
              seller_feedback_score: listing.seller?.feedbackScore,
              seller_feedback_percent: parseFloat(listing.seller?.feedbackPercentage || '0'),
              watchlist_item_id: body.watchlistItemId,
            }) as any[];
            if (savedListing?.id) {
              await supabaseRequest(env, '/deal_scores', 'POST', {
                listing_id: savedListing.id,
                score: score.score, grade: score.grade,
                comp_low: score.compLow, comp_median: score.compMedian, comp_high: score.compHigh,
                comp_count: score.compCount, discount_percent: score.discountPercent,
                ai_summary: score.aiSummary, confidence: score.confidence,
              });
            }
          } catch (dbErr) { console.error('DB persist error:', dbErr); }
        }
        return {
          listing: {
            itemId: listing.itemId, title: listing.title, price: listing.price,
            buyingOptions: listing.buyingOptions, itemEndDate: listing.itemEndDate,
            condition: listing.condition, imageUrl: listing.image?.imageUrl,
            itemWebUrl: listing.itemWebUrl, seller: listing.seller,
          },
          score,
        };
      })
    );

    results.sort((a, b) => b.score.score - a.score.score);
    return json({ success: true, player: body.playerName, scannedAt: new Date().toISOString(), totalFound: listings.length, results });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

// Handles eBay's marketplace account deletion challenge verification
async function handleEbayNotification(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const challengeCode = url.searchParams.get('challenge_code');
  if (challengeCode) {
    const verificationToken = (env as any).EBAY_VERIFICATION_TOKEN || 'snipecard-ebay-marketplace-deletion-verification-token-2026';
    const endpoint = `${url.origin}/api/ebay-notifications`;
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(challengeCode + verificationToken + endpoint)
    );
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return new Response(JSON.stringify({ challengeResponse: hashHex }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    const url = new URL(request.url);
    if (url.pathname === '/api/scan' && request.method === 'POST') return handleScan(request, env);
    if (url.pathname === '/api/health') return json({ status: 'ok', version: '1.0.0' });
    if (url.pathname === '/api/ebay-notifications') return handleEbayNotification(request, env);
    return json({ error: 'Not found' }, 404);
  },
};
