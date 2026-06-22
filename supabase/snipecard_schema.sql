-- SnipeCard Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table watchlist_items (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  player_name text not null,
  sport text,
  card_types text[] default '{}',
  min_serial_print_run int,
  max_price_usd numeric(10,2),
  keywords text[],
  active boolean default true,
  created_at timestamptz default now()
);

create table listings (
  id uuid primary key default uuid_generate_v4(),
  ebay_item_id text unique not null,
  title text not null,
  current_price numeric(10,2),
  buy_it_now_price numeric(10,2),
  auction_end_time timestamptz,
  condition text,
  image_url text,
  ebay_url text,
  seller_username text,
  seller_feedback_score int,
  seller_feedback_percent numeric(5,2),
  watchlist_item_id uuid references watchlist_items(id),
  scanned_at timestamptz default now(),
  is_active boolean default true
);

create table deal_scores (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  score numeric(4,1),
  grade text,
  comp_low numeric(10,2),
  comp_median numeric(10,2),
  comp_high numeric(10,2),
  comp_count int,
  discount_percent numeric(5,1),
  ai_summary text,
  confidence text,
  scored_at timestamptz default now()
);

create table digests (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id),
  digest_date date default current_date,
  total_listings_scanned int,
  deals_found int,
  top_score numeric(4,1),
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table watchlist_items enable row level security;
alter table listings enable row level security;
alter table deal_scores enable row level security;
alter table digests enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = user_id);

create policy "Users manage own watchlist" on watchlist_items
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users view own listings" on listings
  for select using (
    watchlist_item_id in (
      select wi.id from watchlist_items wi
      join profiles p on p.id = wi.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "Service role inserts listings" on listings
  for insert with check (true);

create policy "Users view own scores" on deal_scores
  for select using (
    listing_id in (
      select l.id from listings l
      join watchlist_items wi on wi.id = l.watchlist_item_id
      join profiles p on p.id = wi.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "Service role inserts scores" on deal_scores
  for insert with check (true);

create policy "Users view own digests" on digests
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create or replace view ranked_deals as
select
  l.id as listing_id,
  l.ebay_item_id,
  l.title,
  l.current_price,
  l.buy_it_now_price,
  l.auction_end_time,
  l.image_url,
  l.ebay_url,
  l.seller_feedback_percent,
  ds.score,
  ds.grade,
  ds.comp_median,
  ds.discount_percent,
  ds.ai_summary,
  ds.confidence,
  wi.player_name,
  wi.sport,
  ds.scored_at
from listings l
join deal_scores ds on ds.listing_id = l.id
join watchlist_items wi on wi.id = l.watchlist_item_id
where l.is_active = true
  and ds.scored_at > now() - interval '24 hours'
order by ds.score desc;
