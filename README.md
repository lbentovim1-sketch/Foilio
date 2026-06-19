# Foilio

Foilio is an early trading-card market and portfolio app. The current Cloudflare Worker prototype serves a single-page web app that can:

- search recent trading-card sold prices through The Card API
- look up PSA certs through a server-side relay
- authenticate users with Supabase
- save cards into a personal portfolio and track estimated gain/loss
- reserve an initial collector `@handle` during signup

The product direction is a mix of Card Ladder, LinkedIn, stock-market tools, and Instagram for trading cards: live trends, uploaded card portfolios, public collector profiles, follows, messaging, and upload/price alerts.

## Runtime configuration

Do not commit credentials to GitHub. Configure these as Cloudflare Worker environment variables/secrets:

| Binding | Used for |
| --- | --- |
| `THE_CARD_API_KEY` | Server-side key for `/api` market sales requests |
| `PSA_TOKEN` | Server-side bearer token for `/cert` PSA lookup requests |
| `SUPABASE_URL` | Public Supabase project URL injected into the page |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Public Supabase browser key injected into the page |

The PSA and Card API values stay on the server side. Supabase URL and anon/publishable key are public client configuration, but should still be supplied through deployment config so projects can be changed without editing source.

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
