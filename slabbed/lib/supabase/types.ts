export type CardStatus = 'incoming' | 'grading' | 'inventory' | 'listed' | 'sold' | 'pc';
export type SubStatus = 'free' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubStatus;
  trial_ends_at: string | null;
  default_fee_pct: number;
  default_shipping: number;
  share_slug: string | null;
  inventory_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
  category: string;
  grade_co: string | null;
  grade: string | null;
  serial: string | null;
  status: CardStatus;

  // Acquisition
  cost: number;
  date_bought: string | null;
  source: string | null;

  // Valuation
  true_value: number | null;

  // Listing
  platform: string | null;
  list_price: number | null;

  // Incoming
  tracking: string | null;

  // Grading
  grading_co: string | null;
  grading_fee: number | null;
  submitted_date: string | null;
  expected_grade: string | null;

  // Sale
  sale_price: number | null;
  fees: number | null;
  shipping_out: number | null;
  date_sold: string | null;

  // PSA / cert fields
  cert_number: string | null;
  cert_verified_at: string | null;
  cert_lookup_source: string | null;
  cert_source_data: Record<string, unknown> | null;
  psa_spec_id: string | null;
  population: number | null;
  population_higher: number | null;
  front_image_url: string | null;
  back_image_url: string | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  name: string;
  recent_comp: number | null;
  max_bid: number | null;
  priority: string;
  auction_end: string | null;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  date: string;
  vendor: string | null;
  category: string;
  description: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  held_count: number;
  inventory_cost: number;
  inventory_value: number;
  sold_count: number;
  sold_revenue: number;
  realized_pl: number;
}

export interface PublicCard {
  name: string;
  category: string;
  grade_co: string | null;
  grade: string | null;
  serial: string | null;
  list_price: number | null;
  true_value: number | null;
  status: CardStatus;
}

export interface PSALookupResult {
  fromCache?: boolean;
  cachedAt?: string;
  gradingCompany: string;
  certNumber: string;
  psaSpecId: string | null;
  title: string;
  year: string;
  brand: string;
  category: string;
  cardNumber: string;
  subject: string;
  variety: string;
  grade: string;
  gradeDescription: string;
  autographGrade: string;
  population: number | null;
  populationHigher: number | null;
  itemStatus: string;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  images: string[];
  rawPsaCard: Record<string, unknown>;
  imagesRaw: unknown;
}
