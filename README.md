# Foilio

Foilio is a trading-card market and social portfolio app. The Cloudflare Worker serves a single-page web app that can:

- search recent trading-card sold prices through The Card API
- look up PSA certs through a server-side relay
- authenticate users with Supabase
- save **specific** cards into a personal portfolio (per-listing "+ Add") and track estimated gain/loss
- set per-card visibility (public/private) for the portfolio
- give every collector a public `@handle` profile page with avatar, bio, and social links
- follow / unfollow other collectors
- track cards on a watchlist with optional in-app price alerts
- browse a live "market tape" of trending medians and a community feed of recently added cards
- list cards **for sale / trade** with an asking price, and let other collectors **buy now**, **make an offer**, or **propose a trade**
- **direct message** other collectors (with realtime delivery), with offers/buy requests threaded into the conversation and accept/decline controls for the seller
- **leaderboards** ranking collectors by public portfolio value, followers, and collection size
- **card detail pages** with a price trend, last-sale + median/avg/high/low, a recent-sales list, PSA population (when a cert is known), **likes**, **comments** (text + GIFs), and owner **photo uploads**
- **manual card entry** for raw/ungraded cards and any grading company (PSA, Beckett/BGS, SGC, CGC, TAG, Other)
- **GIFs/images in direct messages**
- an in-app **notifications center** (follows, likes, comments, offers, offer responses)

The product direction is a mix of Card Ladder, LinkedIn, stock-market tools, and Instagram for trading cards: live trends, uploaded card portfolios, public collector profiles, follows, messaging, and upload/price alerts.

## Database setup (required for the social features)

The social features (profiles, follows, watchlists, public cards, avatar uploads) need new
tables and security rules in Supabase. This is a one-time, copy-paste step:

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo, copy its entire contents, paste into the editor, and click **Run**.
3. Then open [`supabase/02_marketplace_messaging.sql`](supabase/02_marketplace_messaging.sql), and run it the same way (it adds the marketplace, offers, and messaging tables).
4. Then open [`supabase/03_engagement.sql`](supabase/03_engagement.sql) and run it (likes, comments, card photos, notifications, and a `cards` storage bucket).
5. Then open [`supabase/04_lfgmvault.sql`](supabase/04_lfgmvault.sql) and run it (creates the `vault_cards` table and `vault-images` storage bucket used by the LFGMVault gallery).
6. You should see "Success. No rows returned." after each. The scripts are safe to run again any time.

### Optional: richer market data (Phase A)

Foilio works with just The Card API, but two optional providers fill coverage gaps. Both are wired as
server-side relays and **degrade gracefully** — if a key isn't set, the related feature is simply skipped.

