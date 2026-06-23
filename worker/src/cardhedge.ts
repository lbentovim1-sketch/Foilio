export interface CardHedgeResult {
  compPrice: number | null;
  fmvPrice: number | null;
  fmvLow: number | null;
  fmvHigh: number | null;
  fmvConfidence: number | null;
  fmvConfidenceGrade: string | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  compCount: number;
  sales: { price: number; date: string }[];
}

function extractGrade(title: string): string {
  const m = title.match(/\b(PSA|BGS|SGC|CGC)\s*(\d+\.?\d*)\b/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return 'Raw';
}

function sportToCategory(sport?: string): string | undefined {
  const map: Record<string, string> = {
    basketball: 'Basketball', baseball: 'Baseball',
    football: 'Football', tennis: 'Tennis',
    soccer: 'Soccer', tcg: 'Pokemon',
  };
  return sport ? map[sport] : undefined;
}

async function chPost(endpoint: string, body: unknown, apiKey: string): Promise<any> {
  const resp = await fetch(`https://api.cardhedger.com${endpoint}`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return null;
  return resp.json();
}

export async function getCardHedgeComps(
  listingTitle: string,
  sport: string | undefined,
  apiKey: string
): Promise<CardHedgeResult | null> {
  const grade = extractGrade(listingTitle);
  const category = sportToCategory(sport);

  // Step 1: AI card matching from listing title
  const matchData = await chPost('/v1/cards/card-match', {
    query: listingTitle,
    ...(category ? { category } : {}),
    max_candidates: 5,
  }, apiKey);

  const cardId: string | null = matchData?.match?.card_id ?? null;
  if (!cardId) return null;

  // Step 2: Fetch comps + FMV in parallel for the matched card
  const [compsData, fmvData] = await Promise.all([
    chPost('/v1/cards/comps', {
      card_id: cardId,
      count: 20,
      grade,
      time_weighted: true,
      include_raw_prices: true,
    }, apiKey),
    chPost('/v1/cards/card-fmv', {
      card_id: cardId,
      grade,
    }, apiKey),
  ]);

  // Extract individual sale records from raw_prices
  const rawPrices: { price: number; date: string }[] = [];
  if (Array.isArray(compsData?.raw_prices)) {
    for (const rp of compsData.raw_prices) {
      if (rp.price > 0 && rp.date) rawPrices.push({ price: rp.price, date: rp.date });
    }
  }
  rawPrices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastSale = rawPrices[0] ?? null;

  return {
    compPrice: compsData?.comp_price ?? null,
    fmvPrice: fmvData?.price ?? null,
    fmvLow: fmvData?.price_low ?? null,
    fmvHigh: fmvData?.price_high ?? null,
    fmvConfidence: fmvData?.confidence ?? null,
    fmvConfidenceGrade: fmvData?.confidence_grade ?? null,
    lastSalePrice: lastSale?.price ?? null,
    lastSaleDate: lastSale?.date ?? null,
    compCount: compsData?.count_used ?? rawPrices.length,
    sales: rawPrices,
  };
}
