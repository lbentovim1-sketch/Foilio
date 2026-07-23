-- ============================================================
--  LFGMVault — Supabase setup
--  Run this in the Supabase SQL Editor once.
--  Creates the vault_cards table and the vault-images storage bucket.
-- ============================================================

-- 1. Vault cards table ────────────────────────────────────────
create table if not exists vault_cards (
  id               uuid primary key default gen_random_uuid(),
  player           text,
  title            text,
  year             text,
  card_set         text,
  category         text,
  grading_company  text,
  grade            text,
  cert_number      text,
  image_url        text,
  notes            text,
  is_visible       boolean not null default true,
  is_for_sale      boolean not null default false,
  asking_price     numeric(10,2),
  created_at       timestamptz not null default now()
);

-- 2. Row Level Security ───────────────────────────────────────
alter table vault_cards enable row level security;

-- Public can read visible cards (no auth required)
drop policy if exists "vault_cards_public_read" on vault_cards;
create policy "vault_cards_public_read"
  on vault_cards for select
  using (is_visible = true);

-- Service role can do everything (worker uses service key for writes)
-- No additional policy needed — service role bypasses RLS by default.

-- 3. Storage bucket for card images ──────────────────────────
-- Creates a public bucket so uploaded card images are served without auth.
insert into storage.buckets (id, name, public)
values ('vault-images', 'vault-images', true)
on conflict (id) do nothing;

-- Allow public reads from the bucket (images are public)
drop policy if exists "vault_images_public_read" on storage.objects;
create policy "vault_images_public_read"
  on storage.objects for select
  using (bucket_id = 'vault-images');

-- Allow the service role to upload (worker relays uploads server-side)
-- Service role bypasses RLS, so no extra policy is needed for inserts.
