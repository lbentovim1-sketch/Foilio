// ============================================================
//  LFGMVault — Standalone Cloudflare Worker
//  Serves the public gallery (/), the admin panel (/admin),
//  and the card + image API (/api/cards, /api/upload).
//
//  Required Worker secrets (set in Cloudflare dashboard):
//    SUPABASE_URL         - your Supabase project URL
//    SUPABASE_ANON_KEY    - Supabase anon/public key
//    SUPABASE_SERVICE_KEY - Supabase service-role key (for writes)
//    VAULT_ADMIN_PASS     - password to access /admin
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vault-pass",
};

function env(e, k) {
  return e && typeof e[k] === "string" ? e[k].trim() : "";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function checkAuth(request, e) {
  const pass = env(e, "VAULT_ADMIN_PASS");
  if (!pass) return true; // no password set → open (shouldn't happen in prod)
  return (request.headers.get("x-vault-pass") || "") === pass;
}

function sbReadKey(e) {
  return env(e, "SUPABASE_ANON_KEY");
}
function sbWriteKey(e) {
  return env(e, "SUPABASE_SERVICE_KEY") || env(e, "SUPABASE_ANON_KEY");
}

export default {
  async fetch(request, e = {}) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: CORS });

    // ── Public gallery ──────────────────────────────────────
    if (path === "/" || path === "") {
      return new Response(galleryHTML(e), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ── Admin panel ─────────────────────────────────────────
    if (path === "/admin" || path === "/admin/") {
      return new Response(adminHTML(e), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ── API: list cards (public) ────────────────────────────
    if (path === "/api/cards" && method === "GET") {
      const sbUrl = env(e, "SUPABASE_URL");
      const sbKey = sbReadKey(e);
      if (!sbUrl || !sbKey) return json({ error: "Supabase not configured." }, 500);
      try {
        const r = await fetch(
          sbUrl + "/rest/v1/vault_cards?is_visible=eq.true&order=created_at.desc",
          { headers: { apikey: sbKey, Authorization: "Bearer " + sbKey } }
        );
        const data = await r.json();
        return new Response(JSON.stringify(data), {
          status: r.status,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (_) {
        return json({ error: "Could not load cards." }, 502);
      }
    }

    // ── API: add card ───────────────────────────────────────
    if (path === "/api/cards" && method === "POST") {
      if (!checkAuth(request, e)) return json({ error: "Unauthorized." }, 401);
      const sbUrl = env(e, "SUPABASE_URL");
      const sbKey = sbWriteKey(e);
      if (!sbUrl || !sbKey) return json({ error: "Supabase not configured." }, 500);
      try {
        const body = await request.json();
        const r = await fetch(sbUrl + "/rest/v1/vault_cards", {
          method: "POST",
          headers: {
            apikey: sbKey, Authorization: "Bearer " + sbKey,
            "Content-Type": "application/json", Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        return new Response(JSON.stringify(data), {
          status: r.status,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (_) {
        return json({ error: "Could not save card." }, 502);
      }
    }

    // ── API: update card ────────────────────────────────────
    if (path.startsWith("/api/cards/") && (method === "PUT" || method === "PATCH")) {
      if (!checkAuth(request, e)) return json({ error: "Unauthorized." }, 401);
      const id = path.replace("/api/cards/", "");
      const sbUrl = env(e, "SUPABASE_URL");
      const sbKey = sbWriteKey(e);
      if (!sbUrl || !sbKey) return json({ error: "Supabase not configured." }, 500);
      try {
        const body = await request.json();
        const r = await fetch(
          sbUrl + "/rest/v1/vault_cards?id=eq." + encodeURIComponent(id),
          {
            method: "PATCH",
            headers: {
              apikey: sbKey, Authorization: "Bearer " + sbKey,
              "Content-Type": "application/json", Prefer: "return=representation",
            },
            body: JSON.stringify(body),
          }
        );
        const data = await r.json();
        return new Response(JSON.stringify(data), {
          status: r.status,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (_) {
        return json({ error: "Could not update card." }, 502);
      }
    }

    // ── API: delete card ────────────────────────────────────
    if (path.startsWith("/api/cards/") && method === "DELETE") {
      if (!checkAuth(request, e)) return json({ error: "Unauthorized." }, 401);
      const id = path.replace("/api/cards/", "");
      const sbUrl = env(e, "SUPABASE_URL");
      const sbKey = sbWriteKey(e);
      if (!sbUrl || !sbKey) return json({ error: "Supabase not configured." }, 500);
      try {
        const r = await fetch(
          sbUrl + "/rest/v1/vault_cards?id=eq." + encodeURIComponent(id),
          { method: "DELETE", headers: { apikey: sbKey, Authorization: "Bearer " + sbKey } }
        );
        return new Response(null, { status: r.status, headers: CORS });
      } catch (_) {
        return json({ error: "Could not delete card." }, 502);
      }
    }

    // ── API: upload image ───────────────────────────────────
    if (path === "/api/upload" && method === "POST") {
      if (!checkAuth(request, e)) return json({ error: "Unauthorized." }, 401);
      const sbUrl = env(e, "SUPABASE_URL");
      const sbKey = sbWriteKey(e);
      if (!sbUrl || !sbKey) return json({ error: "Supabase not configured." }, 500);
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") return json({ error: "No file provided." }, 400);
        const ext = (file.name || "img").split(".").pop().toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext) ? ext : "jpg";
        const uid = crypto.randomUUID();
        const storagePath = "vault-cards/" + uid + "." + safeExt;
        const buf = await file.arrayBuffer();
        const up = await fetch(
          sbUrl + "/storage/v1/object/vault-images/" + storagePath,
          {
            method: "POST",
            headers: {
              apikey: sbKey, Authorization: "Bearer " + sbKey,
              "Content-Type": file.type || "image/jpeg",
            },
            body: buf,
          }
        );
        if (!up.ok) {
          const err = await up.text();
          return json({ error: "Upload failed: " + err }, 502);
        }
        const publicUrl =
          sbUrl + "/storage/v1/object/public/vault-images/" + storagePath;
        return json({ url: publicUrl }, 200);
      } catch (err) {
        return json({ error: "Upload error: " + (err && err.message ? err.message : String(err)) }, 502);
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Public Gallery HTML
// ─────────────────────────────────────────────────────────────────────────────
function galleryHTML(e) {
  const igHandle = "lfgmvault";
  const contactEmail = ""; // add your shared Gmail here when ready
  const igUrl = "https://instagram.com/" + igHandle;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>LGMVault — Premium Card Collection</title>
<meta name="description" content="LGMVault is a group of six collectors sharing a vault of premium trading cards. Browse the collection and reach out if you're interested."/>
<meta property="og:title" content="LGMVault — Premium Card Collection"/>
<meta property="og:description" content="Browse our vault of premium trading cards."/>
<meta property="og:url" content="https://lgmvault.com"/>
<meta property="og:type" content="website"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root{
    --bg:#07080f;--surface:#0d0f1c;--surface2:#12152a;--border:#1e2240;--border2:#2a2f52;
    --text:#f0f2ff;--muted:#8b91b8;--dim:#4a4f72;
    --gold:#f5b544;--gold2:#ffcf6a;--indigo:#7c6cff;
    --up:#2bd67a;--pill-bg:rgba(245,181,68,.12);--pill-border:rgba(245,181,68,.3);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--text);font-family:'Manrope',system-ui,sans-serif;line-height:1.6;overflow-x:hidden}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
  a{color:var(--gold);text-decoration:none}
  img{display:block}

  /* Topbar */
  #topbar{position:sticky;top:0;z-index:50;background:rgba(7,8,15,.88);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:62px}
  .logo{font-family:'Space Grotesk',sans-serif;font-size:21px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(90deg,var(--gold),var(--gold2) 45%,#fff 70%,var(--gold2));background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-size:200% auto;animation:shimmer 5s linear infinite}
  @keyframes shimmer{to{background-position:200% center}}
  .tbar-links{display:flex;align-items:center;gap:10px}
  .tbar-btn{display:flex;align-items:center;gap:7px;padding:7px 16px;border-radius:100px;font-size:13px;font-weight:700;border:none;cursor:pointer;text-decoration:none;transition:all .2s;white-space:nowrap}
  .tbar-btn.ig{background:linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);color:#fff}
  .tbar-btn.ig:hover{opacity:.85;transform:translateY(-1px)}
  .tbar-btn.mail{background:var(--surface2);border:1px solid var(--border2);color:var(--text)}
  .tbar-btn.mail:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-1px)}

  /* Hero */
  #hero{position:relative;text-align:center;padding:90px 28px 70px;overflow:hidden}
  .hero-glow{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(124,108,255,.15),transparent 70%),radial-gradient(ellipse 40% 40% at 80% 90%,rgba(245,181,68,.08),transparent 60%);pointer-events:none}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;background:var(--pill-bg);border:1px solid var(--pill-border);border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:24px}
  .hero-title{font-family:'Space Grotesk',sans-serif;font-size:clamp(42px,8vw,88px);font-weight:800;letter-spacing:-3px;line-height:1;margin-bottom:18px}
  .hero-title .vault{background:linear-gradient(90deg,var(--gold),var(--gold2) 50%,#fff 75%,var(--gold));background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-size:200% auto;animation:shimmer 4s linear infinite}
  .hero-sub{font-size:17px;color:var(--muted);max-width:520px;margin:0 auto 36px}
  .hero-ctas{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
  .hero-cta{display:flex;align-items:center;gap:8px;padding:13px 28px;border-radius:100px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;transition:all .2s}
  .hero-cta.primary{background:linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);color:#fff;box-shadow:0 4px 24px rgba(220,39,67,.35)}
  .hero-cta.primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(220,39,67,.45)}
  .hero-cta.secondary{background:transparent;border:1.5px solid var(--border2);color:var(--text)}
  .hero-cta.secondary:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-2px)}

  /* Stats */
  #statsBar{display:flex;align-items:center;justify-content:center;gap:40px;padding:22px 28px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface);flex-wrap:wrap}
  .stat-item .sv{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:var(--gold);text-align:center}
  .stat-item .sl{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.9px;margin-top:2px;text-align:center}

  /* Filters */
  #filterBar{display:flex;align-items:center;gap:8px;padding:24px 28px 0;flex-wrap:wrap;max-width:1300px;margin:0 auto}
  .filter-btn{padding:7px 16px;border-radius:100px;border:1.5px solid var(--border2);background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Manrope',sans-serif}
  .filter-btn:hover{color:var(--text)}
  .filter-btn.active{border-color:var(--gold);background:rgba(245,181,68,.1);color:var(--gold)}

  /* Card grid */
  #gallery{max-width:1300px;margin:0 auto;padding:24px 28px 80px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}
  .card-tile{background:var(--surface);border:1.5px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
  .card-tile:hover{transform:translateY(-5px);border-color:var(--gold);box-shadow:0 16px 48px rgba(245,181,68,.12)}
  .card-img-wrap{width:100%;aspect-ratio:5/7;overflow:hidden;background:var(--surface2);position:relative}
  .card-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
  .card-tile:hover .card-img-wrap img{transform:scale(1.04)}
  .grade-badge{position:absolute;top:10px;right:10px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;font-family:'Space Grotesk',sans-serif}
  .grade-badge.g10{background:linear-gradient(135deg,#f5b544,#ff6f00);color:#000}
  .grade-badge.g9{background:#c0c0c0;color:#111}
  .grade-badge.gx{background:var(--surface2);border:1px solid var(--border2);color:var(--gold)}
  .grade-badge.raw{background:var(--surface2);border:1px solid var(--border2);color:var(--muted)}
  .card-info{padding:12px 14px 14px}
  .card-player{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-meta{font-size:11px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sale-tag{display:inline-block;margin-top:8px;font-size:10px;font-weight:800;color:var(--up);letter-spacing:.5px;text-transform:uppercase;background:rgba(43,214,122,.12);border:1px solid rgba(43,214,122,.3);border-radius:100px;padding:2px 8px}

  /* Empty / loading */
  #emptyState{display:none;text-align:center;padding:80px 28px;color:var(--dim);grid-column:1/-1}
  #loadingState{display:flex;align-items:center;justify-content:center;padding:80px;color:var(--dim);gap:12px;grid-column:1/-1}
  .spinner{width:26px;height:26px;border:3px solid var(--border2);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Modal */
  #modal{display:none;position:fixed;inset:0;z-index:100;background:rgba(7,8,15,.88);backdrop-filter:blur(8px);align-items:center;justify-content:center;padding:20px}
  #modal.open{display:flex}
  #modal-inner{background:var(--surface);border:1.5px solid var(--border2);border-radius:20px;max-width:820px;width:100%;max-height:90vh;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;position:relative}
  #modal-img{width:100%;aspect-ratio:5/7;object-fit:cover;border-radius:18px 0 0 18px;background:var(--surface2)}
  #modal-body{padding:32px 26px;display:flex;flex-direction:column;gap:14px}
  #modal-close{position:absolute;top:14px;right:14px;background:var(--surface2);border:1px solid var(--border2);color:var(--muted);border-radius:50%;width:34px;height:34px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .15s;line-height:1}
  #modal-close:hover{color:var(--text)}
  .m-badge{display:inline-block;padding:5px 14px;border-radius:100px;font-size:13px;font-weight:800;letter-spacing:.5px;font-family:'Space Grotesk',sans-serif}
  .m-title{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;line-height:1.2}
  .m-set{font-size:14px;color:var(--muted)}
  .m-dg{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
  .m-row .ml{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.9px;font-weight:700}
  .m-row .mv{font-size:14px;margin-top:2px}
  .m-notes{font-size:13px;color:var(--muted);background:var(--surface2);border-radius:10px;padding:12px;line-height:1.6}
  .m-contact{margin-top:auto;display:flex;flex-direction:column;gap:8px}
  .m-contact p{font-size:12px;color:var(--dim)}
  .m-cta{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 20px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;transition:opacity .2s;width:100%;border:none;cursor:pointer}
  .m-cta.ig{background:linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);color:#fff}
  .m-cta.ig:hover{opacity:.85}
  .m-cta.mail{background:var(--surface2);border:1px solid var(--border2);color:var(--text)}
  .m-cta.mail:hover{border-color:var(--gold);color:var(--gold)}

  /* Contact section */
  #contact{background:var(--surface);border-top:1px solid var(--border);padding:64px 28px;text-align:center}
  #contact h2{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:800;letter-spacing:-1px;margin-bottom:12px}
  #contact p{color:var(--muted);font-size:16px;max-width:460px;margin:0 auto 32px}
  .contact-btns{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
  .contact-btn{display:flex;align-items:center;gap:8px;padding:13px 28px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;transition:all .2s}
  .contact-btn.ig{background:linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);color:#fff;box-shadow:0 4px 20px rgba(220,39,67,.3)}
  .contact-btn.ig:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(220,39,67,.4)}
  .contact-btn.mail{background:transparent;border:1.5px solid var(--border2);color:var(--text)}
  .contact-btn.mail:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-2px)}

  footer{text-align:center;padding:24px;font-size:12px;color:var(--dim);border-top:1px solid var(--border)}

  @media(max-width:700px){
    #modal-inner{grid-template-columns:1fr}
    #modal-img{border-radius:18px 18px 0 0;aspect-ratio:4/3}
    #modal-body{padding:18px}
    #topbar{padding:0 16px}
    .logo{font-size:18px}
    .tbar-btn span{display:none}
    #gallery{grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;padding:16px}
  }
</style>
</head>
<body>

<nav id="topbar">
  <div class="logo">LFGMVault</div>
  <div class="tbar-links">
    <a class="tbar-btn ig" href="${igUrl}" target="_blank" rel="noopener">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
      <span>@${igHandle}</span>
    </a>
    ${contactEmail ? `<a class="tbar-btn mail" href="mailto:${contactEmail}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
      <span>Email</span>
    </a>` : ""}
  </div>
</nav>

<section id="hero">
  <div class="hero-glow"></div>
  <div class="eyebrow">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
    Shared Collector Vault
  </div>
  <h1 class="hero-title">LFGM<span class="vault">Vault</span></h1>
  <p class="hero-sub">Six collectors. One vault. Premium cards acquired together — on display here and on our Instagram.</p>
  <div class="hero-ctas">
    <a class="hero-cta primary" href="${igUrl}" target="_blank" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
      Follow on Instagram
    </a>
    <a class="hero-cta secondary" href="#gallery-section">Browse the Vault</a>
  </div>
</section>

<div id="statsBar">
  <div class="stat-item"><div class="sv" id="statCards">—</div><div class="sl">Cards in Vault</div></div>
  <div class="stat-item"><div class="sv" id="statCollectors">6</div><div class="sl">Collectors</div></div>
  <div class="stat-item"><div class="sv" id="statForSale">—</div><div class="sl">Available</div></div>
</div>

<div id="filterBar">
  <button class="filter-btn active" data-cat="all">All Cards</button>
  <button class="filter-btn" data-cat="Basketball">Basketball</button>
  <button class="filter-btn" data-cat="Baseball">Baseball</button>
  <button class="filter-btn" data-cat="Football">Football</button>
  <button class="filter-btn" data-cat="Hockey">Hockey</button>
  <button class="filter-btn" data-cat="Soccer">Soccer</button>
  <button class="filter-btn" data-cat="Pokemon">Pokémon</button>
  <button class="filter-btn" data-cat="Other">Other</button>
</div>

<div id="gallery-section">
  <div id="gallery">
    <div id="loadingState"><div class="spinner"></div> Loading vault…</div>
    <div id="emptyState">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
      <p style="margin-top:12px;font-size:15px">No cards found — try a different filter.</p>
    </div>
  </div>
</div>

<!-- Modal -->
<div id="modal" role="dialog" aria-modal="true">
  <div id="modal-inner">
    <img id="modal-img" src="" alt="Card"/>
    <div id="modal-body">
      <button id="modal-close" aria-label="Close">×</button>
      <div id="m-badge-wrap"></div>
      <div class="m-title" id="m-player"></div>
      <div class="m-set" id="m-set"></div>
      <div class="m-dg" id="m-dg"></div>
      <div id="m-notes-wrap" style="display:none"><div class="m-notes" id="m-notes"></div></div>
      <div id="m-price-wrap" style="display:none">
        <div style="font-size:11px;color:var(--up);font-weight:800;text-transform:uppercase;letter-spacing:.5px">Available</div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800" id="m-price"></div>
      </div>
      <div class="m-contact">
        <p>Interested? Reach out on Instagram or email us.</p>
        <a class="m-cta ig" href="${igUrl}" target="_blank" rel="noopener">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          DM on Instagram
        </a>
        ${contactEmail ? `<a class="m-cta mail" href="mailto:${contactEmail}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
          Send an Email
        </a>` : ""}
      </div>
    </div>
  </div>
</div>

<section id="contact">
  <h2>Interested in a Card?</h2>
  <p>We're open to offers on select cards. Hit us up on Instagram or send us an email.</p>
  <div class="contact-btns">
    <a class="contact-btn ig" href="${igUrl}" target="_blank" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
      @${igHandle}
    </a>
    ${contactEmail ? `<a class="contact-btn mail" href="mailto:${contactEmail}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
      ${contactEmail}
    </a>` : ""}
  </div>
</section>

<footer>© 2025 LFGMVault · Shared card vault · <a href="${igUrl}" target="_blank">Instagram</a></footer>

<script>
(function(){
  var allCards=[], activeCat="all";

  function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function gradeCls(card){
    var g=(card.grade||"").toString().toLowerCase();
    if(!card.grade||card.grade==="Raw") return "raw";
    if(g==="10"||g.includes("10")) return "g10";
    if(g==="9"||g.includes("9")) return "g9";
    return "gx";
  }
  function gradeLabel(card){
    var co=(card.grading_company||"").toUpperCase();
    if(!card.grade||card.grade==="Raw") return "RAW";
    return co?co+" "+card.grade:card.grade;
  }

  function tile(card){
    var img=card.image_url
      ?'<img src="'+esc(card.image_url)+'" alt="'+esc(card.player||"Card")+'" loading="lazy"/>'
      :'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--dim)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
    var meta=[card.year,card.card_set].filter(Boolean).join(" · ");
    return '<div class="card-tile" data-id="'+esc(card.id)+'" tabindex="0" role="button">'
      +'<div class="card-img-wrap">'+img+'<span class="grade-badge '+gradeCls(card)+'">'+esc(gradeLabel(card))+'</span></div>'
      +'<div class="card-info"><div class="card-player">'+esc(card.player||card.title||"Unknown")+'</div>'
      +'<div class="card-meta">'+esc(meta||"Trading Card")+'</div>'
      +(card.is_for_sale?'<div class="sale-tag">For Sale</div>':'')
      +'</div></div>';
  }

  function filtered(){ return activeCat==="all"?allCards:allCards.filter(function(c){ return (c.category||"").toLowerCase()===activeCat.toLowerCase(); }); }

  function render(){
    var cards=filtered();
    var g=document.getElementById("gallery");
    var empty=document.getElementById("emptyState");
    if(!cards.length){ g.innerHTML=""; empty.style.display="block"; return; }
    empty.style.display="none";
    g.innerHTML=cards.map(tile).join("");
    g.querySelectorAll(".card-tile").forEach(function(el){
      function open(){ openModal(el.getAttribute("data-id")); }
      el.addEventListener("click",open);
      el.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" ") open(); });
    });
  }

  function openModal(id){
    var c=allCards.find(function(x){ return x.id===id; }); if(!c) return;
    var mi=document.getElementById("modal-img");
    mi.src=c.image_url||""; mi.style.display=c.image_url?"":"none";
    document.getElementById("m-badge-wrap").innerHTML='<span class="m-badge" style="'+(gradeCls(c)==="g10"?"background:linear-gradient(135deg,#f5b544,#ff6f00);color:#000":gradeCls(c)==="g9"?"background:#c0c0c0;color:#111":"background:var(--surface2);border:1px solid var(--border2);color:var(--gold)")+'">'+esc(gradeLabel(c))+'</span>';
    document.getElementById("m-player").textContent=c.player||c.title||"Unknown";
    document.getElementById("m-set").textContent=[c.year,c.card_set].filter(Boolean).join(" · ");
    var rows=[];
    if(c.grading_company) rows.push({l:"Graded By",v:c.grading_company});
    if(c.grade) rows.push({l:"Grade",v:c.grade});
    if(c.cert_number) rows.push({l:"Cert #",v:c.cert_number});
    if(c.category) rows.push({l:"Sport",v:c.category});
    document.getElementById("m-dg").innerHTML=rows.map(function(r){ return '<div class="m-row"><div class="ml">'+esc(r.l)+'</div><div class="mv">'+esc(r.v)+'</div></div>'; }).join("");
    var nw=document.getElementById("m-notes-wrap");
    if(c.notes){ nw.style.display=""; document.getElementById("m-notes").textContent=c.notes; } else { nw.style.display="none"; }
    var pw=document.getElementById("m-price-wrap");
    if(c.is_for_sale){ pw.style.display=""; document.getElementById("m-price").textContent=c.asking_price?"$"+Number(c.asking_price).toLocaleString():"Make an Offer"; } else { pw.style.display="none"; }
    document.getElementById("modal").classList.add("open");
    document.body.style.overflow="hidden";
  }

  function closeModal(){ document.getElementById("modal").classList.remove("open"); document.body.style.overflow=""; }
  document.getElementById("modal-close").addEventListener("click",closeModal);
  document.getElementById("modal").addEventListener("click",function(e){ if(e.target===this) closeModal(); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape") closeModal(); });

  document.querySelectorAll(".filter-btn").forEach(function(btn){
    btn.addEventListener("click",function(){
      document.querySelectorAll(".filter-btn").forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active"); activeCat=btn.getAttribute("data-cat"); render();
    });
  });

  fetch("/api/cards").then(function(r){ return r.json(); }).then(function(cards){
    allCards=Array.isArray(cards)?cards:[];
    document.getElementById("statCards").textContent=allCards.length;
    document.getElementById("statForSale").textContent=allCards.filter(function(c){ return c.is_for_sale; }).length||"0";
    document.getElementById("loadingState").style.display="none";
    render();
  }).catch(function(){
    document.getElementById("loadingState").innerHTML='<span style="color:var(--dim)">Could not load cards — please try again later.</span>';
  });
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Admin Panel HTML
// ─────────────────────────────────────────────────────────────────────────────
function adminHTML(e) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>LFGMVault Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  :root{
    --bg:#07080f;--surface:#0d0f1c;--surface2:#12152a;--border:#1e2240;--border2:#2a2f52;
    --text:#f0f2ff;--muted:#8b91b8;--dim:#4a4f72;
    --gold:#f5b544;--indigo:#7c6cff;--up:#2bd67a;--down:#ff5d6c;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Manrope',system-ui,sans-serif;line-height:1.6;min-height:100vh}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}

  #topbar{background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:58px}
  .logo{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:800;color:var(--gold)}
  .logo span{color:var(--muted);font-size:13px;font-weight:500;margin-left:8px}
  .view-link{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid var(--border2);background:transparent;color:var(--muted);text-decoration:none;transition:all .15s}
  .view-link:hover{color:var(--text)}

  /* Auth */
  #authScreen{position:fixed;inset:0;background:var(--bg);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px}
  #authBox{background:var(--surface);border:1.5px solid var(--border2);border-radius:20px;padding:40px;max-width:360px;width:100%;text-align:center}
  #authBox h2{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;margin-bottom:8px}
  #authBox p{color:var(--muted);font-size:14px;margin-bottom:24px}
  #authInput{width:100%;background:var(--bg);border:1.5px solid var(--border2);border-radius:10px;padding:13px 16px;color:var(--text);font-size:15px;font-family:'JetBrains Mono',monospace;outline:none;text-align:center;letter-spacing:3px;margin-bottom:12px}
  #authInput:focus{border-color:var(--gold)}
  #authBtn{width:100%;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:15px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif}
  #authBtn:hover{opacity:.88}
  #authErr{color:var(--down);font-size:13px;margin-top:8px;min-height:18px}

  /* Layout */
  #app{display:none;max-width:1100px;margin:0 auto;padding:32px 24px 80px;gap:28px}
  #app.visible{display:grid;grid-template-columns:400px 1fr}

  /* Panels */
  .panel{background:var(--surface);border:1.5px solid var(--border);border-radius:16px;padding:24px}
  .panel-title{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:8px;color:var(--gold)}
  label{display:block;font-size:11px;font-weight:700;color:var(--dim);letter-spacing:.9px;text-transform:uppercase;margin-bottom:6px;margin-top:14px;font-family:'JetBrains Mono',monospace}
  label:first-of-type{margin-top:0}
  input[type=text],input[type=number],select,textarea{width:100%;background:var(--bg);border:1.5px solid var(--border2);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;outline:none;font-family:'Manrope',sans-serif;transition:border-color .15s}
  input[type=text]:focus,input[type=number]:focus,select:focus,textarea:focus{border-color:var(--gold)}
  select option{background:var(--surface)}
  textarea{resize:vertical;min-height:68px}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}

  /* Drop zone */
  #dropZone{border:2px dashed var(--border2);border-radius:12px;padding:26px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;position:relative;margin-top:14px}
  #dropZone.drag{border-color:var(--gold);background:rgba(245,181,68,.05)}
  #dropZone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
  #dropZone p{font-size:13px;color:var(--muted);margin-top:8px}
  #dropZone .hint{font-size:11px;color:var(--dim);margin-top:4px}
  #previewWrap{display:none;margin-top:12px}
  #previewWrap img{width:100%;max-height:220px;object-fit:contain;border-radius:10px;border:1px solid var(--border2)}
  #previewWrap .clr{margin-top:8px;font-size:12px;color:var(--down);cursor:pointer}

  /* Toggles */
  .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)}
  .toggle-row:last-child{border-bottom:none}
  .tl{font-size:14px;font-weight:600}
  .ts{font-size:12px;color:var(--muted);margin-top:2px}
  .switch{position:relative;width:40px;height:22px;flex-shrink:0}
  .switch input{opacity:0;width:0;height:0}
  .slider{position:absolute;inset:0;background:var(--border2);border-radius:22px;cursor:pointer;transition:.2s}
  .slider:before{content:"";position:absolute;width:16px;height:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
  input:checked+.slider{background:var(--up)}
  input:checked+.slider:before{transform:translateX(18px)}

  /* Submit */
  #submitBtn{width:100%;margin-top:18px;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:15px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif;transition:opacity .15s;display:flex;align-items:center;justify-content:center;gap:8px}
  #submitBtn:disabled{opacity:.5;cursor:default}
  #submitMsg{margin-top:8px;font-size:13px;text-align:center;min-height:18px}
  #submitMsg.ok{color:var(--up)}
  #submitMsg.err{color:var(--down)}

  /* Card list */
  #cardList{display:flex;flex-direction:column;gap:10px}
  .card-row{background:var(--surface2);border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;gap:12px;padding:10px 14px}
  .cr-img{width:38px;height:54px;border-radius:6px;object-fit:cover;background:var(--bg);flex-shrink:0}
  .cr-img-ph{width:38px;height:54px;border-radius:6px;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--dim)}
  .cr-info{flex:1;min-width:0}
  .cr-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cr-meta{font-size:11px;color:var(--muted)}
  .cr-acts{display:flex;gap:6px;flex-shrink:0}
  .act-btn{padding:5px 10px;border-radius:7px;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:'Manrope',sans-serif;transition:opacity .15s}
  .act-btn:hover{opacity:.8}
  .act-btn.del{background:rgba(255,93,108,.15);color:var(--down);border:1px solid rgba(255,93,108,.3)}
  .act-btn.vis{background:var(--surface);border:1px solid var(--border2);color:var(--muted)}
  .act-btn.vis.on{background:rgba(43,214,122,.1);border-color:rgba(43,214,122,.3);color:var(--up)}
  #listStatus{font-size:12px;color:var(--dim);margin-bottom:12px}

  @keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:860px){ #app{grid-template-columns:1fr} }
</style>
</head>
<body>

<div id="topbar">
  <div class="logo">LFGMVault <span>Admin</span></div>
  <a class="view-link" href="/" target="_blank">View Gallery →</a>
</div>

<div id="authScreen">
  <div id="authBox">
    <h2>🔐 Vault Admin</h2>
    <p>Enter the admin password to manage your vault.</p>
    <input type="password" id="authInput" placeholder="••••••••" autocomplete="current-password"/>
    <button id="authBtn">Unlock</button>
    <div id="authErr"></div>
  </div>
</div>

<div id="app">
  <!-- Add card -->
  <div>
    <div class="panel">
      <div class="panel-title">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Add a Card
      </div>
      <div id="dropZone">
        <input type="file" id="fileInput" accept="image/*"/>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        <p>Drop card image here or click to browse</p>
        <div class="hint">JPG, PNG, WEBP · Max 10 MB</div>
      </div>
      <div id="previewWrap">
        <img id="preview" src="" alt="Preview"/>
        <div class="clr" id="clearPreview">✕ Remove image</div>
      </div>

      <label for="fPlayer">Player / Card Title *</label>
      <input type="text" id="fPlayer" placeholder="e.g. Victor Wembanyama"/>

      <div class="field-row">
        <div><label for="fYear">Year</label><input type="text" id="fYear" placeholder="2023"/></div>
        <div><label for="fSet">Set</label><input type="text" id="fSet" placeholder="Prizm"/></div>
      </div>

      <label for="fCat">Sport / Category</label>
      <select id="fCat">
        <option value="">— Select —</option>
        <option>Basketball</option><option>Baseball</option><option>Football</option>
        <option>Hockey</option><option>Soccer</option><option>Pokemon</option><option>Other</option>
      </select>

      <div class="field-row">
        <div>
          <label for="fCompany">Grading Company</label>
          <select id="fCompany">
            <option value="">Raw / None</option>
            <option>PSA</option><option>BGS</option><option>SGC</option>
            <option>CGC</option><option>TAG</option><option>Other</option>
          </select>
        </div>
        <div><label for="fGrade">Grade</label><input type="text" id="fGrade" placeholder="10"/></div>
      </div>

      <label for="fCert">Cert # (optional)</label>
      <input type="text" id="fCert" placeholder="e.g. 12345678"/>

      <label for="fNotes">Notes (optional)</label>
      <textarea id="fNotes" placeholder="Short print, /25, rookie card…"></textarea>

      <div style="margin-top:14px">
        <div class="toggle-row">
          <div><div class="tl">Visible on Gallery</div><div class="ts">Show this card publicly</div></div>
          <label class="switch"><input type="checkbox" id="fVisible" checked/><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <div><div class="tl">Mark as For Sale</div><div class="ts">Show a "For Sale" badge</div></div>
          <label class="switch"><input type="checkbox" id="fForSale"/><span class="slider"></span></label>
        </div>
      </div>
      <div id="priceRow" style="display:none;margin-top:14px">
        <label for="fPrice">Asking Price (USD)</label>
        <input type="number" id="fPrice" placeholder="e.g. 500" min="0"/>
      </div>

      <button id="submitBtn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
        Add to Vault
      </button>
      <div id="submitMsg"></div>
    </div>
  </div>

  <!-- Card list -->
  <div>
    <div class="panel">
      <div class="panel-title">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
        Vault Cards
      </div>
      <div id="listStatus">Loading…</div>
      <div id="cardList"></div>
    </div>
  </div>
</div>

<script>
(function(){
  var adminPass="", allCards=[], selectedFile=null;

  function tryAuth(){
    var p=document.getElementById("authInput").value.trim();
    if(!p){ document.getElementById("authErr").textContent="Enter a password."; return; }
    fetch("/api/cards",{headers:{"x-vault-pass":p}}).then(function(r){
      if(r.ok){
        adminPass=p;
        document.getElementById("authScreen").style.display="none";
        document.getElementById("app").classList.add("visible");
        loadCards();
      } else { document.getElementById("authErr").textContent="Wrong password."; }
    }).catch(function(){ document.getElementById("authErr").textContent="Could not connect."; });
  }
  document.getElementById("authBtn").addEventListener("click",tryAuth);
  document.getElementById("authInput").addEventListener("keydown",function(e){ if(e.key==="Enter") tryAuth(); });

  var dz=document.getElementById("dropZone");
  var fi=document.getElementById("fileInput");
  dz.addEventListener("dragover",function(e){ e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave",function(){ dz.classList.remove("drag"); });
  dz.addEventListener("drop",function(e){ e.preventDefault(); dz.classList.remove("drag"); var f=e.dataTransfer.files[0]; if(f) setFile(f); });
  fi.addEventListener("change",function(){ if(fi.files[0]) setFile(fi.files[0]); });
  document.getElementById("clearPreview").addEventListener("click",clearFile);

  function setFile(f){
    selectedFile=f;
    var r=new FileReader(); r.onload=function(e){ document.getElementById("preview").src=e.target.result; }; r.readAsDataURL(f);
    document.getElementById("previewWrap").style.display="";
    document.getElementById("dropZone").style.display="none";
  }
  function clearFile(){
    selectedFile=null; fi.value="";
    document.getElementById("previewWrap").style.display="none";
    document.getElementById("dropZone").style.display="";
  }

  document.getElementById("fForSale").addEventListener("change",function(){
    document.getElementById("priceRow").style.display=this.checked?"":"none";
  });

  document.getElementById("submitBtn").addEventListener("click",async function(){
    var player=document.getElementById("fPlayer").value.trim();
    if(!player){ setMsg("err","Player / title is required."); return; }
    var btn=document.getElementById("submitBtn");
    btn.disabled=true;
    btn.innerHTML='<div style="width:15px;height:15px;border:2.5px solid rgba(0,0,0,.3);border-top-color:#000;border-radius:50%;animation:spin .6s linear infinite"></div> Saving…';
    setMsg("","");
    try {
      var imageUrl="";
      if(selectedFile){
        setMsg("","Uploading image…");
        var fd=new FormData(); fd.append("file",selectedFile);
        var up=await fetch("/api/upload",{method:"POST",headers:{"x-vault-pass":adminPass},body:fd});
        if(!up.ok){ var ej=await up.json(); throw new Error(ej.error||"Upload failed"); }
        imageUrl=(await up.json()).url;
      }
      var payload={
        player:player, title:player,
        year:document.getElementById("fYear").value.trim()||null,
        card_set:document.getElementById("fSet").value.trim()||null,
        category:document.getElementById("fCat").value||null,
        grading_company:document.getElementById("fCompany").value||null,
        grade:document.getElementById("fGrade").value.trim()||null,
        cert_number:document.getElementById("fCert").value.trim()||null,
        notes:document.getElementById("fNotes").value.trim()||null,
        image_url:imageUrl||null,
        is_visible:document.getElementById("fVisible").checked,
        is_for_sale:document.getElementById("fForSale").checked,
        asking_price:document.getElementById("fForSale").checked?(parseFloat(document.getElementById("fPrice").value)||null):null,
      };
      var r=await fetch("/api/cards",{method:"POST",headers:{"Content-Type":"application/json","x-vault-pass":adminPass},body:JSON.stringify(payload)});
      if(!r.ok){ var ej=await r.json(); throw new Error(ej.error||"Save failed"); }
      setMsg("ok","✓ Card added to vault!"); resetForm(); loadCards();
    } catch(err){ setMsg("err","Error: "+(err.message||"Unknown")); }
    btn.disabled=false;
    btn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg> Add to Vault';
  });

  function setMsg(cls,text){ var el=document.getElementById("submitMsg"); el.className=cls; el.textContent=text; }
  function resetForm(){
    ["fPlayer","fYear","fSet","fCert","fNotes","fPrice"].forEach(function(id){ document.getElementById(id).value=""; });
    document.getElementById("fCat").value=""; document.getElementById("fCompany").value="";
    document.getElementById("fVisible").checked=true; document.getElementById("fForSale").checked=false;
    document.getElementById("priceRow").style.display="none"; clearFile();
  }

  function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

  function loadCards(){
    document.getElementById("listStatus").textContent="Loading…";
    fetch("/api/cards",{headers:{"x-vault-pass":adminPass}}).then(function(r){ return r.json(); }).then(function(cards){
      allCards=Array.isArray(cards)?cards:[];
      document.getElementById("listStatus").textContent=allCards.length+" card"+(allCards.length!==1?"s":"")+" in vault";
      renderList();
    }).catch(function(){ document.getElementById("listStatus").textContent="Could not load."; });
  }

  function renderList(){
    var el=document.getElementById("cardList");
    if(!allCards.length){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--dim)">No cards yet. Add your first card!</div>'; return; }
    el.innerHTML=allCards.map(function(c){
      var grade=c.grading_company&&c.grade?c.grading_company+" "+c.grade:(c.grade||"Raw");
      var meta=[c.year,c.card_set,grade].filter(Boolean).join(" · ");
      var imgEl=c.image_url
        ?'<img class="cr-img" src="'+esc(c.image_url)+'" alt=""/>'
        :'<div class="cr-img-ph"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
      return '<div class="card-row" data-id="'+esc(c.id)+'">'+imgEl
        +'<div class="cr-info"><div class="cr-name">'+esc(c.player||c.title||"Unknown")+'</div><div class="cr-meta">'+esc(meta)+'</div></div>'
        +'<div class="cr-acts">'
        +'<button class="act-btn vis'+(c.is_visible?" on":"")+'">'+( c.is_visible?"Visible":"Hidden")+'</button>'
        +'<button class="act-btn del">Delete</button>'
        +'</div></div>';
    }).join("");
    el.querySelectorAll(".card-row").forEach(function(row){
      var id=row.getAttribute("data-id");
      row.querySelector(".del").addEventListener("click",function(){
        if(!confirm("Delete this card?")) return;
        fetch("/api/cards/"+encodeURIComponent(id),{method:"DELETE",headers:{"x-vault-pass":adminPass}}).then(function(r){ if(r.ok) loadCards(); else alert("Delete failed."); });
      });
      row.querySelector(".vis").addEventListener("click",function(){
        var card=allCards.find(function(c){ return c.id===id; }); if(!card) return;
        fetch("/api/cards/"+encodeURIComponent(id),{method:"PUT",headers:{"Content-Type":"application/json","x-vault-pass":adminPass},body:JSON.stringify({is_visible:!card.is_visible})}).then(function(r){ if(r.ok) loadCards(); else alert("Update failed."); });
      });
    });
  }
})();
</script>
</body>
</html>`;
}
