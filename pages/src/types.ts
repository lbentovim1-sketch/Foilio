export interface WatchlistItem {
  id: string
  profile_id: string
  player_name: string
  sport: string | null
  card_types: string[]
  years: string[]
  sets: string[]
  grades: string[]
  min_serial_print_run: number | null
  max_price_usd: number | null
  min_price_usd: number | null
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

export const CARD_YEARS = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018']

export const CARD_SETS = [
  'Prizm', 'Optic', 'Select', 'Mosaic', 'Hoops',
  'Topps Chrome', 'Bowman Chrome', 'Stadium Club',
  'National Treasures', 'Immaculate', 'Flawless',
  'SP Authentic', 'Upper Deck', 'Finest',
  'Donruss', 'Contenders', 'Chronicles',
]

export const CARD_GRADES = [
  { value: 'PSA 10', label: 'PSA 10 (Gem Mint)' },
  { value: 'PSA 9', label: 'PSA 9 (Mint)' },
  { value: 'PSA 8', label: 'PSA 8 (NM-MT)' },
  { value: 'BGS 9.5', label: 'BGS 9.5 (Gem Mint)' },
  { value: 'BGS 9', label: 'BGS 9 (Mint)' },
  { value: 'SGC 10', label: 'SGC 10 (Pristine)' },
  { value: 'CGC 10', label: 'CGC 10 (Pristine)' },
]

export const DEFAULT_WATCHLIST: Omit<WatchlistItem, 'id' | 'profile_id' | 'created_at'>[] = [
  {
    player_name: 'Jalen Brunson', sport: 'basketball',
    card_types: ['serialized', 'case_hit'], years: ['2024', '2023'],
    sets: ['Prizm', 'Optic'], grades: [], min_serial_print_run: null,
    max_price_usd: null, min_price_usd: 20, keywords: [], active: true,
  },
  {
    player_name: 'Carlos Alcaraz', sport: 'tennis',
    card_types: ['serialized', 'case_hit'], years: [],
    sets: [], grades: [], min_serial_print_run: null,
    max_price_usd: null, min_price_usd: 15, keywords: [], active: true,
  },
  {
    player_name: 'Juan Soto', sport: 'baseball',
    card_types: ['serialized', 'case_hit'], years: ['2024', '2023'],
    sets: ['Topps Chrome', 'Prizm'], grades: [], min_serial_print_run: null,
    max_price_usd: null, min_price_usd: 20, keywords: [], active: true,
  },
  {
    player_name: 'Lorcana', sport: 'tcg',
    card_types: ['psa10'], years: [],
    sets: [], grades: ['PSA 10'], min_serial_print_run: null,
    max_price_usd: null, min_price_usd: 10, keywords: [], active: true,
  },
  {
    player_name: 'Disney Topps Chrome', sport: 'tcg',
    card_types: ['serialized', 'case_hit'], years: [],
    sets: [], grades: [], min_serial_print_run: null,
    max_price_usd: null, min_price_usd: 10, keywords: [], active: true,
  },
]
