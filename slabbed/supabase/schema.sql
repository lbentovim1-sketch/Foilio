-- ============================================================
-- SLABBED — Card Flipper Business Tracker
-- Supabase schema v1 + share feature
-- Run in SQL Editor as a single migration
-- ============================================================

-- ---------- ENUMS ----------
create type card_status as enum ('incoming', 'grading', 'inventory', 'listed', 'sold', 'pc');
create type sub_status  as enum ('free', 'trialing', 'active', 'past_due', 'canceled');

-- ---------- PROFILES ----------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  display_name       text,
  -- Stripe / subscription
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  subscription_status    sub_status not null default 'free',
  trial_ends_at          timestamptz,
  -- Preferences
  default_fee_pct    numeric(5,2) not null default 13.25,
  default_shipping   numeric(8,2) not null default 5.00,
  -- Public inventory sharing
  share_slug         text unique,
  inventory_public   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- CARDS ----------
create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  category      text not null default 'Other',
  grade_co      text,
  grade         text,
  serial        text,
  status        card_status not null default 'inventory',

  -- Acquisition
  cost          numeric(12,2) not null default 0,
  date_bought   date,
  source        text,

  -- Valuation
  true_value    numeric(12,2),

  -- Listing
  platform      text,
  list_price    numeric(12,2),

  -- Incoming
  tracking      text,

  -- Grading
  grading_co        text,
  grading_fee       numeric(10,2),
  submitted_date    date,
  expected_grade    text,

  -- Sale
  sale_price    numeric(12,2),
  fees          numeric(10,2),
  shipping_out  numeric(10,2),
  date_sold     date,

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "cards: crud own"
  on public.cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cards_user_status_idx on public.cards (user_id, status);
create index cards_user_sold_idx   on public.cards (user_id, date_sold desc) where status = 'sold';

-- ---------- WATCHLIST ----------
create table public.watchlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  recent_comp  numeric(12,2),
  max_bid      numeric(12,2),
  priority     text not null default 'Medium',
  auction_end  timestamptz,
  link         text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.watchlist enable row level security;

create policy "watchlist: crud own"
  on public.watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index watchlist_user_idx on public.watchlist (user_id, auction_end);

-- ---------- EXPENSES ----------
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  date         date not null default current_date,
  vendor       text,
  category     text not null default 'Other',
  description  text,
  amount       numeric(12,2) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "expenses: crud own"
  on public.expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index expenses_user_date_idx on public.expenses (user_id, date desc);

-- ---------- TRIGGERS ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch  before update on public.profiles  for each row execute function public.touch_updated_at();
create trigger cards_touch     before update on public.cards     for each row execute function public.touch_updated_at();
create trigger watchlist_touch before update on public.watchlist for each row execute function public.touch_updated_at();
create trigger expenses_touch  before update on public.expenses  for each row execute function public.touch_updated_at();

-- Auto-create profile on signup (14-day trial)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, subscription_status, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'trialing',
    now() + interval '14 days'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- DASHBOARD STATS ----------
create or replace function public.get_dashboard_stats()
returns json
language sql
security invoker
as $$
  select json_build_object(
    'held_count',     count(*) filter (where status in ('incoming','grading','inventory','listed')),
    'inventory_cost', coalesce(sum(cost) filter (where status in ('incoming','grading','inventory','listed')), 0),
    'inventory_value',coalesce(sum(true_value) filter (where status in ('incoming','grading','inventory','listed')), 0),
    'sold_count',     count(*) filter (where status = 'sold'),
    'sold_revenue',   coalesce(sum(sale_price) filter (where status = 'sold'), 0),
    'realized_pl',    coalesce(sum(sale_price - coalesce(fees,0) - coalesce(shipping_out,0) - cost) filter (where status = 'sold'), 0)
  )
  from public.cards
  where user_id = auth.uid();
$$;

-- ---------- PUBLIC INVENTORY (for share links) ----------
-- Returns public-safe card data for a given share slug
create or replace function public.get_public_inventory(p_slug text)
returns table (
  name text,
  category text,
  grade_co text,
  grade text,
  serial text,
  list_price numeric,
  true_value numeric,
  status card_status
)
language sql
security definer
set search_path = public
as $$
  select c.name, c.category, c.grade_co, c.grade, c.serial, c.list_price, c.true_value, c.status
  from public.cards c
  join public.profiles p on p.id = c.user_id
  where p.share_slug = p_slug
    and p.inventory_public = true
    and c.status in ('inventory', 'listed')
  order by c.category, c.name;
$$;

-- Returns public profile info for a share page
create or replace function public.get_public_profile(p_slug text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'display_name', p.display_name,
    'share_slug', p.share_slug
  )
  from public.profiles p
  where p.share_slug = p_slug and p.inventory_public = true
  limit 1;
$$;
