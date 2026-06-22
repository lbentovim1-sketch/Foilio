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

function buildSearchQuery(player: string, cardTypes: string[]): string {
  const typeTerms: string[] = [];
  if (cardTypes.includes('serialized')) typeTerms.push('/');
  if (cardTypes.includes('psa10')) typeTerms.push('PSA 10');
  if (cardTypes.includes('case_hit')) typeTerms.push('auto OR autograph OR patch');
  const base = `${player} card`;
  return typeTerms.length > 0 ? `${base} (${typeTerms.join(' ')})` : base;
}

export async function searchListings(
  token: string,
  player: string,
  cardTypes: string[],
  maxPrice?: number
): Promise<EbayListing[]> {
  const query = buildSearchQuery(player, cardTypes);
  const params = new URLSearchParams({
    q: query,
    category_ids: '261328',
    sort: 'endingSoonest',
    limit: '50',
    filter: [
      'conditionIds:{1000|1500|2000|2500|3000}',
      maxPrice ? `price:[..${maxPrice}],priceCurrency:USD` : '',
      'buyingOptions:{AUCTION|FIXED_PRICE}',
    ].filter(Boolean).join(','),
  });
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
  return data.itemSummaries || [];
}

export async function getSoldComps(
  clientId: string,
  player: string,
  cardTypes: string[]
): Promise<CompListing[]> {
  const query = buildSearchQuery(player, cardTypes);
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
