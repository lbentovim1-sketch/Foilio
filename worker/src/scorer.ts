import type { EbayListing, CompListing } from './ebay';

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
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function scoreDeal(
  listing: EbayListing,
  comps: CompListing[],
  anthropicKey: string
): Promise<DealScore> {
  const listingPrice = parseFloat(listing.price?.value || '0');
  const compPrices = comps.map(c => c.price).filter(p => p > 0);
  const compLow = compPrices.length > 0 ? Math.min(...compPrices) : 0;
  const compHigh = compPrices.length > 0 ? Math.max(...compPrices) : 0;
  const compMedian = median(compPrices);
  const discountPercent = compMedian > 0 ? ((compMedian - listingPrice) / compMedian) * 100 : 0;

  const prompt = `You are a sports card deal analyst. Score this eBay listing as a buying opportunity.

LISTING:
Title: ${listing.title}
Current Price: $${listingPrice}
Buying Options: ${listing.buyingOptions?.join(', ')}
${listing.itemEndDate ? `Ends: ${listing.itemEndDate}` : ''}
Condition: ${listing.condition || 'Not specified'}
Seller Feedback: ${listing.seller?.feedbackPercentage}% (${listing.seller?.feedbackScore} score)

RECENT SOLD COMPS (last 30 days):
${comps.length > 0
  ? comps.slice(0, 10).map(c => `- $${c.price.toFixed(2)}: ${c.title.slice(0, 60)}`).join('\n')
  : 'No recent comps found.'}

Comp statistics:
- Median sold price: ${compMedian > 0 ? `$${compMedian.toFixed(2)}` : 'N/A'}
- Price range: ${compLow > 0 ? `$${compLow.toFixed(2)} - $${compHigh.toFixed(2)}` : 'N/A'}
- Comp count: ${comps.length}

Respond ONLY with a JSON object, no markdown:
{
  "score": <0-100 integer>,
  "grade": "<S|A|B|C|D>",
  "confidence": "<high|medium|low>",
  "summary": "<1-2 sentence rationale for a collector>"
}

Scoring: 90-100=S (>40% below comp), 75-89=A (20-40% below), 60-74=B (10-20% below), 40-59=C (near comp), 0-39=D (overpriced or no data)`;

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
        max_tokens: 300,
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
    };
  } catch {
    let score = 50;
    if (compMedian > 0) {
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
      aiSummary: `Price $${listingPrice} vs median comp $${compMedian.toFixed(2)}.`,
      confidence: 'low',
    };
  }
}
