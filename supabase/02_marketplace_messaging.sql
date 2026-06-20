-- ============================================================
--  FOILIO — marketplace, offers, and direct messaging
--  Run AFTER schema.sql. Safe to run more than once.
--  Paste into: Supabase dashboard -> SQL Editor -> New query -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
--  MARKETPLACE FLAGS on holdings
--  Cards can be listed for sale and/or trade with an asking price.
-- ============================================================
alter table public.holdings add column if not exists for_sale      boolean not null default false;
alter table public.holdings add column if not exists for_trade     boolean not null default false;
alter table public.holdings add column if not exists ask_price     numeric;
alter table public.holdings add column if not exists accept_offers boolean not null default true;
alter table public.holdings add column if not exists sale_note     text;
alter table public.holdings add column if not exists sold          boolean not null default false;

-- Existing RLS already lets anyone read public holdings and owners manage their
-- own, which covers the new columns. No new holdings policies needed.

-- ============================================================
--  OFFERS  (buy-now requests, price offers, trade proposals)
-- ============================================================
create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  buyer_id   uuid not null references auth.users(id) on delete cascade,
  seller_id  uuid not null references auth.users(id) on delete cascade,
  amount     numeric,
  kind       text not null default 'offer' check (kind in ('offer','buy_now','trade')),
  status     text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  note       text,
  created_at timestamptz not null default now(),
  constraint no_self_offer check (buyer_id <> seller_id)
);

alter table public.offers enable row level security;

drop policy if exists "read own offers" on public.offers;
create policy "read own offers"
  on public.offers for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "create offers as buyer" on public.offers;
create policy "create offers as buyer"
  on public.offers for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "update own offers" on public.offers;
create policy "update own offers"
  on public.offers for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ============================================================
--  MESSAGES  (direct messages between two collectors)
--  A message may reference a card (holding_id) and/or an offer (offer_id).
-- ============================================================
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body         text,
  holding_id   uuid references public.holdings(id) on delete set null,
  offer_id     uuid references public.offers(id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint no_self_message check (sender_id <> recipient_id)
);

create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "read own messages" on public.messages;
create policy "read own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "send messages as self" on public.messages;
create policy "send messages as self"
  on public.messages for insert
  with check (auth.uid() = sender_id);

drop policy if exists "mark messages read" on public.messages;
create policy "mark messages read"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ============================================================
--  REALTIME  (push new messages to the recipient instantly)
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
            when undefined_object then null;
  end;
end $$;
