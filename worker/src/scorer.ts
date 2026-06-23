import type { EbayListing, CompListing } from './ebay';
import type { CardHedgeResult } from './cardhedge';

export interface DealScore {
  score: number;
  grade: string;
  compLow: number;
  compMedian: number;
  compHigh: number;
  compCount: number;
  discountPercent: number;
  aiSummary: string;
  confidence: string;
  // Enhanced comp snapshot
  lastCompPrice: number | null;
  lastCompDate: string | null;
  estimatedValue: number | null;
  trend7dPercent: number | null;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcTrend(comps: CompListing[]): number | null {
  const now = Date.now();
  const d7 = now - 7 * 864e5;
  const d30 = now - 30 * 864e5;
  const recent = comps.filter(c => new Date(c.soldDate).getTime() > d7);
  const older = comps.filter(c => { const t = new Date(c.soldDate).getTime(); return t <= d7 && t > d30; });
  if (recent.length === 0 || older.length === 0) return null;
  const avg = (arr: CompListing[]) => arr.reduce((s, c) => s + c.price, 0) / arr.length;
  return Math.round(((avg(recent) - avg(older)) / avg(older)) * 1000) / 10;
}

function mostRecentComp(comps: CompListing[]): CompListing | null {
  if (comps.length === 0) return null;
  return comps.reduce((best, c) =>
    new Date(c.soldDate).getTime() > new Date(best.soldDate).getTime() ? c : best
  );
}

export async function scoreDeal(
  listing: EbayListing,
  comps: CompListing[],
  anthropicKey: string,
  cardHedge?: CardHedgeResult | null
): Promise<DealScore> {
  const listingPrice = parseFloat(listing.price?.value || '0');
  const compPrices = comps.map(c => c.price).filter(p => p > 0);
  const compLow = compPrices.length > 0 ? Math.min(...compPrices) : 0;
  const compHigh = compPrices.length > 0 ? Math.max(...compPrices) : 0;
  const compMedian = median(compPrices);

  // Prefer Card Hedge FMV as the benchmark — it's grade-specific and professionally calculated
  const fairValue = cardHedge?.fmvPrice ?? cardHedge?.compPrice ?? (compMedian > 0 ? compMedian : 0);
  const discountPercent = fairValue > 0 ? ((fairValue - listingPrice) / fairValue) * 100 : 0;

  // Use Card Hedge last sale if available and more recent
  const ebayLastComp = mostRecentComp(comps);
  const chLastDate = cardHedge?.lastSaleDate ?? null;
  const useChLast = chLastDate && (!ebayLastComp || new Date(chLastDate) >= new Date(ebayLastComp.soldDate));
  const lastComp = useChLast
    ? { price: cardHedge!.lastSalePrice!, soldDate: chLastDate }
    : ebayLastComp;
  const trend7dPercent = calcTrend(comps);

  // Build card hedge context line for AI if available
  const chContext = cardHedge?.fmvPrice
    ? `\nCard Hedge FMV: $${cardHedge.fmvPrice.toFixed(2)} (${cardHedge.fmvConfidenceGrade ?? '?'} confidence${cardHedge.fmvLow && cardHedge.fmvHigh ? `, range $${cardHedge.fmvLow.toFixed(0)}–$${cardHedge.fmvHigh.toFixed(0)}` : ''})`
    : '';

  // Sort comps newest-first for AI context
  const sortedComps = [...comps].sort(
    (a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime()
  );

  const compLines = sortedComps.slice(0, 15).map(c => {
    const date = c.soldDate ? new Date(c.soldDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
    return `- ${date} · $${c.price.toFixed(2)}: ${c.title.slice(0, 70)}`;
  }).join('\n');

  const trendLine = trend7dPercent !== null
    ? `7-day price trend: ${trend7dPercent > 0 ? '+' : ''}${trend7dPercent}%`
    : '7-day trend: insufficient data';

  const prompt = `You are an expert sports card and TCG deal analyst. Score this eBay listing as a buying opportunity.

LISTING:
Title: ${listing.title}
Current Price: $${listingPrice}
Type: ${listing.buyingOptions?.join(', ')}
${listing.itemEndDate ? `Ends: ${listing.itemEndDate}` : ''}
Condition: ${listing.condition || 'Not specified'}
Seller: ${listing.seller?.feedbackPercentage}% positive (${listing.seller?.feedbackScore} ratings)

SOLD COMPS (newest first — includes same card at various grades if exact match unavailable):
${compLines || 'No recent sold comps found.'}

MARKET CONTEXT:
- Comp median: ${compMedian > 0 ? `$${compMedian.toFixed(2)}` : 'N/A'}
- Comp range: ${compLow > 0 ? `$${compLow.toFixed(2)} – $${compHigh.toFixed(2)}` : 'N/A'}
- Total comps found: ${comps.length}
- ${trendLine}
${lastComp ? `- Most recent sale: $${lastComp.price.toFixed(2)} on ${new Date(lastComp.soldDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}${chContext}

INSTRUCTIONS:
- If comps are for a lower grade (PSA 9, raw), factor in typical grade multipliers: PSA 10 is ~1.5–2.5x PSA 9; PSA 9 is ~1.5–2x raw
- If the card is serialized, factor in rarity (lower print run = more premium)
- A low seller feedback count (<100) is a risk factor
- Be specific and actionable — mention the actual comp prices and dates in your summary

Respond ONLY with JSON, no markdown:
{
  "score": <0-100>,
  "grade": "<S|A|B|C|D>",
  "confidence": "<high|medium|low>",
  "summary": "<2-3 sentences: cite specific comp prices and dates, state whether this is a deal or fair price, give one actionable recommendation>"
}

Scoring: 90-100=S (>40% below fair value), 75-89=A (20-40% below), 60-74=B (10-20% below), 40-59=C (near fair value), 0-39=D (overpriced or insufficient data)`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json() as any;
    const text = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      grade: ['S', 'A', 'B', 'C', 'D'].includes(parsed.grade) ? parsed.grade : 'C',
      compLow, compMedian, compHigh, compCount: comps.length,
      discountPercent: Math.round(discountPercent * 10) / 10,
      aiSummary: parsed.summary || 'No analysis available.',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      lastCompPrice: lastComp?.price ?? null,
      lastCompDate: lastComp?.soldDate ?? null,
      estimatedValue: cardHedge?.fmvPrice ?? cardHedge?.compPrice ?? (compMedian > 0 ? Math.round(compMedian * 100) / 100 : null),
      trend7dPercent,
    };
  } catch {
    let score = 50;
    if (fairValue > 0) {
      if (discountPercent > 40) score = 90;
      else if (discountPercent > 25) score = 80;
      else if (discountPercent > 10) score = 65;
      else if (discountPercent < -10) score = 30;
      else if (discountPercent < 0) score = 40;
    }
    return {
      score,
      grade: score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
      compLow, compMedian, compHigh, compCount: comps.length,
      discountPercent: Math.round(discountPercent * 10) / 10,
      aiSummary: fairValue > 0
        ? `Listed at $${listingPrice} vs fair value $${fairValue.toFixed(2)} (${discountPercent > 0 ? discountPercent.toFixed(0) + '% below' : 'at or above'} market).`
        : 'No comp data available — unable to assess deal quality.',
      confidence: comps.length >= 5 ? 'medium' : (cardHedge?.fmvPrice ? 'medium' : 'low'),
      lastCompPrice: lastComp?.price ?? null,
      lastCompDate: lastComp?.soldDate ?? null,
      estimatedValue: cardHedge?.fmvPrice ?? cardHedge?.compPrice ?? (compMedian > 0 ? Math.round(compMedian * 100) / 100 : null),
      trend7dPercent,
    };
  }
}
