-- ============================================================
--  FOILIO — Supabase schema for the social platform
--  Safe to run more than once (everything is "if not exists" /
--  "drop ... if exists"). Paste this whole file into:
--    Supabase dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- ----- needed for gen_random_uuid() -----
create extension if not exists "pgcrypto";

-- ============================================================
--  PROFILES  (one per user; public collector page)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text,
  bio          text,
  avatar_url   text,
  twitter      text,
  instagram    text,
  website      text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row when a new user signs up, using the
-- @handle they chose at signup (stored in auth metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired text;
begin
  desired := lower(coalesce(nullif(new.raw_user_meta_data->>'handle',''), ''));
  -- fall back to a safe unique handle if missing or already taken
  if desired = '' or desired !~ '^[a-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where handle = desired) then
    desired := 'user_' || substr(replace(new.id::text,'-',''),1,8);
  end if;
  insert into public.profiles (id, handle)
  values (new.id, desired)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  HOLDINGS  (saved cards). The table already exists; this only
--  adds the columns the social features need, then locks it down.
-- ============================================================
alter table public.holdings add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.holdings add column if not exists is_public boolean not null default true;

-- Make sure any pre-existing rows are owned (best effort: if there is
-- exactly one user, assign orphan rows to them).
update public.holdings h
set user_id = (select id from auth.users limit 1)
where h.user_id is null
  and (select count(*) from auth.users) = 1;

alter table public.holdings enable row level security;

drop policy if exists "owners manage own holdings" on public.holdings;
create policy "owners manage own holdings"
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "public holdings are readable" on public.holdings;
create policy "public holdings are readable"
  on public.holdings for select
  using (is_public = true);

-- ============================================================
--  FOLLOWS  (collector -> collector)
-- ============================================================
create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows readable by everyone" on public.follows;
create policy "follows readable by everyone"
  on public.follows for select using (true);

drop policy if exists "users create own follows" on public.follows;
create policy "users create own follows"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "users delete own follows" on public.follows;
create policy "users delete own follows"
  on public.follows for delete using (auth.uid() = follower_id);

-- ============================================================
--  WATCHLIST  (tracked cards + optional price alert target)
-- ============================================================
create table if not exists public.watchlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  query        text not null,
  label        text,
  image_url    text,
  target_price numeric,
  direction    text not null default 'above' check (direction in ('above','below')),
  created_at   timestamptz not null default now()
);

alter table public.watchlist enable row level security;

drop policy if exists "owners manage own watchlist" on public.watchlist;
create policy "owners manage own watchlist"
  on public.watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
--  AVATAR STORAGE  (public bucket; files stored under <user-id>/...)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are public" on storage.objects;
create policy "avatar images are public"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
--  MARKET PULSE CACHE  (populated by daily Cloudflare cron)
-- ============================================================
create table if not exists public.market_pulse_cache (
  query        text primary key,
  median       integer not null default 0,
  sales_count  integer not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.market_pulse_cache enable row level security;
drop policy if exists "pulse cache readable by all" on public.market_pulse_cache;
create policy "pulse cache readable by all"
  on public.market_pulse_cache for select using (true);
-- Allow upserts from the Worker cron (using anon or service key)
drop policy if exists "pulse cache writable by all" on public.market_pulse_cache;
create policy "pulse cache writable by all"
  on public.market_pulse_cache for all using (true);
