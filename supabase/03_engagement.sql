-- ============================================================
--  FOILIO — engagement layer: likes, comments, card photos,
--  notifications, and GIFs in messages.
--  Run AFTER schema.sql and 02_marketplace_messaging.sql.
--  Safe to run more than once.
-- ============================================================

create extension if not exists "pgcrypto";

-- GIFs / images in direct messages
alter table public.messages add column if not exists gif_url text;

-- ============================================================
--  CARD LIKES
-- ============================================================
create table if not exists public.card_likes (
  holding_id uuid not null references public.holdings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (holding_id, user_id)
);
alter table public.card_likes enable row level security;

drop policy if exists "likes readable by everyone" on public.card_likes;
create policy "likes readable by everyone" on public.card_likes for select using (true);
drop policy if exists "users like as themselves" on public.card_likes;
create policy "users like as themselves" on public.card_likes for insert with check (auth.uid() = user_id);
drop policy if exists "users unlike themselves" on public.card_likes;
create policy "users unlike themselves" on public.card_likes for delete using (auth.uid() = user_id);

-- ============================================================
--  CARD COMMENTS  (text and/or a GIF)
-- ============================================================
create table if not exists public.card_comments (
  id         uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text,
  gif_url    text,
  created_at timestamptz not null default now()
);
alter table public.card_comments enable row level security;

drop policy if exists "comments readable by everyone" on public.card_comments;
create policy "comments readable by everyone" on public.card_comments for select using (true);
drop policy if exists "users comment as themselves" on public.card_comments;
create policy "users comment as themselves" on public.card_comments for insert with check (auth.uid() = user_id);
drop policy if exists "users delete own comments" on public.card_comments;
create policy "users delete own comments" on public.card_comments for delete using (auth.uid() = user_id);

-- ============================================================
--  CARD PHOTOS  (extra owner-uploaded photos of a card)
-- ============================================================
create table if not exists public.card_photos (
  id         uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);
alter table public.card_photos enable row level security;

drop policy if exists "card photos readable by everyone" on public.card_photos;
create policy "card photos readable by everyone" on public.card_photos for select using (true);
drop policy if exists "users add own card photos" on public.card_photos;
create policy "users add own card photos" on public.card_photos for insert with check (auth.uid() = user_id);
drop policy if exists "users delete own card photos" on public.card_photos;
create policy "users delete own card photos" on public.card_photos for delete using (auth.uid() = user_id);

-- ============================================================
--  NOTIFICATIONS  (in-app bell)
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,   -- recipient
  actor_id   uuid references auth.users(id) on delete set null,           -- who triggered it
  type       text not null,                                               -- follow|like|comment|offer|offer_accepted|offer_declined
  holding_id uuid references public.holdings(id) on delete set null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "create notifications" on public.notifications;
create policy "create notifications" on public.notifications for insert with check (auth.uid() = actor_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  CARD IMAGE STORAGE  (public bucket; files under <user-id>/...)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('cards', 'cards', true)
on conflict (id) do nothing;

drop policy if exists "card images are public" on storage.objects;
create policy "card images are public" on storage.objects for select using (bucket_id = 'cards');
drop policy if exists "users upload own card images" on storage.objects;
create policy "users upload own card images" on storage.objects for insert
  with check (bucket_id = 'cards' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "users delete own card images" on storage.objects;
create policy "users delete own card images" on storage.objects for delete
  using (bucket_id = 'cards' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
--  REALTIME  (live notifications)
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
            when undefined_object then null;
  end;
end $$;
