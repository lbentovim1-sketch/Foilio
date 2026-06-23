export interface CardSightSale {
  title: string;
  price: number;
  date: string;
  source: string;
  grade: string;
}

const KNOWN_SETS = [
  'Prizm', 'Optic', 'Select', 'Mosaic', 'Hoops', 'Chrome', 'Topps Chrome',
  'Bowman', 'Donruss', 'Flawless', 'Immaculate', 'National Treasures',
  'Contenders', 'Chronicles', 'Finest', 'Stadium Club',
];

const KNOWN_SUBSETS = [
  'Color Blast', 'White Lazer', 'Gold Lazer', 'Kaleidoscopic', 'Kaboom',
  'Cracked Ice', 'Fast Break', 'Disco', 'Mojo', 'Holo',
];

function buildSearchTerms(playerName: string, listingTitle: string): string[] {
  const year = listingTitle.match(/\b(20\d{2})\b/)?.[1] ?? '';
  const lower = listingTitle.toLowerCase();
  const foundSet = KNOWN_SETS.find(s => lower.includes(s.toLowerCase()));
  const foundSubset = KNOWN_SUBSETS.find(s => lower.includes(s.toLowerCase()));

  return [
    // Tightest: player + year + set + subset
    [playerName, year, foundSet, foundSubset].filter(Boolean).join(' '),
    // Medium: player + set + subset
    [playerName, foundSet, foundSubset].filter(Boolean).join(' '),
    // Broader: player + set
    [playerName, foundSet].filter(Boolean).join(' '),
    // Broadest: just player
    playerName,
  ].filter((q, i, arr) => q && arr.indexOf(q) === i); // dedupe
}

async function searchCatalog(query: string, apiKey: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://api.cardsight.ai/v1/catalog/search?q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'X-API-Key': apiKey } }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { results?: { id: string; name: string }[] };
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchPricing(cardId: string, apiKey: string): Promise<CardSightSale[]> {
  try {
    const resp = await fetch(
      `https://api.cardsight.ai/v1/pricing/${cardId}?period=90d`,
      { headers: { 'X-API-Key': apiKey } }
    );
    if (!resp.ok) return [];
    const data = await resp.json() as any;
    const sales: CardSightSale[] = [];

    // Raw (ungraded) sales
    for (const r of (data.raw?.records ?? [])) {
      if (r.price > 0) sales.push({ title: r.title, price: r.price, date: r.date, source: r.source, grade: 'raw' });
    }

    // Graded sales — API returns array of grade groups
    for (const group of (data.graded ?? [])) {
      const gradeName: string = group.grade ?? group.name ?? '';
      for (const r of (group.records ?? [])) {
        if (r.price > 0) sales.push({ title: r.title, price: r.price, date: r.date, source: r.source, grade: gradeName });
      }
    }

    return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function getCardSightComps(
  playerName: string,
  listingTitle: string,
  apiKey: string
): Promise<CardSightSale[]> {
  const queries = buildSearchTerms(playerName, listingTitle);

  // Try queries from tightest to broadest; stop as soon as we find a card
  for (const query of queries) {
    const cardId = await searchCatalog(query, apiKey);
    if (!cardId) continue;
    const sales = await fetchPricing(cardId, apiKey);
    if (sales.length > 0) return sales;
  }
  return [];
}