| Provider | Worker variable | What it adds | Notes |
| --- | --- | --- | --- |
| [SoldComps](https://sold-comps.com) | `SOLDCOMPS_API_KEY` (secret) | eBay sold-comps **fallback** when The Card API has no sales for a card (search + card pages) | Free tier ~100 req/month; key starts with `sc_` |
| [SportsCardsPro / PriceCharting](https://www.sportscardspro.com/api-documentation) | `PRICECHARTING_TOKEN` (secret) | Card **catalog autocomplete** in manual add + a grade-based **price-guide** value when no live sales exist | Requires a paid subscription token (40 chars) |

Add them in Cloudflare → your Worker → **Settings → Variables and Secrets** as **Secrets**. No code changes needed.

How the card page now sources value, in order: live confirmed sales (The Card API) → eBay sold comps (SoldComps) → catalog price guide (SportsCardsPro) → your saved value.

### Optional: GIF search

GIFs in comments and DMs work by pasting a GIF/image URL out of the box. To enable an in-app **GIF search picker**, create a free [GIPHY developer API key](https://developers.giphy.com/) and add it as a Cloudflare Worker variable named `GIPHY_API_KEY` (it is a public client key, so a plain Variable is fine). Without it, the GIF button falls back to "paste a URL".

The script creates `profiles`, `follows`, and `watchlist` tables, adds `user_id` + `is_public`
columns to `holdings`, sets up Row Level Security so users can only edit their own data (while
public profiles/cards stay readable), and creates a public `avatars` storage bucket for profile pictures.

> Note on alerts: watchlist targets are evaluated **in-app** each time you open the Watchlist page.
> Automated email/push alerts would need a Cloudflare Cron Trigger plus an email provider — that's a planned follow-up.

## Runtime configuration

Do not commit credentials to GitHub. Configure these as Cloudflare Worker environment variables/secrets:

| Binding | Used for |
| --- | --- |
| `THE_CARD_API_KEY` | Server-side key for `/api` market sales requests |
| `PSA_TOKEN` | Server-side bearer token for `/cert` PSA lookup requests |
| `SUPABASE_URL` | Public Supabase project URL injected into the page |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Public Supabase browser key injected into the page |

The PSA and Card API values stay on the server side. Supabase URL and anon/publishable key are public client configuration, but should still be supplied through deployment config so projects can be changed without editing source.

## Deploying Foilio

You do **not** need to be a developer to deploy this. Pick one of the two paths below. Path A is recommended because, once set up, every future change is published automatically.

### What you need first

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account.
- Your four config values ready to paste in: `THE_CARD_API_KEY`, `PSA_TOKEN`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.

### Path A — Automatic deploys from GitHub (recommended)

This connects your GitHub repo to Cloudflare so the app redeploys itself whenever code changes.

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. In the left menu, go to **Compute (Workers)** → **Workers & Pages**.
3. Click **Create** → **Workers** → **Connect to Git** (you may be asked to authorize GitHub the first time).
4. Choose this repository, then choose the `main` branch as the deploy branch.
5. Cloudflare will detect `wrangler.toml` automatically. Leave the build settings at their defaults and click **Save and Deploy**.
6. After the first deploy, open the Worker → **Settings** → **Variables and Secrets** and add all four values listed above. Mark `THE_CARD_API_KEY` and `PSA_TOKEN` as **Secret**; `SUPABASE_URL` and `SUPABASE_ANON_KEY` can be plain text. Click **Deploy** again so the values take effect.
7. Your site is live at the `*.workers.dev` URL shown on the Worker's page.

From now on, any change merged into `main` (including ones made through Cursor) will deploy on its own — no extra steps.

### Path B — Manual deploy from your computer

Use this if you'd rather publish by hand.

1. Install [Node.js](https://nodejs.org) (LTS version).
2. Open a terminal in this project folder and run:

```bash
npm install
npx wrangler login        # opens your browser to authorize Cloudflare
npm run deploy
```

3. Add your secrets once (Cloudflare stores them after this):

```bash
npx wrangler secret put THE_CARD_API_KEY
npx wrangler secret put PSA_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

4. Run `npm run deploy` again. The terminal prints your live `*.workers.dev` URL.

### Testing locally (optional)

Copy `.dev.vars.example` to `.dev.vars`, fill in your values, then run `npm run dev`. The `.dev.vars` file is git-ignored so your keys never get committed.

## Current Supabase assumptions

The app expects an authenticated Supabase client and a `holdings` table with columns used by `worker.js`, including:

- `id`
- `query`
- `title`
- `grade`
- `image_url`
- `added_value`
- `manual_value`
- `cert`
- `added_at`

The next durable social layer should add first-class tables for profiles, public cards, follows, messages, and alerts instead of relying only on auth metadata.

## LFGMVault — Group Collection Gallery

The Worker also serves a standalone public gallery at `/vault` for the LFGM group's shared card collection. It is completely separate from the main Foilio app.

### URLs

| URL | Description |
| --- | --- |
| `/vault` | Public gallery — browse all visible cards |
| `/vault/admin` | Password-protected admin panel — upload and manage cards |

### Setup steps

1. Run [`supabase/04_lfgmvault.sql`](supabase/04_lfgmvault.sql) in the Supabase SQL Editor (creates `vault_cards` table and `vault-images` storage bucket).
2. In your Cloudflare Worker settings, add a new **Secret** named `VAULT_ADMIN_PASS` and set it to any password you and your group will use to access the admin panel.
   - The `SUPABASE_SERVICE_KEY` secret (service-role key from Supabase → Project Settings → API) must also be set so the worker can write cards and upload images bypassing Row Level Security.
3. Deploy as normal (`npm run deploy` or merge to main if you use automatic deploys).
4. Visit `https://your-worker.workers.dev/vault` to see the public gallery.
5. Visit `https://your-worker.workers.dev/vault/admin`, enter your `VAULT_ADMIN_PASS`, and start uploading cards.

### Customising the vault

- **Instagram handle** — edit the `igHandle` constant at the top of `renderVaultGallery()` in `worker.js` (default: `lfgmvault`).
- **Contact email** — set the `contactEmail` constant in `renderVaultGallery()` to your shared Gmail address.
- **Admin password** — change the `VAULT_ADMIN_PASS` Worker secret any time in the Cloudflare dashboard.

### How card uploads work

The admin panel uploads images directly through the Worker so the Supabase service key never leaves the server. Images are stored in the `vault-images` Supabase Storage bucket (public) and card metadata goes into the `vault_cards` table. Deleting a card from the admin panel removes it from the database; the image file in storage is kept (manual cleanup via the Supabase dashboard if needed).
