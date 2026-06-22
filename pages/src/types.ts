export interface WatchlistItem {
  id: string
  profile_id: string
  player_name: string
  sport: string | null
  card_types: string[]
  min_serial_print_run: number | null
  max_price_usd: number | null
  keywords: string[]
  active: boolean
  created_at: string
}

export interface ScanResult {
  listing: {
    itemId: string
    title: string
    price: { value: string; currency: string }
    buyingOptions: string[]
    itemEndDate?: string
    condition?: string
    imageUrl?: string
    itemWebUrl: string
    seller: { username: string; feedbackScore: number; feedbackPercentage: string }
  }
  score: {
    score: number
    grade: string
    compLow: number
    compMedian: number
    compHigh: number
    compCount: number
    discountPercent: number
    aiSummary: string
    confidence: string
  }
}

export const SPORTS = [
  { value: 'basketball', label: 'Basketball' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'football', label: 'Football' },
  { value: 'tcg', label: 'TCG (Lorcana, Pokémon, etc.)' },
  { value: 'other', label: 'Other' },
]

export const CARD_TYPES = [
  { value: 'serialized', label: 'Serialized (/25, /10, /1, etc.)' },
  { value: 'case_hit', label: 'Case Hit (Auto/Patch/RPA)' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'raw', label: 'Raw (Ungraded)' },
]

export const DEFAULT_WATCHLIST: Omit<WatchlistItem, 'id' | 'profile_id' | 'created_at'>[] = [
  { player_name: 'Jalen Brunson', sport: 'basketball', card_types: ['serialized', 'case_hit'], min_serial_print_run: null, max_price_usd: null, keywords: [], active: true },
  { player_name: 'Carlos Alcaraz', sport: 'tennis', card_types: ['serialized', 'case_hit'], min_serial_print_run: null, max_price_usd: null, keywords: [], active: true },
  { player_name: 'Juan Soto', sport: 'baseball', card_types: ['serialized', 'case_hit'], min_serial_print_run: null, max_price_usd: null, keywords: [], active: true },
  { player_name: 'Lorcana', sport: 'tcg', card_types: ['psa10'], min_serial_print_run: null, max_price_usd: null, keywords: ['PSA 10'], active: true },
  { player_name: 'Disney Topps Chrome', sport: 'tcg', card_types: ['serialized', 'case_hit'], min_serial_print_run: null, max_price_usd: null, keywords: [], active: true },
]
