-- ============================================================
-- Migration: Add PSA cert fields to cards table
-- Run this in Supabase SQL Editor AFTER the initial schema.sql
-- ============================================================

alter table public.cards
  add column if not exists cert_number        text,
  add column if not exists cert_verified_at   timestamptz,
  add column if not exists cert_lookup_source text,
  add column if not exists cert_source_data   jsonb,
  add column if not exists psa_spec_id        text,
  add column if not exists population         integer,
  add column if not exists population_higher  integer,
  add column if not exists front_image_url    text,
  add column if not exists back_image_url     text;

-- Prevent duplicate cert numbers per user per grading company
-- (partial unique index — only enforced when cert_number is not null)
create unique index if not exists cards_user_cert_unique
  on public.cards (user_id, grade_co, cert_number)
  where cert_number is not null;

-- Index for cert lookups
create index if not exists cards_cert_number_idx
  on public.cards (cert_number)
  where cert_number is not null;
