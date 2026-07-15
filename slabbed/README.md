# Slabbed — Card Flipper Business Tracker

**QuickBooks for sports card dealers.** Track your full buy-to-sold pipeline, see fee-aware P/L on every flip, and share your live inventory with buyers — all in one place.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Stripe** (subscriptions — $10/month, 14-day free trial)
- **Tailwind CSS**
- Deploy via **Vercel**

## Getting Started

### 1. Set up Supabase

1. Create a new Supabase project
2. In the SQL Editor, run `supabase/schema.sql` as a single migration
3. Copy your project URL and API keys

### 2. Configure Stripe

1. Create a Stripe account and a recurring product priced at $10/month
2. Note your Price ID
3. Set up a webhook pointing to `https://your-domain.com/api/stripe/webhook` with events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-only
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 4. Run locally

```bash
cd slabbed
npm install
npm run dev
```

Visit `http://localhost:3000`

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in Vercel, set root directory to `slabbed/`
3. Add all env vars in Vercel project settings
4. Deploy

## Features

| Feature | Details |
|---|---|
| Pipeline tracking | Incoming → Grading → Inventory → Listed → Sold |
| Mark Sold modal | Pre-fills fee %, shipping. Live P/L and ROI calc |
| Buying tab | Max-bid calculator with expected profit (green/red) |
| Dashboard | KPIs, category breakdown bars, biggest paper gains |
| Public share link | `/p/[slug]` — live inventory for buyers to browse |
| CSV export | Sold history + Expenses for tax season |
| Expenses log | Categorized business expense tracking |
| 14-day trial | Auto-created on signup via DB trigger |

## Routes

```
/                    Landing page (public)
/login               Sign in
/signup              Create account (starts 14-day trial)
/app                 Dashboard
/app/buying          Watchlist & max-bid calculator
/app/incoming        Cards in transit
/app/grading         Cards at graders
/app/inventory       Vault (inventory + listed + PC)
/app/sold            Realized P/L table + CSV export
/app/expenses        Business expense log + CSV export
/app/settings        Profile, fees, share link, billing
/p/[slug]            Public inventory share page
/api/stripe/checkout Stripe Checkout session
/api/stripe/portal   Stripe Customer Portal
/api/stripe/webhook  Subscription lifecycle handler
```
