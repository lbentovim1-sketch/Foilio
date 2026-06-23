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

function buildSearchQuery(
  player: string,
  cardTypes: string[],
  years?: string[],
  sets?: string[],
  grades?: string[]
): string {
  const terms: string[] = [player];

  // Year — use most recent selected year
  if (years && years.length > 0) terms.push(years[0]);

  // Set/brand — use first selected set
  if (sets && sets.length > 0) terms.push(sets[0]);

  // Grade overrides card type — don't append "card" for graded queries
  // since PSA/BGS listings often omit the word "card" in their titles
  if (grades && grades.length > 0) {
    terms.push(grades[0]);
    return terms.join(' ');
  }

  // Card type hints for ungraded searches
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
  // Only send maxPrice to eBay — minPrice is applied post-fetch to avoid eBay API quirks
  const priceFilter = maxPrice ? `price:[..${maxPrice}],priceCurrency:USD` : '';
  // Use category 261328 (Sports Trading Cards) for ungraded,
  // but drop the category restriction for graded queries so PSA/BGS slabs are found
  const hasGrade = grades && grades.length > 0;
  const params = new URLSearchParams({
    q: query,
    sort: 'endingSoonest',
    limit: '50',
  });
  if (!hasGrade) params.set('category_ids', '261328');
  // 2750 = Certified (PSA/BGS graded slabs); include all common conditions
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
  // Apply min price filter post-fetch
  if (minPrice) {
    return items.filter(item => parseFloat(item.price?.value || '0') >= minPrice);
  }
  return items;
}

export async function getSoldComps(
  clientId: string,
  player: string,
  cardTypes: string[],
  years?: string[],
  sets?: string[],
  grades?: string[]
): Promise<CompListing[]> {
  const query = buildSearchQuery(player, cardTypes, years, sets, grades);
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': clientId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': query,
    'categoryId': '261328',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'Currency',
    'itemFilter(1).value': 'USD',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '20',
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
