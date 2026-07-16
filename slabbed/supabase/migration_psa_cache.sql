-- ============================================================
-- Migration: PSA cert lookup cache
-- Run in Supabase SQL Editor after migration_psa_fields.sql
-- ============================================================

create table if not exists public.psa_cert_cache (
  cert_number   text primary key,
  normalized    jsonb not null,        -- the full normalized result returned to the frontend
  raw_psa       jsonb,                 -- raw PSACert object from PSA API
  raw_images    jsonb,                 -- raw images response from PSA API
  front_image_url text,
  back_image_url  text,
  cached_at     timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days'
);

alter table public.psa_cert_cache enable row level security;

-- Any signed-in user can read the shared cache
create policy "psa_cache: read"
  on public.psa_cert_cache for select
  using (auth.uid() is not null);

-- Any signed-in user can write to the cache (they triggered the lookup)
create policy "psa_cache: insert"
  on public.psa_cert_cache for insert
  with check (auth.uid() is not null);

create policy "psa_cache: update"
  on public.psa_cert_cache for update
  using (auth.uid() is not null);

-- Index for expiry checks
create index if not exists psa_cert_cache_expires_idx
  on public.psa_cert_cache (expires_at);
