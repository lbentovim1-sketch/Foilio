# LFGMVault

A simple, standalone website for the LFGM group's shared trading card collection.  
Completely separate from Foilio — its own Cloudflare Worker, its own URL.

## Pages

| URL | What it is |
|---|---|
| `/` | Public gallery — everyone can browse the vault |
| `/admin` | Password-protected panel — upload and manage cards |

---

## One-time setup (do this once)

### 1. Run the SQL in your Supabase project

Open your **Slabbed** Supabase project → **SQL Editor** → **New query** → paste the contents of [`../supabase/04_lfgmvault.sql`](../supabase/04_lfgmvault.sql) → click **Run**.

This creates the `vault_cards` table and a public `vault-images` storage bucket.

### 2. Deploy the Worker to Cloudflare

```bash
cd lfgmvault
npm install
npx wrangler login    # opens browser to authorize Cloudflare
npm run deploy
```

Your site will be live at `https://lfgmvault.<your-subdomain>.workers.dev`.

### 3. Add secrets in Cloudflare

Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → click **lfgmvault** → **Settings** → **Variables and Secrets**.

Add these four secrets:

| Secret name | Where to find the value |
|---|---|
| `SUPABASE_URL` | Slabbed project → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Slabbed project → Settings → API → `anon` key |
| `SUPABASE_SERVICE_KEY` | Slabbed project → Settings → API → `service_role` key |
| `VAULT_ADMIN_PASS` | Any password you choose — this is what you type at `/admin` |

Click **Deploy** once more after saving the secrets.

---

## Customising

**Instagram handle** — open `worker.js`, find `galleryHTML`, and change:
```js
const igHandle = "lfgmvault";
```

**Contact email** — in the same function, change:
```js
const contactEmail = ""; // add your shared Gmail here when ready
```

**Admin password** — update the `VAULT_ADMIN_PASS` secret in the Cloudflare dashboard any time.

---

## Adding cards (daily use)

1. Go to `https://lfgmvault.<your-subdomain>.workers.dev/admin`
2. Enter your `VAULT_ADMIN_PASS`
3. Drag in a card photo, fill in the details, click **Add to Vault**

The card appears on the public gallery immediately.
