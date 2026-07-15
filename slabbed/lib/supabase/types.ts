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
  cost: number;
  date_bought: string | null;
  source: string | null;
  true_value: number | null;
  platform: string | null;
  list_price: number | null;
  tracking: string | null;
  grading_co: string | null;
  grading_fee: number | null;
  submitted_date: string | null;
  expected_grade: string | null;
  sale_price: number | null;
  fees: number | null;
  shipping_out: number | null;
  date_sold: string | null;
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
