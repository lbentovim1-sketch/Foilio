export interface EbayListing {
  itemId: string;
  title: string;
  price: { value: string; currency: string };
  buyingOptions: string[];
  itemEndDate?: string;
  condition?: string;
  image?: { imageUrl: string };
  itemWebUrl: string;
  seller: { username: string; feedbackScore: number; feedbackPercentage: string };
}

export interface CompListing {
  title: string;
  price: number;
  soldDate: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getEbayToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });
  if (!response.ok) throw new Error(`eBay OAuth failed: ${await response.text()}`);
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

const KNOWN_SETS = [
  'Prizm', 'Optic', 'Select', 'Mosaic', 'Hoops', 'Topps Chrome', 'Chrome',
  'Bowman', 'Donruss', 'Flawless', 'Immaculate', 'National Treasures',
  'Contenders', 'Chronicles', 'Finest', 'Stadium Club', 'SP Authentic',
  'Panini One', 'Court Kings', 'Recon',
];

// Extract the most specific searchable terms from an eBay listing title
export function buildCompQuery(player: string, listingTitle: string): string {
  const title = listingTitle;

  // Extract year
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '';

  // Extract player last name for shorter queries
  const lastName = player.split(' ').slice(-1)[0];

  // Extract serial number (e.g. /275, /99, /10)
  const serialMatch = title.match(/\/(\d{1,4})\b/);
  const serial = serialMatch ? `/${serialMatch[1]}` : '';

  // Extract known set name
  const foundSet = KNOWN_SETS.find(s => title.toLowerCase().includes(s.toLowerCase()));

  // Extract subset name — words after the set name that are likely the parallel/subset
  // e.g. "Color Blast", "White Lazer", "Kaboom", "Holo", "Silver"
  const subsetKeywords = ['Color Blast', 'White Lazer', 'Gold Lazer', 'Kaboom', 'Silver',
    'Gold', 'Black', 'Holo', 'Neon', 'Mojo', 'Disco', 'Cracked Ice', 'Fast Break'];
  const foundSubset = subsetKeywords.find(s => title.toLowerCase().includes(s.toLowerCase()));

  const parts: string[] = [lastName];
  if (year) parts.push(year);
  if (foundSet) parts.push(foundSet);
  if (foundSubset && foundSubset !== foundSet) parts.push(foundSubset);
  // Omit serial number — too restrictive for comp searches, rarely matches sold titles exactly

  return parts.join(' ');
}

function buildSearchQuery(
  player: string,
  cardTypes: string[],
  years?: string[],
  sets?: string[],
  grades?: string[]
): string {
  const terms: string[] = [player];

  if (years && years.length > 0) terms.push(years[0]);
  if (sets && sets.length > 0) terms.push(sets[0]);

  if (grades && grades.length > 0) {
    terms.push(grades[0]);
    return terms.join(' ');
  }
  if (cardTypes.includes('psa10')) {
    terms.push('PSA 10');
    return terms.join(' ');
  }
  if (cardTypes.includes('serialized')) terms.push('/');
  else if (cardTypes.includes('case_hit')) terms.push('auto');

  terms.push('card');
  return terms.join(' ');
}

export async function searchListings(
  token: string,
  player: string,
  cardTypes: string[],
  maxPrice?: number,
  minPrice?: number,
  years?: string[],
  sets?: string[],
  grades?: string[]
): Promise<EbayListing[]> {
  const query = buildSearchQuery(player, cardTypes, years, sets, grades);
  const priceFilter = maxPrice ? `price:[..${maxPrice}],priceCurrency:USD` : '';
  const hasGrade = grades && grades.length > 0;
  const params = new URLSearchParams({
    q: query,
    sort: 'endingSoonest',
    limit: '50',
  });
  if (!hasGrade) params.set('category_ids', '261328');
  params.set('filter', [
    'conditionIds:{1000|1500|2000|2500|2750|3000|4000|5000|6000}',
    priceFilter,
    'buyingOptions:{AUCTION|FIXED_PRICE}',
  ].filter(Boolean).join(','));
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) throw new Error(`eBay Browse API error: ${await response.text()}`);
  const data = await response.json() as { itemSummaries?: EbayListing[] };
  const items = data.itemSummaries || [];
  if (minPrice) {
    return items.filter(item => parseFloat(item.price?.value || '0') >= minPrice);
  }
  return items;
}

async function fetchComps(clientId: string, query: string, entriesPerPage = 20): Promise<CompListing[]> {
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': clientId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': query,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'Currency',
    'itemFilter(1).value': 'USD',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': String(entriesPerPage),
  });
  const response = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`);
  if (!response.ok) return [];
  const data = await response.json() as any;
  try {
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    return items.map((item: any) => ({
      title: item.title?.[0] || '',
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
      soldDate: item.listingInfo?.[0]?.endTime?.[0] || '',
    })).filter((c: CompListing) => c.price > 0);
  } catch {
    return [];
  }
}

// Fetch comps tight to the specific listing, then fall back to broader player-level comps
export async function getSoldComps(
  clientId: string,
  player: string,
  cardTypes: string[],
  years?: string[],
  sets?: string[],
  grades?: string[],
  listingTitle?: string
): Promise<CompListing[]> {
  const queries: string[] = [];

  // Tight query: specific card terms extracted from the listing title
  if (listingTitle) {
    queries.push(buildCompQuery(player, listingTitle));
  }

  // Medium query: player + first grade or card-type term
  const broadQuery = buildSearchQuery(player, cardTypes, years, sets, grades);
  queries.push(broadQuery);

  // Run queries in parallel, tightest first
  const results = await Promise.all(queries.map(q => fetchComps(clientId, q, 20)));

  // Merge: use tight comps if we got at least 3, otherwise fall back to broad
  const tightComps = results[0] ?? [];
  const broadComps = results[1] ?? [];

  if (tightComps.length >= 3) return tightComps;

  // Deduplicate by title+price and combine
  const seen = new Set(tightComps.map(c => `${c.title}|${c.price}`));
  const merged = [...tightComps];
  for (const c of broadComps) {
    const key = `${c.title}|${c.price}`;
    if (!seen.has(key)) { seen.add(key); merged.push(c); }
  }
  return merged;
}
