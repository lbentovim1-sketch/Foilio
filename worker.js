// ============================================================
//  FOILIO  —  all-in-one Cloudflare Worker
//  Serves the site, relays The Card API (/api) and PSA (/cert),
//  and powers accounts, portfolios, profiles, follows, and
//  watchlists via Supabase.
//  Configure secrets and public app config as Worker bindings.
// ============================================================

const UPSTREAM = "https://thecardapi.com/api/v1/market/sales";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function envValue(env, key) {
  return env && typeof env[key] === "string" ? env[key].trim() : "";
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === "/api") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const q = url.searchParams.get("q") || "";
      const limit = url.searchParams.get("limit") || "20";
      const sort = url.searchParams.get("sort") || "date_desc";
      if (q.length < 4) {
        return jsonResponse({ error: "Query must be at least 4 characters." }, 400);
      }
      const apiKey = envValue(env, "THE_CARD_API_KEY");
      if (!apiKey) return jsonResponse({ error: "The Card API key is not configured." }, 500);
      const upstreamUrl = UPSTREAM + "?q=" + encodeURIComponent(q) +
        "&limit=" + encodeURIComponent(limit) + "&sort=" + encodeURIComponent(sort);
      try {
        const r = await fetch(upstreamUrl, { headers: { "x-market-api-key": apiKey } });
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
      } catch (err) {
        return jsonResponse({ error: "Could not reach the data source." }, 502);
      }
    }
    if (url.pathname === "/comps") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const q = url.searchParams.get("q") || "";
      if (q.length < 3) return jsonResponse({ data: [] }, 200);
      const key = envValue(env, "SOLDCOMPS_API_KEY");
      if (!key) return jsonResponse({ data: [], configured: false }, 200);
      try {
        const upstream = "https://api.sold-comps.com/v1/scrape?keyword=" + encodeURIComponent(q) +
          "&count=120&daysToScrape=180&sortOrder=endedRecently";
        const r = await fetch(upstream, { headers: { "Authorization": "Bearer " + key } });
        if (!r.ok) return jsonResponse({ data: [], error: "upstream_" + r.status }, 200);
        const j = await r.json();
        const items = (j.items || []).map(function (it) {
          const priceStr = (it.soldPrice != null) ? it.soldPrice : it.totalPrice;
          return {
            title: it.title || "",
            price: (priceStr != null && priceStr !== "") ? Number(priceStr) : null,
            sale_date: it.endedAt ? String(it.endedAt).slice(0, 10) : "",
            platform: "eBay",
            listing_url: it.url || "",
            thumbnail_url: it.thumbnailUrl || "",
            image_url: it.thumbnailUrl || "",
            price_confirmed: true,
            source: "soldcomps",
          };
        }).filter(function (x) { return typeof x.price === "number" && !isNaN(x.price) && x.price > 0; });
        return jsonResponse({ data: items, source: "soldcomps" }, 200);
      } catch (e) {
        return jsonResponse({ data: [], error: "relay_failed" }, 200);
      }
    }
    if (url.pathname === "/catalog") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const token = envValue(env, "PRICECHARTING_TOKEN");
      if (!token) return jsonResponse({ data: [], configured: false }, 200);
      const id = url.searchParams.get("id") || "";
      const q = url.searchParams.get("q") || "";
      try {
        if (id) {
          const r = await fetch("https://www.pricecharting.com/api/product?t=" + encodeURIComponent(token) + "&id=" + encodeURIComponent(id));
          const j = await r.json();
          return jsonResponse({ product: j }, 200);
        }
        if (q.length < 3) return jsonResponse({ data: [] }, 200);
        const r = await fetch("https://www.pricecharting.com/api/products?t=" + encodeURIComponent(token) + "&q=" + encodeURIComponent(q));
        const j = await r.json();
        const products = (j.products || []).slice(0, 12).map(function (p) {
          return { id: p.id, name: p["product-name"] || "", set: p["console-name"] || "" };
        });
        return jsonResponse({ data: products }, 200);
      } catch (e) {
        return jsonResponse({ data: [], error: "relay_failed" }, 200);
      }
    }
    if (url.pathname === "/cert") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const n = (url.searchParams.get("n") || "").replace(/[^0-9]/g, "");
      if (n.length < 5) {
        return jsonResponse({ error: "Invalid cert number." }, 400);
      }
      const psaToken = envValue(env, "PSA_TOKEN");
      if (!psaToken) return jsonResponse({ error: "PSA token is not configured." }, 500);
      try {
        const r = await fetch("https://api.psacard.com/publicapi/cert/GetByCertNumber/" + encodeURIComponent(n),
          { headers: { "Authorization": "bearer " + psaToken } });
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
      } catch (e) {
        return jsonResponse({ error: "Cert relay failed." }, 502);
      }
    }
    return new Response(renderPage(env), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};

function renderPage(env = {}) {
  const publicConfig = JSON.stringify({
    supabaseUrl: envValue(env, "SUPABASE_URL"),
    supabaseAnonKey: envValue(env, "SUPABASE_ANON_KEY") || envValue(env, "SUPABASE_PUBLISHABLE_KEY"),
    giphyApiKey: envValue(env, "GIPHY_API_KEY"),
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Foilio — By Collectors, For Collectors</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  :root{
    --ink:#0a0b12; --surface:#12131d; --surface2:#171926; --border:#232539; --borderB:#34374f;
    --text:#eef0f7; --muted:#8a8ea8; --dim:#565a73;
    --indigo:#6d5cff; --up:#2bd673; --down:#ff5d6c; --gold:#f5b544;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--ink);color:var(--text);font-family:'Manrope',system-ui,sans-serif;line-height:1.5}
  ::-webkit-scrollbar{width:7px;height:7px}
  ::-webkit-scrollbar-thumb{background:var(--borderB);border-radius:4px}
  a{color:var(--indigo)}
  .mono{font-family:'JetBrains Mono',monospace}
  #sidebar{width:220px;background:#0c0d17;border-right:1px solid var(--border);position:fixed;top:0;left:0;bottom:0;z-index:40;display:flex;flex-direction:column;overflow:hidden}
  #mainContent{margin-left:220px;min-height:100vh}
  #mobileTopBar{display:none;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--ink);position:sticky;top:0;z-index:39}
  .sidebar-logo{padding:22px 18px 16px;border-bottom:1px solid var(--border);cursor:pointer;flex-shrink:0}
  .sidebar-tagline{font-size:11px;color:var(--dim);margin-top:3px;display:block;font-family:'Manrope',sans-serif}
  .sidebar-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 0;scrollbar-width:none}
  .sidebar-nav::-webkit-scrollbar{display:none}
  .sidebar-divider{height:1px;background:var(--border);margin:8px 14px}
  .sidebar-footer{border-top:1px solid var(--border);padding:14px 12px;flex-shrink:0}
  .snav-item{display:flex;align-items:center;gap:11px;padding:9px 16px;border-radius:9px;margin:1px 8px;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600;font-family:'Manrope',sans-serif;border:none;background:none;width:calc(100% - 16px);text-align:left;transition:color .15s,background .15s;white-space:nowrap}
  .snav-item:hover{color:var(--text);background:rgba(255,255,255,.05)}
  .snav-item.on{color:var(--text);background:rgba(109,92,255,.18)}
  .snav-item.on .snav-icon{color:var(--indigo);opacity:1}
  .snav-icon{width:16px;height:16px;flex-shrink:0;opacity:.65;transition:opacity .15s}
  .snav-label{flex:1}
  .snav-badge{background:var(--down);color:#fff;border-radius:9px;font-size:10px;font-weight:800;padding:1px 6px;line-height:16px;min-width:16px;text-align:center;flex-shrink:0}
  .foil{background:linear-gradient(100deg,#a78bfa,#22d3ee 28%,#34d399 52%,#fbbf24 74%,#f472b6);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:foil 6s linear infinite}
  @keyframes foil{to{background-position:200% center}}
  @media (prefers-reduced-motion:reduce){.foil{animation:none}}
  .wrap{max-width:900px;margin:0 auto;padding:36px 28px 80px}
  h1{font-family:'Space Grotesk',sans-serif;font-size:36px;font-weight:700;letter-spacing:-1.2px;line-height:1.1}
  .sub{color:var(--muted);font-size:16px;margin-top:10px;max-width:560px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-top:18px}
  input,textarea{width:100%;background:var(--ink);border:1px solid var(--border);border-radius:10px;padding:14px 16px;color:var(--text);font-size:16px;outline:none;font-family:'Manrope',sans-serif}
  textarea{resize:vertical;min-height:80px}
  input:focus,textarea:focus{border-color:var(--indigo)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .chip{background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:6px 12px;font-size:12px;color:var(--muted);cursor:pointer}
  .chip:hover{border-color:var(--borderB);color:var(--text)}
  .btn{background:var(--indigo);color:#fff;border:none;border-radius:10px;padding:14px 22px;font-size:16px;font-weight:700;font-family:'Manrope',sans-serif;cursor:pointer;width:100%;margin-top:14px}
  .btn:disabled{opacity:.55;cursor:default}
  label{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1.5px;color:var(--muted);margin-bottom:10px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}
  .stat{background:var(--ink);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
  .stat .l{font-size:11px;color:var(--dim)}
  .stat .v{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;margin-top:3px}
  .stat.hl .v{color:var(--gold)}
  .sale{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--border)}
  .sale img{width:38px;height:53px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0}
  .sale .t{flex:1;min-width:0}
  .sale .t a{color:var(--text);font-size:13px;font-weight:600;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sale .t a:hover{color:var(--indigo)}
  .sale .meta{font-size:11px;color:var(--dim);margin-top:2px}
  .sale .p{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;text-align:right}
  .saleacts{display:flex;gap:6px;flex-shrink:0}
  .miniadd{background:var(--up);color:#04210f;border:none;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif;white-space:nowrap}
  .miniadd:disabled{opacity:.6}
  .miniwatch{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:7px 9px;font-size:13px;cursor:pointer}
  .miniwatch:hover{border-color:var(--gold);color:var(--gold)}
  .err{background:rgba(255,93,108,.1);border:1px solid var(--down);border-radius:10px;padding:14px 16px;color:#ffb4bc;font-size:13px;margin-top:14px}
  .err b{color:#fff}
  .insight{font-size:13px;color:var(--muted);margin-top:6px}
  .foot{max-width:900px;margin:0 auto;padding:24px 28px 50px;color:var(--dim);font-size:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .authbtn{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif}
  .authbtn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff}
  .who{font-size:13px;color:var(--muted);cursor:pointer} .who b{color:var(--text)}
  .tabs{display:flex;gap:4px;margin-bottom:12px;background:var(--ink);border:1px solid var(--border);border-radius:8px;padding:3px}
  .tab{flex:1;background:transparent;border:none;color:var(--muted);border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .tab.on{background:var(--indigo);color:#fff}
  .authmodal-box{background:var(--surface);border:1px solid var(--borderB);border-radius:16px;padding:28px;max-width:380px;width:100%}
  .addbtn{background:var(--up);color:#04210f;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif;margin-top:12px;width:100%}
  .addbtn:disabled{opacity:.7}
  .hrow{display:flex;align-items:center;gap:12px;padding:13px 4px;border-bottom:1px solid var(--border)}
  .hrow .rm{background:none;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;flex-shrink:0}
  .hrow .rm:hover{border-color:var(--down);color:var(--down)}
  .hrow .ed{background:none;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;flex-shrink:0}
  .hrow .ed:hover{border-color:var(--indigo);color:var(--indigo)}
  .vision{margin-top:26px;display:grid;grid-template-columns:1.1fr .9fr;gap:18px;align-items:stretch}
  .vision h2{font-family:'Space Grotesk',sans-serif;font-size:25px;letter-spacing:-.6px;line-height:1.15}
  .pillars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
  .pillar{background:var(--ink);border:1px solid var(--border);border-radius:12px;padding:14px}
  .pillar b{display:block;font-size:13px;margin-bottom:4px}
  .pillar span{display:block;font-size:12px;color:var(--muted);line-height:1.45}
  .network-card{background:linear-gradient(145deg,rgba(109,92,255,.22),rgba(245,181,68,.08));border:1px solid var(--borderB);border-radius:14px;padding:18px}
  .activity{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  .activity:last-child{border-bottom:none}
  .avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6d5cff,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;overflow:hidden;color:#fff}
  .avatar img{width:100%;height:100%;object-fit:cover}
  .activity .copy{font-size:13px;color:var(--text)}
  .activity .copy span{display:block;font-size:11px;color:var(--muted);margin-top:2px}
  .activity .copy b{cursor:pointer}
  .handle-preview{font-family:'JetBrains Mono',monospace;color:var(--gold);font-size:12px;margin-top:7px}
  .tape{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:14px}
  .tapecard{background:var(--ink);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer}
  .tapecard:hover{border-color:var(--borderB)}
  .tapecard .nm{font-size:13px;font-weight:700;min-height:34px}
  .tapecard .pr{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;margin-top:8px}
  .tapecard .mt{font-size:11px;color:var(--dim);margin-top:4px}
  .profhead{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  .bigav{width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#6d5cff,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:30px;flex-shrink:0;overflow:hidden;color:#fff}
  .bigav img{width:100%;height:100%;object-fit:cover}
  .followbtn{background:var(--indigo);color:#fff;border:none;border-radius:9px;padding:9px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .followbtn.following{background:var(--surface2);border:1px solid var(--border);color:var(--text)}
  .pstats{display:flex;gap:22px;margin-top:8px}
  .pstats div{font-size:13px;color:var(--muted)} .pstats b{color:var(--text);font-size:16px;display:block}
  .sociallinks{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
  .sociallinks a{font-size:12px;color:var(--indigo);text-decoration:none;border:1px solid var(--border);border-radius:7px;padding:4px 10px}
  .field{margin-bottom:14px}
  .field label{margin-bottom:6px}
  .switch{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--text)}
  .modalbox{background:var(--surface);border:1px solid var(--borderB);border-radius:16px;padding:24px;max-width:420px;width:100%}
  .navbadge{display:inline-block;min-width:16px;padding:0 5px;margin-left:5px;background:var(--down);color:#fff;border-radius:9px;font-size:10px;font-weight:800;line-height:16px;text-align:center;vertical-align:1px}
  .badge{display:inline-block;font-size:9px;font-weight:800;border-radius:4px;padding:1px 5px;vertical-align:1px;margin-left:5px}
  .badge.sale{color:var(--up);border:1px solid var(--up)}
  .badge.trade{color:var(--gold);border:1px solid var(--gold)}
  .mkt{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:14px}
  .mktcard{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;flex-direction:column}
  .mktcard img{width:100%;height:170px;object-fit:contain;border-radius:8px;background:var(--ink);margin-bottom:10px}
  .mktcard .nm{font-size:13px;font-weight:700;line-height:1.3;min-height:34px}
  .mktcard .seller{font-size:11px;color:var(--indigo);cursor:pointer;margin-top:4px}
  .mktcard .ask{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;margin-top:8px}
  .mktcard .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .mktcard .acts button{flex:1;min-width:80px;font-size:12px;padding:8px 6px;border-radius:8px;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;border:1px solid var(--border);background:var(--surface2);color:var(--text)}
  .mktcard .acts button.buy{background:var(--up);color:#04210f;border-color:var(--up)}
  .mktcard .acts button.offer{background:var(--indigo);color:#fff;border-color:var(--indigo)}
  .lbtabs,.msgtabs{display:flex;gap:6px;margin:14px 0}
  .lbtabs button,.msgtabs button{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .lbtabs button.on,.msgtabs button.on{background:var(--indigo);border-color:var(--indigo);color:#fff}
  .lbrow{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--border)}
  .lbrow .rank{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--dim);width:26px;text-align:center;flex-shrink:0}
  .lbrow .nm{flex:1;min-width:0;font-size:14px;font-weight:600;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .lbrow .val{font-family:'JetBrains Mono',monospace;font-weight:700}
  .convo{display:flex;align-items:center;gap:12px;padding:12px 6px;border-bottom:1px solid var(--border);cursor:pointer}
  .convo:hover{background:var(--surface2)}
  .convo .cmeta{flex:1;min-width:0}
  .convo .cmeta .cn{font-size:14px;font-weight:700}
  .convo .cmeta .cp{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .convo .dot{width:9px;height:9px;border-radius:50%;background:var(--indigo);flex-shrink:0}
  .thread{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto;padding:6px 2px;margin-top:12px}
  .bubble{max-width:80%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word}
  .bubble.me{align-self:flex-end;background:var(--indigo);color:#fff;border-bottom-right-radius:4px}
  .bubble.them{align-self:flex-start;background:var(--surface2);border:1px solid var(--border);border-bottom-left-radius:4px}
  .bubble .bt{font-size:10px;opacity:.7;margin-top:4px}
  .offercard{align-self:stretch;background:var(--ink);border:1px solid var(--borderB);border-radius:12px;padding:12px;font-size:13px}
  .offercard .oa{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:700}
  .offercard .obtns{display:flex;gap:8px;margin-top:10px}
  .composer{display:flex;gap:8px;margin-top:12px}
  .composer input{flex:1}
  .gifbtn{background:var(--surface2);border:1px solid var(--border);color:var(--gold);border-radius:8px;padding:0 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif}
  .bubble img,.cmt img{max-width:200px;border-radius:8px;display:block;margin-top:4px}
  .likebtn{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:9px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .likebtn.on{background:rgba(255,93,108,.14);border-color:var(--down);color:var(--down)}
  .cgallery{display:flex;gap:8px;flex-wrap:wrap}
  .cgallery img{height:230px;border-radius:10px;background:var(--ink);object-fit:contain}
  .cmt{display:flex;gap:10px;padding:11px 2px;border-bottom:1px solid var(--border)}
  .cmt .cbody{flex:1;min-width:0}
  .cmt .cbody .cn{font-size:13px;font-weight:700;cursor:pointer}
  .cmt .cbody .ct{font-size:14px;margin-top:2px;word-wrap:break-word}
  .gifres{width:100%;border-radius:8px;cursor:pointer;background:var(--ink)}
  .notif{display:flex;gap:11px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer}
  .notif.unread{background:var(--surface2)}
  .notif .nt{flex:1;min-width:0;font-size:14px} .notif .nt span{display:block;font-size:11px;color:var(--dim);margin-top:2px}
  .cmt .rm{background:none;border:none;cursor:pointer;font-size:17px;line-height:1;padding:3px 7px;border-radius:7px;opacity:0;transition:opacity .15s,background .15s;color:var(--muted);flex-shrink:0;align-self:flex-start;margin-top:2px}
  .cmt:hover .rm,.cmt .rm:focus{opacity:1}
  .cmt .rm:hover{color:var(--down);background:rgba(255,93,108,.12)}
  .discgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:14px}
  .usercard{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;align-items:center;gap:14px;transition:border-color .15s}
  .usercard:hover{border-color:var(--borderB)}
  .ucinfo{flex:1;min-width:0}
  .ucname{font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .uchandle{font-size:12px;color:var(--gold);font-family:'JetBrains Mono',monospace;margin-top:1px}
  .ucmeta{font-size:12px;color:var(--muted);margin-top:3px}
  .followlist{max-height:50vh;overflow-y:auto;margin-top:12px}
  .followitem{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--border);cursor:pointer}
  .followitem:last-child{border-bottom:none}
  .followitem:hover .finame{color:var(--indigo)}
  .finame{font-size:14px;font-weight:700;transition:color .15s}
  .fihandle{font-size:12px;color:var(--muted)}
  .lbsearch{display:flex;gap:8px;margin-bottom:14px}
  .lbsearch input{flex:1;padding:10px 14px;font-size:14px}
  .pstat-btn{background:none;border:none;cursor:pointer;font-family:'Manrope',sans-serif;color:inherit;padding:0;text-align:left}
  .pstat-btn:hover b{color:var(--indigo)}
  .following-style{background:var(--surface2)!important;border:1px solid var(--border)!important;color:var(--text)!important}
  @media (max-width:768px){#sidebar{width:100%;height:58px;min-height:auto;position:fixed;bottom:0;top:auto;left:0;right:0;border-right:none;border-top:1px solid var(--border);flex-direction:row;overflow-x:auto;overflow-y:hidden;align-items:stretch}#sidebar::-webkit-scrollbar{display:none}#mainContent{margin-left:0;padding-bottom:62px}#mobileTopBar{display:flex}.sidebar-logo,.sidebar-divider,.sidebar-footer{display:none}#navArea{display:flex;flex-direction:row;width:100%;overflow-x:auto}.sidebar-nav{display:flex;flex-direction:row;padding:0;overflow-x:auto;scrollbar-width:none}.snav-item{flex-direction:column;padding:6px 8px;gap:2px;font-size:9px;font-weight:700;margin:0;border-radius:0;width:auto;flex:1;min-width:52px;justify-content:center;align-items:center}.snav-icon{width:20px;height:20px}.vision{grid-template-columns:1fr}.pillars{grid-template-columns:1fr}.mkt{grid-template-columns:1fr 1fr}.discgrid{grid-template-columns:1fr}.wrap{padding:20px 16px 28px}.home-dash{grid-template-columns:1fr!important}.showcase-grid{grid-template-columns:repeat(2,1fr)!important}}
  /* Market Pulse widget */
  .pulse-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;border-radius:6px;padding-left:4px}
  .pulse-item:last-child{border-bottom:none}
  .pulse-item:hover{background:rgba(255,255,255,.03)}
  .pulse-label{flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pulse-price{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;flex-shrink:0;color:var(--gold)}
  .pulse-sales{font-size:10px;color:var(--dim);text-align:right}
  /* Top Collectors home widget */
  .tc-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:opacity .12s}
  .tc-row:last-child{border-bottom:none}
  .tc-row:hover{opacity:.8}
  .tc-rank{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--dim);width:20px;text-align:center;flex-shrink:0;font-weight:700}
  .tc-name{font-size:13px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tc-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--text)}
  /* Home dashboard 2-col grid */
  .home-dash{display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px;margin-top:20px;align-items:start}
  /* Portfolio showcase grid */
  .showcase-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:14px}
  .showcase-card{background:var(--ink);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
  .showcase-card:hover{border-color:var(--borderB);transform:translateY(-2px)}
  .showcase-card img{width:100%;height:110px;object-fit:contain;background:var(--surface2)}
  .showcase-card .sc-info{padding:8px 8px 10px}
  .showcase-card .sc-name{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px;line-height:1.2}
  .showcase-card .sc-grade{font-size:10px;color:var(--dim);margin-bottom:2px}
  .showcase-card .sc-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--gold)}
  /* Leaderboard enhancements */
  .lbrow .medal{font-size:16px;line-height:1;flex-shrink:0;width:26px;text-align:center}
  .lbrow-cards{display:flex;gap:5px;margin-top:8px;overflow-x:auto;padding-bottom:2px}
  .lbrow-cards img{width:38px;height:53px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0}
  .lbrow-wrap{flex:1;min-width:0}
  .lbrow .rank-num{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--dim);width:26px;text-align:center;flex-shrink:0}
  .lb-subject-row{flex-direction:column;align-items:flex-start;gap:6px}
  .lb-subject-row .lb-top{display:flex;align-items:center;gap:12px;width:100%}
  /* View toggle for portfolio */
  .view-toggle{display:flex;gap:6px;margin-bottom:0}
  .view-toggle button{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .view-toggle button.on{background:var(--indigo);border-color:var(--indigo);color:#fff}
  /* Leaderboard subject enhanced card */
  .lbcard-mini{display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:nowrap}
  .lbcard-mini img{width:32px;height:45px;object-fit:cover;border-radius:3px;background:var(--surface2);flex-shrink:0}
  /* Wl skeleton */
  .wl-loading .mono{color:var(--dim);font-size:13px}
</style>
</head>
<body>
<div id="sidebar">
  <div class="sidebar-logo" id="logo">
    <span class="foil" style="font-family:'Space Grotesk',sans-serif;font-size:21px;font-weight:700;display:block">Foilio</span>
    <span class="sidebar-tagline">by collectors, for collectors</span>
  </div>
  <div id="navArea"></div>
  <div class="sidebar-footer" id="authArea"></div>
</div>

<div id="mobileTopBar">
  <span class="foil" id="mobileLogo" style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;cursor:pointer">Foilio</span>
</div>

<div id="authModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;align-items:center;justify-content:center;padding:20px">
  <div class="authmodal-box">
    <div class="tabs" style="margin-bottom:18px"><button class="tab on" id="tabLogin">Log in</button><button class="tab" id="tabSignup">Sign up</button></div>
    <input id="authEmail" type="email" placeholder="Email" autocomplete="email" style="margin-bottom:10px"/>
    <div id="authHandleWrap" style="display:none;margin-bottom:10px"><input id="authHandle" type="text" placeholder="@handle (3–20 letters / numbers)" autocomplete="username" maxlength="21"/></div>
    <input id="authPass" type="password" placeholder="Password (6+ chars)" autocomplete="current-password" style="margin-bottom:12px"/>
    <button class="btn" id="authAction" style="margin-top:0">Log in</button>
    <div class="msg" id="authMsg" style="margin-top:10px;font-size:13px;line-height:1.4"></div>
    <button id="authModalClose" style="background:none;border:none;color:var(--muted);font-size:12px;margin-top:16px;cursor:pointer;display:block;text-align:center;width:100%">Cancel</button>
  </div>
</div>

<div id="mainContent">
<div id="searchView"><div class="wrap">
  <h1 style="font-size:44px;letter-spacing:-2px">What's it <span class="foil">actually</span> worth?</h1>
  <p class="sub" style="font-size:17px;margin-top:12px">The platform built <b style="color:var(--text)">by collectors, for collectors</b> — real sold prices, real community, real collections.</p>
  <div class="card" style="margin-top:22px">
    <input id="q" placeholder='e.g. "PSA 10 Jalen Brunson Prizm"' value="PSA 10 Jalen Brunson Prizm" style="font-size:17px;padding:16px 18px"/>
    <div class="chips" id="chips"></div>
    <button class="btn" id="go" style="margin-top:12px">Check price</button>
  </div>
  <div class="home-dash">
    <div>
      <div class="network-card" style="margin-top:0">
        <label>COLLECTOR ACTIVITY</label>
        <div id="homeFeed"><div class="insight">Loading recent collector activity…</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <label style="margin-bottom:0">MARKET PULSE</label>
          <span style="font-size:10px;color:var(--dim)">live medians</span>
        </div>
        <div id="marketPulse"><div class="insight">Loading live prices…</div></div>
      </div>
    </div>
    <div>
      <div class="card" style="margin-top:0">
        <label>THE FOILIO NETWORK</label>
        <div class="pillars" style="margin-top:8px">
          <div class="pillar"><b>Live prices</b><span>Median from confirmed recent sales.</span></div>
          <div class="pillar"><b>Portfolios</b><span>Track and show off your collection.</span></div>
          <div class="pillar"><b>Buy &amp; sell</b><span>Marketplace with offers and trades.</span></div>
          <div class="pillar"><b>Leaderboards</b><span>Climb the ranks. Show your biggest PC.</span></div>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <label style="margin-bottom:0">TOP COLLECTORS</label>
          <span id="lbLink" style="font-size:11px;color:var(--indigo);cursor:pointer">See all →</span>
        </div>
        <div id="homeTopCollectors"><div class="insight">Loading…</div></div>
      </div>
    </div>
  </div>
  <div id="out"></div>
</div></div>

<div id="trendingView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Live Market Tape</h1>
  <p class="sub">Right-now median prices on the cards collectors are watching, plus the latest cards added across Foilio.</p>
  <div id="tapeWrap"></div>
  <div id="feedWrap"></div>
</div></div>

<div id="portfolioView" style="display:none"><div class="wrap">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div>
      <h1 style="font-size:28px">My Portfolio</h1>
      <p class="sub">Your collection, valued from recent sales. Toggle <b>≡ List</b> for full details and edit controls.</p>
    </div>
    <div class="view-toggle" id="pfViewToggle">
      <button id="pfListViewBtn">≡ List</button>
      <button id="pfGridViewBtn" class="on">⊞ Showcase</button>
    </div>
  </div>
  <div class="card">
    <label>ADD A CARD BY PSA CERT</label>
    <div style="display:flex;gap:8px">
      <input id="certNum" placeholder="PSA cert number (digits only)" style="flex:1"/>
      <button class="authbtn primary" id="certLookupBtn" style="white-space:nowrap">Look up</button>
    </div>
    <div id="certOut"></div>
  </div>
  <div class="card">
    <label>ADD ANY CARD MANUALLY</label>
    <div class="insight" style="margin-bottom:10px">Ungraded/raw cards, or cards graded by PSA, Beckett (BGS), SGC, CGC, TAG, or others.</div>
    <button class="authbtn primary" id="manualAddBtn">+ Add a card manually</button>
  </div>
  <div id="pfShowcase"></div>
  <div id="pfSummary"></div>
  <div id="pfList" style="display:none"></div>
</div></div>

<div id="watchlistView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Watchlist &amp; Alerts</h1>
  <p class="sub">Track cards you don't own yet. Set a target price and Foilio flags the card when the live median crosses it.</p>
  <div id="watchList"></div>
</div></div>

<div id="profileView" style="display:none"><div class="wrap">
  <div id="profileBody"></div>
</div></div>

<div id="editProfileView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Edit Profile</h1>
  <p class="sub">This is your public collector page. Choose how the community sees you.</p>
  <div class="card" id="editForm"></div>
</div></div>

<div id="marketView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Marketplace</h1>
  <p class="sub">Cards collectors have listed for sale or trade. Buy now, make an offer, or message the seller to work out a deal.</p>
  <div class="msgtabs" id="mktTabs">
    <button data-mkt="all" class="on">All</button>
    <button data-mkt="sale">For sale</button>
    <button data-mkt="trade">For trade</button>
  </div>
  <div id="mktWrap"></div>
</div></div>

<div id="leaderboardView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Leaderboards</h1>
  <p class="sub">Who's got the biggest collection? The rarest PC? The most followers? Find out — and show off yours.</p>
  <div class="lbtabs" id="lbTabs" style="flex-wrap:wrap">
    <button data-lb="value" class="on">💰 Portfolio Value</button>
    <button data-lb="followers">👥 Followers</button>
    <button data-lb="cards">📦 Most Cards</button>
    <button data-lb="subject">🔍 By Player / Character</button>
  </div>
  <div class="lbsearch" id="lbSearchWrap" style="display:none">
    <input id="lbSubjectInput" placeholder='e.g. "Michael Jordan" or "Charizard" or "Ohtani"'/>
    <button class="authbtn primary" id="lbSubjectGo">Find Top Collectors</button>
  </div>
  <div id="lbSubjectHint" style="display:none;font-size:12px;color:var(--muted);margin-bottom:10px">Shows who owns the most cards matching that player or character — great for finding the biggest PC holders.</div>
  <div id="lbWrap"></div>
</div></div>

<div id="discoverView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Discover Collectors</h1>
  <p class="sub">Find collectors, see their public portfolios, and follow the ones whose taste you respect.</p>
  <div class="card" style="margin-bottom:0">
    <label>SEARCH COLLECTORS</label>
    <div style="display:flex;gap:8px">
      <input id="discoverSearch" placeholder="Search by name or @handle" style="flex:1"/>
      <button class="authbtn primary" id="discoverGo">Search</button>
    </div>
  </div>
  <div id="discoverWrap"></div>
</div></div>

<div id="messagesView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Messages</h1>
  <p class="sub" id="msgSub">Your conversations with other collectors.</p>
  <div id="msgWrap"></div>
</div></div>

<div id="cardView" style="display:none"><div class="wrap">
  <div id="cardBody"></div>
</div></div>

<div id="notifView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">Notifications</h1>
  <div id="notifWrap"></div>
</div></div>

<div id="modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox">
    <div id="modalTitle" style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3"></div>
    <div style="font-size:12px;color:var(--dim);margin-bottom:16px">Set your own value for this card. It overrides the live market price.</div>
    <input id="modalInput" type="text" inputmode="decimal" placeholder="e.g. 700"/>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="authbtn primary" id="modalSave" style="flex:1">Save value</button>
      <button class="authbtn" id="modalCancel">Cancel</button>
    </div>
    <button id="modalClear" style="background:none;border:none;color:var(--muted);font-size:12px;margin-top:14px;cursor:pointer;text-decoration:underline;display:block">Clear manual value and use live price</button>
  </div>
</div>

<div id="watchModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox">
    <div id="watchTitle" style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3"></div>
    <div style="font-size:12px;color:var(--dim);margin-bottom:16px">Add this card to your watchlist. A target price is optional.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <select id="watchDir" style="background:var(--ink);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:0 10px;font-size:14px;font-family:'Manrope',sans-serif">
        <option value="above">Alert when above</option>
        <option value="below">Alert when below</option>
      </select>
      <input id="watchTarget" type="text" inputmode="decimal" placeholder="target $ (optional)" style="flex:1"/>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="authbtn primary" id="watchSave" style="flex:1">Add to watchlist</button>
      <button class="authbtn" id="watchCancel">Cancel</button>
    </div>
  </div>
</div>

<div id="sellModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox">
    <div id="sellTitle" style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3"></div>
    <div style="font-size:12px;color:var(--dim);margin-bottom:16px">List this card on the marketplace. Listing it makes the card public.</div>
    <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="sellFor" style="width:auto"/> For sale</label>
    <input id="sellPrice" type="text" inputmode="decimal" placeholder="Asking / buy-now price (optional)" style="margin-bottom:12px"/>
    <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="sellOffers" checked style="width:auto"/> Accept offers</label>
    <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="sellTrade" style="width:auto"/> Open to trades</label>
    <input id="sellNote" type="text" placeholder="Note for buyers (optional)" style="margin-bottom:4px"/>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="authbtn primary" id="sellSave" style="flex:1">Save listing</button>
      <button class="authbtn" id="sellCancel">Cancel</button>
    </div>
    <button id="sellRemove" style="background:none;border:none;color:var(--muted);font-size:12px;margin-top:14px;cursor:pointer;text-decoration:underline;display:block">Remove from marketplace</button>
  </div>
</div>

<div id="offerModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox">
    <div id="offerTitle" style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3"></div>
    <div id="offerSub" style="font-size:12px;color:var(--dim);margin-bottom:16px"></div>
    <input id="offerAmount" type="text" inputmode="decimal" placeholder="Your offer ($)" style="margin-bottom:10px"/>
    <input id="offerNote" type="text" placeholder="Add a message (optional)" style="margin-bottom:4px"/>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="authbtn primary" id="offerSend" style="flex:1">Send</button>
      <button class="authbtn" id="offerCancel">Cancel</button>
    </div>
  </div>
</div>

<div id="manualModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px">Add a card manually</div>
    <div style="font-size:12px;color:var(--dim);margin-bottom:16px">For raw cards or any grading company. We'll try to estimate a market value, but your own value always wins.</div>
    <div class="field" style="position:relative"><label>CARD</label><input id="mTitle" placeholder="e.g. 2024 Bowman Chrome Caitlin Clark #1" autocomplete="off"/><div id="mSuggest" style="position:absolute;left:0;right:0;top:100%;z-index:5;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-top:4px;max-height:220px;overflow-y:auto;display:none"></div></div>
    <div class="field"><label>GRADING</label>
      <select id="mGrader" style="width:100%;background:var(--ink);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:13px 12px;font-size:15px;font-family:'Manrope',sans-serif">
        <option value="Raw">Raw / Ungraded</option>
        <option value="PSA">PSA</option>
        <option value="BGS">Beckett (BGS)</option>
        <option value="SGC">SGC</option>
        <option value="CGC">CGC</option>
        <option value="TAG">TAG</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="field" id="mGradeWrap"><label>GRADE</label><input id="mGrade" placeholder="e.g. 9.5, 10, GEM MT 10"/></div>
    <div class="field"><label>YOUR VALUE ($, OPTIONAL)</label><input id="mValue" type="text" inputmode="decimal" placeholder="e.g. 250"/></div>
    <div class="field"><label>PHOTO (OPTIONAL)</label><input type="file" id="mPhoto" accept="image/*" style="font-size:13px;padding:9px"/></div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="authbtn primary" id="manualSave" style="flex:1">Add to portfolio</button>
      <button class="authbtn" id="manualCancel">Cancel</button>
    </div>
    <div class="msg insight" id="manualMsg" style="margin-top:8px"></div>
  </div>
</div>

<div id="followListModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox" style="max-width:400px;width:100%">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div id="followListTitle" style="font-size:15px;font-weight:700"></div>
      <button class="authbtn" id="followListClose">Close</button>
    </div>
    <div class="followlist" id="followListBody"></div>
  </div>
</div>

<div id="gifModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:110;align-items:center;justify-content:center;padding:20px">
  <div class="modalbox" style="max-width:520px">
    <div style="font-size:15px;font-weight:700;margin-bottom:10px">Pick a GIF</div>
    <input id="gifSearch" placeholder="Search GIFs (or paste a GIF/image URL)"/>
    <div id="gifResults" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px;max-height:46vh;overflow-y:auto"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="authbtn primary" id="gifUseUrl" style="flex:1">Use pasted URL</button>
      <button class="authbtn" id="gifCancel">Cancel</button>
    </div>
  </div>
</div>

<div class="foot">
  <span class="foil" style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px">Foilio</span>
  <span>Built by collectors, for collectors · real prices, real community</span>
</div>
</div><!-- /#mainContent -->

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  // ---------- CONFIG ----------
  const FOILIO_CONFIG=${publicConfig};
  const SB_URL=FOILIO_CONFIG.supabaseUrl||"";
  const SB_KEY=FOILIO_CONFIG.supabaseAnonKey||"";
  const GIPHY_KEY=FOILIO_CONFIG.giphyApiKey||"";
  let sb=null;
  try{ if(window.supabase && SB_URL && SB_KEY){ sb=window.supabase.createClient(SB_URL,SB_KEY); } }catch(e){}

  // ---------- STATE ----------
  let currentSession=null;
  let myProfile=null;
  let panelOpen=false;
  let authMode="login";
  let view="search";
  let lastResult=null;
  let lastSales=[];
  let certResult=null;
  let editingId=null;
  let pendingWatch=null;
  let pendingSell=null;
  let pendingOffer=null;
  let mktFilter="all";
  let lbTab="value";
  let activeConvo=null;
  let unreadCount=0;
  let msgChannel=null;
  let notifCount=0;
  let notifChannel=null;
  let activeCard=null;
  let gifTarget=null;

  // ---------- HELPERS ----------
  const money=function(n){return "$"+Math.round(n||0).toLocaleString();};
  function withTimeout(promise,ms,label){
    return Promise.race([promise, new Promise(function(_,rej){ setTimeout(function(){ rej(new Error((label||"This")+" took too long. Check your connection and try again.")); }, ms||25000); })]);
  }
  function median(a){if(!a.length)return 0;const s=a.slice().sort(function(x,y){return x-y;});const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
  function summarize(sales){
    const conf=sales.filter(function(s){return s.price_confirmed!==false;});
    const basis=conf.length?conf:sales;
    const prices=basis.map(function(s){return s.price;}).filter(function(p){return typeof p==="number";});
    if(!prices.length) return {median:0,n:0,top:(sales[0]||null)};
    return {median:median(prices),n:(conf.length||sales.length),top:(basis[0]||sales[0])};
  }
  function escapeHtml(t){ return (t==null?"":(""+t)).replace(/[&<>"]/g,function(ch){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[ch]; }); }
  function escapeAttr(t){ return escapeHtml(t).replace(/'/g,"&#39;"); }
  function normalizeHandle(t){
    const h=(t||"").toLowerCase().replace(/^@+/,"").replace(/[^a-z0-9_]/g,"");
    return /^[a-z0-9_]{3,20}$/.test(h)?h:"";
  }
  function initials(name){ var s=(name||"?").replace(/^@/,"").trim(); return (s.slice(0,2)||"?").toUpperCase(); }
  function avatarHtml(p,cls){
    cls=cls||"avatar";
    if(p&&p.avatar_url){ return '<div class="'+cls+'"><img src="'+escapeAttr(p.avatar_url)+'" alt="" onerror="this.remove()"/></div>'; }
    return '<div class="'+cls+'">'+escapeHtml(initials(p&&(p.display_name||p.handle)))+'</div>';
  }
  // ---------- PRICE CACHE (session-scoped, 10-minute TTL) ----------
  var _priceCache={};
  var _CACHE_TTL=10*60*1000;
  function _cachedMedian(query){ var c=_priceCache[query]; return (c && Date.now()-c.ts<_CACHE_TTL)?c.data:null; }
  function _setCachedMedian(query,data){ _priceCache[query]={ts:Date.now(),data:data}; }

  async function valueHolding(h){
    const manual=(h.manual_value!=null && h.manual_value!=="")?Number(h.manual_value):null;
    if(manual!=null && !isNaN(manual)){ return {current:manual, manual:true}; }
    const cached=_cachedMedian(h.query);
    if(cached) return {current:cached.median, manual:false};
    try{
      const res=await fetch("/api?q="+encodeURIComponent(h.query)+"&limit=20&sort=date_desc");
      const j=await res.json();
      const sm=summarize(j.data||[]);
      _setCachedMedian(h.query,sm);
      return {current:sm.median, manual:false};
    }catch(e){ return {current:0, manual:false}; }
  }
  async function liveMedian(query){
    const cached=_cachedMedian(query);
    if(cached) return cached;
    try{
      const res=await fetch("/api?q="+encodeURIComponent(query)+"&limit=20&sort=date_desc");
      const j=await res.json();
      const result=summarize(j.data||[]);
      _setCachedMedian(query,result);
      return result;
    }catch(e){ return {median:0,n:0,top:null}; }
  }
  // For cards with no stock image, fall back to an owner-uploaded photo as the thumbnail.
  async function fillThumbs(holds){
    try{
      const need=holds.filter(function(h){return !h.image_url;}).map(function(h){return h.id;});
      if(!need.length) return holds;
      const pr=await sb.from("card_photos").select("holding_id,url").in("holding_id",need).order("created_at",{ascending:true});
      const byH={}; (pr.data||[]).forEach(function(x){ if(!byH[x.holding_id]) byH[x.holding_id]=x.url; });
      holds.forEach(function(h){ if(!h.image_url && byH[h.id]) h._thumb=byH[h.id]; });
    }catch(e){}
    return holds;
  }
  function thumbOf(h){ return h.image_url||h._thumb||""; }
  async function fetchComps(query){
    try{ const r=await fetch("/comps?q="+encodeURIComponent(query)); const j=await r.json(); return j.data||[]; }catch(e){ return []; }
  }
  function catalogPriceForGrade(prod,grade){
    function v(k){ var x=prod[k]; if(x==null) return null; var n=Number(x); return isNaN(n)?null:n; }
    const g=(grade||"").toLowerCase();
    let cents=null;
    if(/psa\\s*10/.test(g)) cents=v("manual-only-price");
    else if(/bgs\\s*10/.test(g)) cents=v("bgs-10-price");
    else if(/cgc\\s*10/.test(g)) cents=v("condition-17-price");
    else if(/sgc\\s*10/.test(g)) cents=v("condition-18-price");
    else if(/9\\.5/.test(g)) cents=v("box-only-price");
    else if(/(^|[^0-9])9([^0-9.]|$)/.test(g)) cents=v("graded-price");
    else if(/(^|[^0-9])8(\\.5)?([^0-9]|$)/.test(g)) cents=v("new-price");
    else if(/(^|[^0-9])7(\\.5)?([^0-9]|$)/.test(g)) cents=v("cib-price");
    else if(/raw|ungraded/.test(g)) cents=v("loose-price");
    if(cents==null) cents=v("graded-price")||v("loose-price");
    return cents!=null?(cents/100):null;
  }
  async function fetchCatalogValue(h){
    try{
      const r=await fetch("/catalog?q="+encodeURIComponent(h.title||h.query)); const j=await r.json();
      const first=(j.data||[])[0]; if(!first) return null;
      const pr=await fetch("/catalog?id="+encodeURIComponent(first.id)); const pj=await pr.json();
      const prod=pj.product; if(!prod||prod.status!=="success") return {value:null,name:first.name,set:first.set};
      return { value:catalogPriceForGrade(prod,h.grade), name:prod["product-name"]||first.name, set:prod["console-name"]||first.set };
    }catch(e){ return null; }
  }

  function findImages(obj){
    var urls=[]; var seen={};
    function walk(v){
      if(v==null) return;
      if(typeof v==="string"){
        if(/^https?:[/][/]/i.test(v) && /([.]jpg|[.]jpeg|[.]png|[.]webp|image|img|i[.]psacard|collectors)/i.test(v) && !/logo|sprite|icon|placeholder/i.test(v) && !seen[v]){ seen[v]=1; urls.push(v); }
      } else if(Array.isArray(v)){ v.forEach(walk); }
      else if(typeof v==="object"){ for(var k in v){ walk(v[k]); } }
    }
    walk(obj);
    return urls;
  }

  // ---------- PROFILE BOOTSTRAP ----------
  async function ensureMyProfile(){
    if(!sb || !currentSession){ myProfile=null; return; }
    try{
      const r=await sb.from("profiles").select("*").eq("id",currentSession.user.id).maybeSingle();
      if(r.data){ myProfile=r.data; return; }
      const meta=currentSession.user.user_metadata||{};
      let handle=normalizeHandle(meta.handle);
      if(!handle){ handle="user_"+currentSession.user.id.replace(/-/g,"").slice(0,8); }
      const ins=await sb.from("profiles").insert({ id:currentSession.user.id, handle:handle }).select("*").maybeSingle();
      if(ins.data){ myProfile=ins.data; }
      else { const r2=await sb.from("profiles").select("*").eq("id",currentSession.user.id).maybeSingle(); myProfile=r2.data||null; }
    }catch(e){ myProfile=null; }
  }

  // ---------- AUTH UI ----------
  const authArea=document.getElementById("authArea");
  const navArea=document.getElementById("navArea");
  function openAuthModal(mode){
    authMode=mode||"login";
    const modal=document.getElementById("authModal");
    const hw=document.getElementById("authHandleWrap");
    const btn=document.getElementById("authAction");
    const tl=document.getElementById("tabLogin"); const ts=document.getElementById("tabSignup");
    tl.classList.toggle("on",authMode==="login"); ts.classList.toggle("on",authMode==="signup");
    hw.style.display=authMode==="signup"?"":"none";
    btn.textContent=authMode==="login"?"Log in":"Create account";
    document.getElementById("authMsg").textContent="";
    ["authEmail","authPass","authHandle"].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=""; });
    modal.style.display="flex";
    setTimeout(function(){ var el=document.getElementById("authEmail"); if(el) el.focus(); },40);
  }
  function renderAuth(){
    if(!sb){ authArea.innerHTML='<div style="font-size:12px;color:var(--dim)">accounts setup pending</div>'; return; }
    if(currentSession && currentSession.user){
      const handle=myProfile?myProfile.handle:normalizeHandle((currentSession.user.user_metadata||{}).handle);
      const identity=handle?("@"+handle):currentSession.user.email;
      const p=myProfile||{handle:handle};
      authArea.innerHTML=
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer" id="meLink">'+
        avatarHtml(p,"avatar")+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(handle?("@"+handle):currentSession.user.email)+'</div></div></div>'+
        '<button class="authbtn" id="logoutBtn" style="width:100%;font-size:12px">Sign out</button>';
      var meL=document.getElementById("meLink");
      if(meL) meL.onclick=function(){ if(handle) viewProfile(handle); };
      document.getElementById("logoutBtn").onclick=function(){ sb.auth.signOut(); };
    } else {
      authArea.innerHTML='<button class="authbtn primary" id="signinToggle" style="width:100%">Sign In</button>';
      document.getElementById("signinToggle").onclick=function(){ openAuthModal("login"); };
    }
  }
  // Wire the auth modal (done once at boot)
  (function wireAuthModal(){
    const modal=document.getElementById("authModal");
    document.getElementById("tabLogin").onclick=function(){ authMode="login"; openAuthModal("login"); };
    document.getElementById("tabSignup").onclick=function(){ authMode="signup"; openAuthModal("signup"); };
    document.getElementById("authModalClose").onclick=function(){ modal.style.display="none"; };
    modal.addEventListener("click",function(e){ if(e.target===modal) modal.style.display="none"; });
    const gE=function(){return document.getElementById("authEmail").value.trim();};
    const gP=function(){return document.getElementById("authPass").value;};
    const gH=function(){var el=document.getElementById("authHandle");return el?el.value:"";};
    const say=function(t,ok){var m=document.getElementById("authMsg");if(!m)return;m.style.color=ok?"var(--up)":"var(--down)";m.textContent=t;};
    document.getElementById("authAction").onclick=async function(){
      if(authMode==="login"){
        if(!gE()||!gP()){say("Enter your email and password.");return;}
        const r=await sb.auth.signInWithPassword({email:gE(),password:gP()});
        if(r.error) say(r.error.message);
        else modal.style.display="none";
      } else {
        if(!gE()||gP().length<6){say("Use a valid email and a 6+ character password.");return;}
        const handle=normalizeHandle(gH());
        if(!handle){say("Choose a 3-20 character handle using letters, numbers, or underscores.");return;}
        const r=await sb.auth.signUp({email:gE(),password:gP(),options:{data:{handle:handle}}});
        if(r.error) say(r.error.message);
        else if(r.data && r.data.session){ modal.style.display="none"; }
        else say("Account created. Check your inbox to confirm, then log in.",true);
      }
    };
  })();
  var NAV_ICONS={
    search:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    trending:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    market:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    leaders:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
    people:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    portfolio:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    watchlist:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    messages:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    profile:'<svg class="snav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };
  function snavBtn(iconKey,label,id,isOn,badge){
    return '<button class="snav-item'+(isOn?' on':'')+'" id="'+id+'">'+NAV_ICONS[iconKey]+'<span class="snav-label">'+label+'</span>'+(badge?'<span class="snav-badge">'+badge+'</span>':'')+'</button>';
  }
  function renderNav(){
    var items='';
    items+=snavBtn('search','Search','navSearch',view==='search');
    items+=snavBtn('trending','Trending','navTrending',view==='trending');
    items+=snavBtn('market','Market','navMarket',view==='market');
    items+=snavBtn('leaders','Leaders','navLeaders',view==='leaderboard');
    items+=snavBtn('people','People','navDiscover',view==='discover');
    if(sb && currentSession){
      items+='<div class="sidebar-divider"></div>';
      items+=snavBtn('portfolio','Portfolio','navPortfolio',view==='portfolio');
      items+=snavBtn('watchlist','Watchlist','navWatch',view==='watchlist');
      items+=snavBtn('messages','Messages','navMsgs',view==='messages',unreadCount||'');
      items+=snavBtn('bell','Notifications','navNotif',view==='notifications',notifCount||'');
      items+=snavBtn('profile','Profile','navProfile',view==='profile'||view==='editProfile');
    }
    navArea.innerHTML='<div class="sidebar-nav">'+items+'</div>';
    document.getElementById('navSearch').onclick=function(){ setView('search'); };
    document.getElementById('navTrending').onclick=function(){ setView('trending'); };
    document.getElementById('navMarket').onclick=function(){ setView('market'); };
    document.getElementById('navLeaders').onclick=function(){ setView('leaderboard'); };
    document.getElementById('navDiscover').onclick=function(){ setView('discover'); };
    if(sb && currentSession){
      document.getElementById('navPortfolio').onclick=function(){ setView('portfolio'); };
      document.getElementById('navWatch').onclick=function(){ setView('watchlist'); };
      document.getElementById('navMsgs').onclick=function(){ setView('messages'); };
      document.getElementById('navNotif').onclick=function(){ setView('notifications'); };
      document.getElementById('navProfile').onclick=function(){ if(myProfile&&myProfile.handle){ viewProfile(myProfile.handle); } else { setView('editProfile'); } };
    }
  }
  function applyView(){
    document.getElementById("searchView").style.display=(view==="search")?"":"none";
    document.getElementById("trendingView").style.display=(view==="trending")?"":"none";
    document.getElementById("marketView").style.display=(view==="market")?"":"none";
    document.getElementById("leaderboardView").style.display=(view==="leaderboard")?"":"none";
    document.getElementById("discoverView").style.display=(view==="discover")?"":"none";
    document.getElementById("portfolioView").style.display=(view==="portfolio")?"":"none";
    document.getElementById("watchlistView").style.display=(view==="watchlist")?"":"none";
    document.getElementById("messagesView").style.display=(view==="messages")?"":"none";
    document.getElementById("cardView").style.display=(view==="card")?"":"none";
    document.getElementById("notifView").style.display=(view==="notifications")?"":"none";
    document.getElementById("profileView").style.display=(view==="profile")?"":"none";
    document.getElementById("editProfileView").style.display=(view==="editProfile")?"":"none";
  }
  function setView(v,skipPush){
    view=v; activeConvo=null; applyView(); renderNav();
    if(!skipPush){ try{ history.pushState({view:v}, "", v==="search"?"/":(v==="discover"?"/people":("/"+v))); }catch(e){} }
    if(v==="portfolio") loadPortfolio();
    if(v==="watchlist") loadWatchlist();
    if(v==="trending") loadTrending();
    if(v==="market") loadMarket();
    if(v==="leaderboard") loadLeaderboard();
    if(v==="discover") loadDiscover();
    if(v==="messages") loadConversations();
    if(v==="notifications") loadNotifications();
    if(v==="editProfile") renderEditProfile();
    window.scrollTo(0,0);
  }

  // Render the shell immediately so the header/nav never blanks out, even if
  // Supabase is slow, offline, or misconfigured. The async session check below
  // re-renders once it knows who (if anyone) is signed in.
  renderAuth(); renderNav(); routeFromPath(true); loadHomeFeed();
  // Home widgets load after the full script executes (so PULSE_QUERIES / sb are defined)
  setTimeout(function(){ if(view==="search"){ loadMarketPulse(); loadHomeTopCollectors(); } },0);
  if(sb){
    sb.auth.getSession().then(async function(res){
      try{
        currentSession=(res&&res.data)?res.data.session:null;
        await ensureMyProfile();
        renderAuth(); renderNav();
        if(currentSession){ loadHomeFeed(); initMessaging(); initNotif(); }
      }catch(e){}
    }).catch(function(){});
    sb.auth.onAuthStateChange(function(_e,session){
      currentSession=session;
      if(!session){
        unreadCount=0; notifCount=0; myProfile=null;
        try{ if(msgChannel){ sb.removeChannel(msgChannel); msgChannel=null; } if(notifChannel){ sb.removeChannel(notifChannel); notifChannel=null; } }catch(e){}
        if(view==="portfolio"||view==="watchlist"||view==="editProfile"||view==="messages"||view==="notifications"){ setView("search"); }
      }
      renderAuth(); renderNav();
      // Defer any Supabase calls out of the auth callback. supabase-js holds an
      // internal lock while this fires; awaiting DB/storage calls here deadlocks
      // the client and freezes later writes (profile save, avatar upload).
      setTimeout(async function(){
        try{ await ensureMyProfile(); renderAuth(); renderNav(); loadHomeFeed(); if(view==="search"){ loadHomeTopCollectors(); } if(currentSession){ initMessaging(); initNotif(); } }catch(e){}
      },0);
    });
  }

  // ---------- ROUTING ----------
  function routeFromPath(initial){
    var path=location.pathname||"/";
    var m=path.match(/^\\/u\\/([A-Za-z0-9_]{1,30})$/)||path.match(/^\\/@([A-Za-z0-9_]{1,30})$/);
    if(m){ viewProfile(m[1], true); return; }
    var cm=path.match(/^\\/card\\/([0-9a-fA-F-]{10,})$/);
    if(cm){ openCard(cm[1], true); return; }
    if(path==="/notifications" && currentSession){ setView("notifications", true); return; }
    if(path==="/trending"){ setView("trending", true); return; }
    if(path==="/market"){ setView("market", true); return; }
    if(path==="/leaderboard"){ setView("leaderboard", true); return; }
    if(path==="/people"||path==="/discover"){ setView("discover", true); return; }
    if(path==="/watchlist" && currentSession){ setView("watchlist", true); return; }
    if(path==="/portfolio" && currentSession){ setView("portfolio", true); return; }
    if(path==="/messages" && currentSession){ setView("messages", true); return; }
    setView("search", true);
  }
  window.addEventListener("popstate",function(){ routeFromPath(false); });
  document.getElementById("logo").onclick=function(){ setView("search"); };
  var _ml=document.getElementById("mobileLogo"); if(_ml) _ml.onclick=function(){ setView("search"); };

  // ---------- HOME FEED (recent community uploads) ----------
  async function recentPublicUploads(limit){
    if(!sb) return [];
    try{
      const r=await sb.from("holdings").select("id,title,query,grade,image_url,added_value,added_at,user_id").eq("is_public",true).order("added_at",{ascending:false}).limit(limit||12);
      const rows=r.data||[];
      const ids=[]; rows.forEach(function(h){ if(h.user_id && ids.indexOf(h.user_id)<0) ids.push(h.user_id); });
      let profs={};
      if(ids.length){
        const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",ids);
        (pr.data||[]).forEach(function(p){ profs[p.id]=p; });
      }
      rows.forEach(function(h){ h._profile=profs[h.user_id]||null; });
      await fillThumbs(rows);
      return rows;
    }catch(e){ return []; }
  }
  async function loadHomeFeed(){
    const el=document.getElementById("homeFeed");
    if(!el) return;
    if(!sb){ el.innerHTML='<div class="insight">Sign in to see collector activity.</div>'; return; }
    const rows=await recentPublicUploads(6);
    if(!rows.length){ el.innerHTML='<div class="activity"><div class="avatar">F</div><div class="copy"><b>Be the first.</b><span>Add a public card and it shows up here for the community.</span></div></div>'; return; }
    el.innerHTML=rows.map(function(h){
      const p=h._profile; const name=p?("@"+p.handle):"a collector";
      const img=thumbOf(h);
      return '<div class="activity">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0;cursor:pointer" data-card="'+h.id+'"/>'):avatarHtml(p))+
        '<div class="copy"><b data-h="'+(p?escapeAttr(p.handle):"")+'">'+escapeHtml(name)+'</b> added <span style="color:var(--text);font-weight:600;cursor:pointer" data-card="'+h.id+'">'+escapeHtml(h.title||h.query)+'</span><span>'+escapeHtml(h.grade||"")+(h.added_value?(' · '+money(h.added_value)):"")+'</span></div></div>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("b[data-h]"),function(b){ var hh=b.getAttribute("data-h"); if(hh) b.onclick=function(){ viewProfile(hh); }; });
    Array.prototype.forEach.call(el.querySelectorAll("[data-card]"),function(s){ s.onclick=function(){ openCard(s.getAttribute("data-card")); }; });
  }

  // ---------- HOME MARKET PULSE ----------
  var PULSE_QUERIES=[
    "PSA 10 Victor Wembanyama Prizm",
    "PSA 10 Jalen Brunson Prizm",
    "PSA 10 Caitlin Clark Prizm",
    "PSA 10 Shohei Ohtani Topps Chrome",
    "Charizard Base Set Holo PSA",
    "PSA 10 Michael Jordan Fleer"
  ];
  async function loadMarketPulse(){
    const el=document.getElementById("marketPulse");
    if(!el) return;
    const results=await Promise.all(PULSE_QUERIES.map(async function(q){ const sm=await liveMedian(q); return {q:q,sm:sm}; }));
    const hasData=results.some(function(r){return r.sm.median>0;});
    if(!hasData){ el.innerHTML='<div class="insight">No price data right now — check back shortly.</div>'; return; }
    el.innerHTML=results.map(function(r){
      const price=r.sm.median?money(r.sm.median):"\u2014";
      const sales=r.sm.n?r.sm.n+" sales":"";
      return '<div class="pulse-item" data-look="'+escapeAttr(r.q)+'">'+
        '<div class="pulse-label">'+escapeHtml(r.q)+'</div>'+
        '<div style="text-align:right;flex-shrink:0"><div class="pulse-price">'+price+'</div>'+
        (sales?'<div class="pulse-sales">'+escapeHtml(sales)+'</div>':'')+
        '</div></div>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("[data-look]"),function(c){ c.onclick=function(){ setView("search"); document.getElementById("q").value=c.getAttribute("data-look"); run(); }; });
  }

  // ---------- HOME TOP COLLECTORS ----------
  async function loadHomeTopCollectors(){
    const el=document.getElementById("homeTopCollectors");
    const lbL=document.getElementById("lbLink");
    if(lbL) lbL.onclick=function(){ setView("leaderboard"); };
    if(!el || !sb) return;
    try{
      const hr=await sb.from("holdings").select("user_id,added_value,manual_value").eq("is_public",true).limit(3000);
      const agg={};
      (hr.data||[]).forEach(function(h){ if(!h.user_id) return; if(!agg[h.user_id]) agg[h.user_id]=0; const v=(h.manual_value!=null&&h.manual_value!=="")?Number(h.manual_value):Number(h.added_value)||0; agg[h.user_id]+=(isNaN(v)?0:v); });
      const arr=Object.keys(agg).map(function(k){return{id:k,v:agg[k]};}).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;}).slice(0,5);
      if(!arr.length){ el.innerHTML='<div class="insight">No collectors yet. Add public cards to appear here.</div>'; return; }
      const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",arr.map(function(x){return x.id;}));
      const profs={}; (pr.data||[]).forEach(function(p){profs[p.id]=p;});
      const medals=["🥇","🥈","🥉","",""];
      el.innerHTML=arr.map(function(x,i){
        const p=profs[x.id]; if(!p) return "";
        return '<div class="tc-row" data-h="'+escapeAttr(p.handle)+'">'+
          '<span class="tc-rank">'+(medals[i]||("#"+(i+1)))+'</span>'+
          avatarHtml(p,"avatar")+
          '<span class="tc-name">'+escapeHtml(p.display_name||("@"+p.handle))+'</span>'+
          '<span class="tc-val">'+money(x.v)+'</span></div>';
      }).join("");
      Array.prototype.forEach.call(el.querySelectorAll("[data-h]"),function(r){ r.onclick=function(){viewProfile(r.getAttribute("data-h"));}; });
    }catch(e){ el.innerHTML='<div class="insight">Could not load.</div>'; }
  }

  // ---------- DISCOVER COLLECTORS ----------
  async function loadDiscover(){
    const wrap=document.getElementById("discoverWrap");
    const searchEl=document.getElementById("discoverSearch");
    const goBtn=document.getElementById("discoverGo");
    if(goBtn && !goBtn._wired){ goBtn._wired=true; goBtn.onclick=function(){ loadDiscover(); }; searchEl.addEventListener("keydown",function(e){ if(e.key==="Enter") loadDiscover(); }); }
    const term=(searchEl?searchEl.value.trim():"");
    wrap.innerHTML='<div class="card" style="margin-top:14px">Finding collectors…</div>';
    if(!sb){ wrap.innerHTML='<div class="card" style="margin-top:14px"><div class="insight">Accounts not configured.</div></div>'; return; }
    try{
      let q=sb.from("profiles").select("id,handle,display_name,avatar_url,bio,created_at").order("created_at",{ascending:false}).limit(60);
      if(term) q=q.or("handle.ilike.%"+term+"%,display_name.ilike.%"+term+"%");
      const r=await q;
      const profiles=r.data||[];
      if(!profiles.length){ wrap.innerHTML='<div class="card" style="margin-top:14px"><div class="insight">No collectors found'+(term?' for "'+escapeHtml(term)+'"':"")+'.</div></div>'; return; }
      const ids=profiles.map(function(p){return p.id;});
      let cardCounts={};
      try{ const cr=await sb.from("holdings").select("user_id").in("user_id",ids).eq("is_public",true).limit(5000); (cr.data||[]).forEach(function(h){ cardCounts[h.user_id]=(cardCounts[h.user_id]||0)+1; }); }catch(e){}
      let followerCounts={};
      try{ const fr=await sb.from("follows").select("following_id").in("following_id",ids).limit(5000); (fr.data||[]).forEach(function(f){ followerCounts[f.following_id]=(followerCounts[f.following_id]||0)+1; }); }catch(e){}
      let myFollowing=new Set();
      if(currentSession){ try{ const mf=await sb.from("follows").select("following_id").eq("follower_id",currentSession.user.id); (mf.data||[]).forEach(function(f){ myFollowing.add(f.following_id); }); }catch(e){} }
      let html="";
      profiles.forEach(function(p){
        const cards=cardCounts[p.id]||0;
        const fols=followerCounts[p.id]||0;
        const isMe=currentSession && p.id===currentSession.user.id;
        const iFollow=myFollowing.has(p.id);
        let followBtn="";
        if(currentSession && !isMe) followBtn='<button class="authbtn'+(iFollow?" following-style":"")+'" data-follow="'+escapeAttr(p.id)+'" data-handle="'+escapeAttr(p.handle)+'" style="flex-shrink:0">'+(iFollow?"Following":"Follow")+'</button>';
        html+='<div class="usercard">'+avatarHtml(p,"avatar")+
          '<div class="ucinfo"><div class="ucname" data-h="'+escapeAttr(p.handle)+'">'+escapeHtml(p.display_name||("@"+p.handle))+'</div>'+
          '<div class="uchandle">@'+escapeHtml(p.handle)+'</div>'+
          '<div class="ucmeta">'+cards+' public card'+(cards===1?"":"s")+' · '+fols+' follower'+(fols===1?"":"s")+'</div>'+
          (p.bio?('<div class="insight" style="margin-top:4px;font-size:12px">'+escapeHtml(p.bio.slice(0,80))+(p.bio.length>80?"…":"")+'</div>'):"")+
          '</div>'+followBtn+'</div>';
      });
      wrap.innerHTML='<div class="discgrid">'+html+'</div>';
      Array.prototype.forEach.call(wrap.querySelectorAll(".ucname[data-h]"),function(el){ var hh=el.getAttribute("data-h"); if(hh) el.onclick=function(){ viewProfile(hh); }; });
      Array.prototype.forEach.call(wrap.querySelectorAll("[data-follow]"),function(btn){
        btn.onclick=async function(){
          if(!currentSession){ alert("Sign in to follow collectors."); return; }
          const uid=btn.getAttribute("data-follow");
          const handle=btn.getAttribute("data-handle");
          btn.disabled=true;
          if(myFollowing.has(uid)){
            const d=await sb.from("follows").delete().eq("follower_id",currentSession.user.id).eq("following_id",uid);
            if(!d.error){ myFollowing.delete(uid); btn.textContent="Follow"; btn.classList.remove("following-style"); }
          } else {
            const i=await sb.from("follows").insert({follower_id:currentSession.user.id,following_id:uid});
            if(!i.error){ myFollowing.add(uid); btn.textContent="Following"; btn.classList.add("following-style"); }
          }
          btn.disabled=false;
        };
      });
    }catch(e){ wrap.innerHTML='<div class="card" style="margin-top:14px"><div class="err">Could not load collectors.</div></div>'; }
  }

  // ---------- FOLLOW LIST MODAL ----------
  async function showFollowList(userId,mode){
    const modal=document.getElementById("followListModal");
    const title=document.getElementById("followListTitle");
    const body=document.getElementById("followListBody");
    const closeBtn=document.getElementById("followListClose");
    title.textContent=(mode==="followers"?"Followers":"Following");
    body.innerHTML='<div class="insight" style="padding:12px 4px">Loading…</div>';
    modal.style.display="flex";
    closeBtn.onclick=function(){ modal.style.display="none"; };
    modal.onclick=function(e){ if(e.target===modal) modal.style.display="none"; };
    try{
      let ids=[];
      if(mode==="followers"){
        const r=await sb.from("follows").select("follower_id").eq("following_id",userId).limit(200);
        ids=(r.data||[]).map(function(x){return x.follower_id;});
      } else {
        const r=await sb.from("follows").select("following_id").eq("follower_id",userId).limit(200);
        ids=(r.data||[]).map(function(x){return x.following_id;});
      }
      if(!ids.length){ body.innerHTML='<div class="insight" style="padding:12px 4px">No '+(mode==="followers"?"followers":"accounts followed")+' yet.</div>'; return; }
      const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",ids);
      const profs=pr.data||[];
      let html="";
      profs.forEach(function(p){
        html+='<div class="followitem" data-h="'+escapeAttr(p.handle)+'">'+avatarHtml(p,"avatar")+
          '<div><div class="finame">'+escapeHtml(p.display_name||("@"+p.handle))+'</div>'+
          '<div class="fihandle">@'+escapeHtml(p.handle)+'</div></div></div>';
      });
      body.innerHTML=html;
      Array.prototype.forEach.call(body.querySelectorAll(".followitem[data-h]"),function(el){
        el.onclick=function(){ modal.style.display="none"; viewProfile(el.getAttribute("data-h")); };
      });
    }catch(e){ body.innerHTML='<div class="insight" style="padding:12px 4px">Could not load list.</div>'; }
  }

  // ---------- PORTFOLIO ----------
  function openValueModal(id,title,currentVal){
    editingId=id;
    document.getElementById("modalTitle").textContent=title;
    document.getElementById("modalInput").value=(currentVal!=null?currentVal:"");
    document.getElementById("modal").style.display="flex";
    setTimeout(function(){ var mi=document.getElementById("modalInput"); if(mi) mi.focus(); },30);
  }
  async function saveModalValue(clear){
    if(!editingId){ document.getElementById("modal").style.display="none"; return; }
    let payload;
    if(clear){ payload={manual_value:null}; }
    else {
      const t=(document.getElementById("modalInput").value||"").trim();
      if(t===""){ payload={manual_value:null}; }
      else { const cleaned=t.replace(/[^0-9.]/g,""); const num=Number(cleaned); if(cleaned===""||isNaN(num)){ alert("Please enter a number, e.g. 700"); return; } payload={manual_value:num}; }
    }
    const u=await sb.from("holdings").update(payload).eq("id",editingId);
    document.getElementById("modal").style.display="none";
    if(u.error){ alert("Could not update: "+u.error.message); } else { loadPortfolio(); }
  }
  var _pfView="grid"; // "list" or "grid" — showcase is the default
  async function loadPortfolio(){
    const showcase=document.getElementById("pfShowcase");
    const sum=document.getElementById("pfSummary");
    const list=document.getElementById("pfList");
    if(showcase) showcase.innerHTML='';
    sum.innerHTML=''; list.innerHTML=''; list.style.display='none';
    if(!currentSession){ sum.innerHTML='<div class="card">Sign in to see your portfolio.</div>'; return; }

    const r=await sb.from("holdings").select("*").eq("user_id",currentSession.user.id).order("added_at",{ascending:false});
    if(r.error){ sum.innerHTML='<div class="err"><b>Could not load portfolio.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const holds=r.data||[];
    if(!holds.length){ sum.innerHTML='<div class="card">No cards yet. Go to <b>Search</b>, look up a card, and tap <b>"+ Add"</b> on the one you own.</div>'; return; }
    await fillThumbs(holds);

    // Show loading state in showcase slot
    if(showcase) showcase.innerHTML='<div class="card"><div class="insight">Loading your collection…</div></div>';
    const valued=await Promise.all(holds.map(async function(h){ const v=await valueHolding(h); return {h:h, current:v.current, manual:v.manual}; }));

    // Wire view toggle (after valued is resolved so closures are safe)
    var lBtn=document.getElementById("pfListViewBtn"); var gBtn=document.getElementById("pfGridViewBtn");
    if(lBtn){ lBtn.onclick=function(){ _pfView="list"; lBtn.classList.add("on"); gBtn.classList.remove("on"); if(showcase) showcase.innerHTML=''; list.style.display=''; renderPfList(valued,list); }; }
    if(gBtn){ gBtn.onclick=function(){ _pfView="grid"; gBtn.classList.add("on"); lBtn.classList.remove("on"); list.style.display='none'; list.innerHTML=''; renderPfGrid(valued,showcase); }; }

    let totalCur=0, totalAdd=0;
    valued.forEach(function(v){ totalCur+=v.current; totalAdd+=(Number(v.h.added_value)||0); });
    const gl=totalCur-totalAdd; const glPct=totalAdd?(gl/totalAdd*100):0;

    // Stats strip — compact, no collection groups
    sum.innerHTML='<div class="card"><div class="stats">'+
      '<div class="stat"><div class="l">Cards</div><div class="v">'+holds.length+'</div></div>'+
      '<div class="stat hl"><div class="l">Current value</div><div class="v">'+money(totalCur)+'</div></div>'+
      '<div class="stat"><div class="l">Added value</div><div class="v">'+money(totalAdd)+'</div></div>'+
      '<div class="stat"><div class="l">Gain / loss</div><div class="v" style="color:'+(gl>=0?"var(--up)":"var(--down)")+'">'+(gl>=0?"+":"")+money(gl)+' ('+(glPct>=0?"+":"")+glPct.toFixed(0)+'%)</div></div>'+
      '</div><div class="insight" style="margin-top:8px">Values from recent confirmed sales. Best Offer data can be imperfect.</div></div>';

    // Render: showcase goes above stats (in pfShowcase), list goes below (in pfList)
    if(_pfView==="grid"){
      list.style.display='none'; list.innerHTML='';
      renderPfGrid(valued,showcase);
    } else {
      if(showcase) showcase.innerHTML='';
      list.style.display=''; renderPfList(valued,list);
    }
    if(lBtn){ lBtn.classList.toggle("on",_pfView==="list"); } if(gBtn){ gBtn.classList.toggle("on",_pfView==="grid"); }
  }

  function renderPfList(valued,list){
    if(!valued||!valued.length){ list.innerHTML='<div class="card">No cards yet.</div>'; return; }
    let rows="";
    valued.forEach(function(v){
      const h=v.h; const add=Number(h.added_value)||0; const diff=v.current-add; const dpct=add?(diff/add*100):0;
      const img=thumbOf(h);
      const manualTag=v.manual?' <span style="font-size:9px;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:0 4px;vertical-align:1px">MANUAL</span>':"";
      const pubTag=(h.is_public!==false)?'<span style="font-size:9px;color:var(--up)">public</span>':'<span style="font-size:9px;color:var(--dim)">private</span>';
      const listTag=(h.sold?'<span class="badge" style="color:var(--dim);border:1px solid var(--dim)">SOLD</span>':((h.for_sale?'<span class="badge sale">FOR SALE</span>':"")+(h.for_trade?'<span class="badge trade">TRADE</span>':"")));
      const glHtml=add>0?('<div style="font-size:12px;color:'+(diff>=0?"var(--up)":"var(--down)")+'">'+(diff>=0?"+":"")+money(diff)+' ('+(dpct>=0?"+":"")+dpct.toFixed(0)+'%)</div>'):'<div style="font-size:12px;color:var(--dim)">\u2014</div>';
      rows+='<div class="hrow">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div class="lk" data-card="'+h.id+'" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer">'+escapeHtml(h.title||h.query)+listTag+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">'+escapeHtml(h.grade||"")+' · added '+money(add)+' · '+pubTag+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+money(v.current)+manualTag+'</div>'+glHtml+'</div>'+
        '<button class="ed" data-sell="'+h.id+'">'+((h.for_sale||h.for_trade)?"Listed":"Sell/Trade")+'</button>'+
        '<button class="ed" data-pub="'+h.id+'">'+((h.is_public!==false)?"Hide":"Show")+'</button>'+
        '<button class="ed" data-edit="'+h.id+'">Edit</button>'+
        '<button class="rm" data-id="'+h.id+'">Remove</button></div>';
    });
    list.innerHTML='<div class="card"><label>YOUR CARDS</label>'+rows+'</div>';
    wirePfButtons(valued,list);
  }

  function renderPfGrid(valued,list){
    if(!valued||!valued.length){ list.innerHTML='<div class="card">No cards yet.</div>'; return; }
    let cards="";
    valued.forEach(function(v){
      const h=v.h; const img=thumbOf(h);
      const listTag=(h.sold?'<span class="badge" style="color:var(--dim);border:1px solid var(--dim)">SOLD</span>':((h.for_sale?'<span class="badge sale">FOR SALE</span>':"")+(h.for_trade?'<span class="badge trade">TRADE</span>':"")));
      cards+='<div class="showcase-card" data-card="'+h.id+'">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()"/>'):('<div style="width:100%;height:110px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:28px">🃏</div>'))+
        '<div class="sc-info">'+
          '<div class="sc-name">'+escapeHtml(h.title||h.query)+listTag+'</div>'+
          '<div class="sc-grade">'+escapeHtml(h.grade||"Raw")+'</div>'+
          '<div class="sc-val">'+money(v.current)+'</div>'+
        '</div></div>';
    });
    list.innerHTML='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><label style="margin-bottom:0">SHOWCASE</label><span style="font-size:11px;color:var(--dim)">'+valued.length+' cards · click to open</span></div><div class="showcase-grid">'+cards+'</div></div>';
    Array.prototype.forEach.call(list.querySelectorAll(".showcase-card[data-card]"),function(c){ c.onclick=function(){ openCard(c.getAttribute("data-card")); }; });
  }

  function wirePfButtons(valued,list){
    Array.prototype.forEach.call(list.querySelectorAll(".lk[data-card]"),function(s){ s.onclick=function(){ openCard(s.getAttribute("data-card")); }; });
    Array.prototype.forEach.call(list.querySelectorAll(".rm"),function(b){
      b.onclick=async function(){
        const id=b.getAttribute("data-id"); b.disabled=true; b.textContent="…";
        const d=await sb.from("holdings").delete().eq("id",id);
        if(d.error){ b.disabled=false; b.textContent="Remove"; alert("Could not remove: "+d.error.message); }
        else loadPortfolio();
      };
    });
    Array.prototype.forEach.call(list.querySelectorAll("[data-edit]"),function(b){
      b.onclick=function(){
        const id=b.getAttribute("data-edit");
        const found=valued.filter(function(v){return v.h.id===id;})[0];
        const h=found?found.h:null;
        const cur=(h && h.manual_value!=null && h.manual_value!=="")?Number(h.manual_value):null;
        openValueModal(id,(h&&(h.title||h.query))||"This card",cur);
      };
    });
    Array.prototype.forEach.call(list.querySelectorAll("[data-pub]"),function(b){
      b.onclick=async function(){
        const id=b.getAttribute("data-pub");
        const found=valued.filter(function(v){return v.h.id===id;})[0];
        const cur=found?(found.h.is_public!==false):true;
        b.disabled=true;
        const u=await sb.from("holdings").update({is_public:!cur}).eq("id",id);
        if(u.error){ b.disabled=false; alert("Could not update: "+u.error.message); } else loadPortfolio();
      };
    });
    Array.prototype.forEach.call(list.querySelectorAll("[data-sell]"),function(b){
      b.onclick=function(){
        const id=b.getAttribute("data-sell");
        const found=valued.filter(function(v){return v.h.id===id;})[0];
        if(found) openSellModal(found.h);
      };
    });
  }

  // ---------- WATCHLIST ----------
  function openWatchModal(query,label,image){
    pendingWatch={query:query,label:label,image:image};
    document.getElementById("watchTitle").textContent=label||query;
    document.getElementById("watchTarget").value="";
    document.getElementById("watchDir").value="above";
    document.getElementById("watchModal").style.display="flex";
  }
  async function saveWatch(){
    if(!pendingWatch){ document.getElementById("watchModal").style.display="none"; return; }
    if(!currentSession){ alert("Sign in to use the watchlist."); document.getElementById("watchModal").style.display="none"; return; }
    const t=(document.getElementById("watchTarget").value||"").trim().replace(/[^0-9.]/g,"");
    const dir=document.getElementById("watchDir").value;
    const payload={ query:pendingWatch.query, label:pendingWatch.label||pendingWatch.query, image_url:pendingWatch.image||null, direction:dir };
    if(t!==""){ const num=Number(t); if(!isNaN(num)) payload.target_price=num; }
    const r=await sb.from("watchlist").insert(payload);
    document.getElementById("watchModal").style.display="none";
    pendingWatch=null;
    if(r.error){ alert("Could not add to watchlist: "+r.error.message); }
    else if(view==="watchlist"){ loadWatchlist(); }
  }
  async function loadWatchlist(){
    const el=document.getElementById("watchList");
    el.innerHTML='<div class="card">Loading your watchlist…</div>';
    if(!currentSession){ el.innerHTML='<div class="card">Sign in to view your watchlist.</div>'; return; }
    let r;
    try{ r=await sb.from("watchlist").select("*").order("created_at",{ascending:false}); }
    catch(e){ el.innerHTML='<div class="err">Could not load watchlist.</div>'; return; }
    if(r.error){ el.innerHTML='<div class="err"><b>Could not load watchlist.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const items=r.data||[];
    if(!items.length){ el.innerHTML='<div class="card">Nothing tracked yet. Search a card and tap the <b>\u2606 watch</b> button to track it here.</div>'; return; }

    // Render rows immediately — prices load progressively (cached = instant, uncached = async update)
    function wlRowHtml(w){
      const target=(w.target_price!=null)?Number(w.target_price):null;
      const img=w.image_url||"";
      const targetTxt=(target!=null)?((w.direction==="below"?"below ":"above ")+money(target)):"no target";
      const cached=_cachedMedian(w.query);
      const cur=cached?cached.median:null;
      const n=cached?cached.n:0;
      const alerted=target!=null&&cur?(w.direction==="below"?cur<=target:cur>=target):false;
      return '<div class="hrow wl-item"'+(alerted?' style="background:rgba(43,214,115,.08)"':'')+' id="wlrow_'+w.id+'">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(w.label||w.query)+'<span id="wlalert_'+w.id+'">'+(alerted?' <span style="font-size:9px;color:var(--up);border:1px solid var(--up);border-radius:3px;padding:0 5px">ALERT</span>':"")+'</span></div>'+
          '<div style="font-size:11px;color:var(--dim)">target: '+escapeHtml(targetTxt)+'<span id="wlsales_'+w.id+'">'+(n?' · '+n+' sales':'')+'</span></div>'+
        '</div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700" id="wlprice_'+w.id+'">'+(cur?money(cur):'<span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span>')+'</div></div>'+
        '<button class="ed" data-look="'+escapeAttr(w.query)+'">View</button>'+
        '<button class="rm" data-wid="'+w.id+'">Remove</button></div>';
    }

    el.innerHTML='<div class="card"><label>TRACKED CARDS</label>'+items.map(wlRowHtml).join('')+
      '<div class="insight" style="margin-top:12px">Prices load in real-time. Targets are checked on each visit — email/push alerts coming soon.</div></div>';

    Array.prototype.forEach.call(el.querySelectorAll(".rm"),function(b){
      b.onclick=async function(){ const id=b.getAttribute("data-wid"); b.disabled=true; b.textContent="…"; const d=await sb.from("watchlist").delete().eq("id",id); if(d.error){ b.disabled=false; b.textContent="Remove"; alert("Could not remove: "+d.error.message); } else loadWatchlist(); };
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-look]"),function(b){
      b.onclick=function(){ const qv=b.getAttribute("data-look"); setView("search"); document.getElementById("q").value=qv; run(); };
    });

    // Load prices async — update each row as it resolves
    items.forEach(async function(w){
      try{
        const sm=await liveMedian(w.query);
        const priceEl=document.getElementById("wlprice_"+w.id);
        if(priceEl) priceEl.textContent=sm.median?money(sm.median):"\u2014";
        const salesEl=document.getElementById("wlsales_"+w.id);
        if(salesEl) salesEl.textContent=sm.n?' · '+sm.n+' sales':'';
        const target=w.target_price!=null?Number(w.target_price):null;
        const alerted=target!=null&&sm.median?(w.direction==="below"?sm.median<=target:sm.median>=target):false;
        const alertEl=document.getElementById("wlalert_"+w.id);
        if(alertEl) alertEl.innerHTML=alerted?' <span style="font-size:9px;color:var(--up);border:1px solid var(--up);border-radius:3px;padding:0 5px">ALERT</span>':'';
        const row=document.getElementById("wlrow_"+w.id);
        if(row){ row.style.background=alerted?"rgba(43,214,115,.08)":""; }
      }catch(e){}
    });
  }

  // ---------- TRENDING / MARKET TAPE ----------
  const TRENDING=[
    "PSA 10 Victor Wembanyama Prizm",
    "PSA 10 Jalen Brunson Prizm",
    "Charizard Base Set Holo PSA",
    "PSA 10 Caitlin Clark Prizm",
    "PSA 10 Luka Doncic Prizm Silver",
    "Pikachu Illustrator PSA",
    "PSA 10 Shohei Ohtani Topps Chrome",
    "PSA 10 Michael Jordan Fleer"
  ];
  async function loadTrending(){
    const tapeWrap=document.getElementById("tapeWrap");
    const feedWrap=document.getElementById("feedWrap");
    tapeWrap.innerHTML='<div class="card"><label>WHAT COLLECTORS ARE WATCHING</label><div class="insight">Loading live medians…</div></div>';
    const results=await Promise.all(TRENDING.map(async function(q){ const sm=await liveMedian(q); return {q:q, sm:sm}; }));
    let cards="";
    results.forEach(function(r){
      cards+='<div class="tapecard" data-look="'+escapeAttr(r.q)+'"><div class="nm">'+escapeHtml(r.q)+'</div>'+
        '<div class="pr">'+(r.sm.median?money(r.sm.median):"\u2014")+'</div>'+
        '<div class="mt">'+(r.sm.n?(r.sm.n+" recent sales · median"):"no recent sales")+'</div></div>';
    });
    tapeWrap.innerHTML='<div class="card"><label>WHAT COLLECTORS ARE WATCHING</label><div class="tape">'+cards+'</div></div>';
    Array.prototype.forEach.call(tapeWrap.querySelectorAll("[data-look]"),function(c){
      c.onclick=function(){ const qv=c.getAttribute("data-look"); setView("search"); document.getElementById("q").value=qv; run(); };
    });

    if(!sb){ feedWrap.innerHTML=""; return; }
    feedWrap.innerHTML='<div class="card"><label>RECENTLY ADDED ACROSS FOILIO</label><div class="insight">Loading community cards…</div></div>';
    const rows=await recentPublicUploads(15);
    if(!rows.length){ feedWrap.innerHTML='<div class="card"><label>RECENTLY ADDED ACROSS FOILIO</label><div class="insight">No public cards yet. Add a card to your portfolio to seed the feed.</div></div>'; return; }
    let feed="";
    rows.forEach(function(h){
      const p=h._profile; const name=p?("@"+p.handle):"a collector"; const img=thumbOf(h);
      feed+='<div class="hrow">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(h.title||h.query)+'</div>'+
        '<div style="font-size:11px;color:var(--dim)"><span data-h="'+(p?escapeAttr(p.handle):"")+'" style="color:var(--indigo);cursor:pointer">'+escapeHtml(name)+'</span> · '+escapeHtml(h.grade||"")+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+(h.added_value?money(h.added_value):"")+'</div></div></div>';
    });
    feedWrap.innerHTML='<div class="card"><label>RECENTLY ADDED ACROSS FOILIO</label>'+feed+'</div>';
    Array.prototype.forEach.call(feedWrap.querySelectorAll("span[data-h]"),function(s){ var hh=s.getAttribute("data-h"); if(hh) s.onclick=function(){ viewProfile(hh); }; });
  }

  // ---------- PUBLIC PROFILE ----------
  async function viewProfile(handle, skipPush){
    handle=normalizeHandle(handle)||handle;
    view="profile"; applyView(); renderNav();
    if(!skipPush){ try{ history.pushState({view:"profile",handle:handle},"","/u/"+handle); }catch(e){} }
    window.scrollTo(0,0);
    const body=document.getElementById("profileBody");
    if(!sb){ body.innerHTML='<div class="err">Profiles need accounts to be configured.</div>'; return; }
    body.innerHTML='<div class="card">Loading @'+escapeHtml(handle)+'…</div>';
    const pr=await sb.from("profiles").select("*").eq("handle",handle).maybeSingle();
    if(pr.error||!pr.data){ body.innerHTML='<div class="card"><h1 style="font-size:24px">Collector not found</h1><p class="sub">No collector with the handle @'+escapeHtml(handle)+'.</p></div>'; return; }
    const p=pr.data;
    const isMe=currentSession && currentSession.user.id===p.id;
    let followers=0, following=0, iFollow=false;
    try{
      const fc=await sb.from("follows").select("*",{count:"exact",head:true}).eq("following_id",p.id);
      followers=fc.count||0;
      const gc=await sb.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",p.id);
      following=gc.count||0;
      if(currentSession && !isMe){ const mf=await sb.from("follows").select("follower_id").eq("follower_id",currentSession.user.id).eq("following_id",p.id).maybeSingle(); iFollow=!!(mf.data); }
    }catch(e){}

    const links=[];
    if(p.twitter){ links.push('<a href="'+escapeAttr(/^https?:/.test(p.twitter)?p.twitter:("https://twitter.com/"+p.twitter.replace(/^@/,"")))+'" target="_blank" rel="noopener">Twitter / X</a>'); }
    if(p.instagram){ links.push('<a href="'+escapeAttr(/^https?:/.test(p.instagram)?p.instagram:("https://instagram.com/"+p.instagram.replace(/^@/,"")))+'" target="_blank" rel="noopener">Instagram</a>'); }
    if(p.website){ links.push('<a href="'+escapeAttr(/^https?:/.test(p.website)?p.website:("https://"+p.website))+'" target="_blank" rel="noopener">Website</a>'); }

    const actionBtn=isMe
      ? '<button class="followbtn following" id="editProfBtn">Edit profile</button>'
      : (currentSession?('<button class="followbtn'+(iFollow?" following":"")+'" id="followBtn">'+(iFollow?"Following":"Follow")+'</button> <button class="followbtn following" id="msgBtn">Message</button>'):'');

    body.innerHTML='<div class="card"><div class="profhead">'+
      avatarHtml(p,"bigav")+
      '<div style="flex:1;min-width:200px"><h1 style="font-size:26px">'+escapeHtml(p.display_name||("@"+p.handle))+'</h1>'+
      '<div class="mono" style="color:var(--gold);font-size:13px">@'+escapeHtml(p.handle)+'</div>'+
      (p.bio?('<p class="sub" style="font-size:14px;margin-top:8px">'+escapeHtml(p.bio)+'</p>'):"")+
      (links.length?('<div class="sociallinks">'+links.join("")+'</div>'):"")+
      '<div class="pstats"><div><button class="pstat-btn" id="followersBtn"><b id="followersN">'+followers+'</b>followers</button></div><div><button class="pstat-btn" id="followingBtn"><b>'+following+'</b>following</button></div></div>'+
      '</div>'+
      '<div>'+actionBtn+'</div>'+
      '</div></div>'+
      '<div id="profCards"><div class="card">Loading cards…</div></div>';

    if(isMe){ var eb=document.getElementById("editProfBtn"); if(eb) eb.onclick=function(){ setView("editProfile"); }; }
    else if(currentSession){
      var fb=document.getElementById("followBtn");
      if(fb) fb.onclick=async function(){
        fb.disabled=true;
        if(iFollow){ const d=await sb.from("follows").delete().eq("follower_id",currentSession.user.id).eq("following_id",p.id); if(!d.error){ iFollow=false; fb.textContent="Follow"; fb.classList.remove("following"); followers=Math.max(0,followers-1); document.getElementById("followersN").textContent=followers; } }
        else { const i=await sb.from("follows").insert({follower_id:currentSession.user.id, following_id:p.id}); if(!i.error){ iFollow=true; fb.textContent="Following"; fb.classList.add("following"); followers=followers+1; document.getElementById("followersN").textContent=followers; } }
        fb.disabled=false;
      };
      var mb=document.getElementById("msgBtn");
      if(mb) mb.onclick=function(){ startConversation(p.id, p.handle); };
    }
    var frsBtn=document.getElementById("followersBtn");
    if(frsBtn) frsBtn.onclick=function(){ showFollowList(p.id,"followers"); };
    var fngBtn=document.getElementById("followingBtn");
    if(fngBtn) fngBtn.onclick=function(){ showFollowList(p.id,"following"); };

    // public cards
    const cardsEl=document.getElementById("profCards");
    const hr=await sb.from("holdings").select("*").eq("user_id",p.id).eq("is_public",true).order("added_at",{ascending:false});
    const holds=(hr.data||[]);
    if(!holds.length){ cardsEl.innerHTML='<div class="card"><label>PUBLIC COLLECTION</label><div class="insight">This collector has no public cards yet.</div></div>'; return; }
    await fillThumbs(holds);
    const valued=await Promise.all(holds.slice(0,40).map(async function(h){ const v=await valueHolding(h); return {h:h, current:v.current}; }));
    let total=0; valued.forEach(function(v){ total+=v.current; });

    // Trophy room: top 6 most-valued cards with images (non-sold)
    const withImgs=valued.filter(function(v){ return thumbOf(v.h) && !v.h.sold; }).sort(function(a,b){return b.current-a.current;}).slice(0,6);
    const trophyHtml=withImgs.length>1?(
      '<div class="card" style="margin-bottom:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><label style="margin-bottom:0">🏆 TROPHY ROOM</label><span style="font-size:11px;color:var(--dim)">top pieces by value</span></div>'+
      '<div class="showcase-grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">'+
      withImgs.map(function(v){
        const h=v.h; const img=thumbOf(h);
        return '<div class="showcase-card" data-card="'+h.id+'">'+
          '<img src="'+escapeAttr(img)+'" onerror="this.remove()"/>'+
          '<div class="sc-info"><div class="sc-name">'+escapeHtml(h.title||h.query)+'</div>'+
          '<div class="sc-grade">'+escapeHtml(h.grade||"Raw")+'</div>'+
          '<div class="sc-val">'+money(v.current)+'</div></div></div>';
      }).join("")+
      '</div></div>'
    ):"";

    let rows="";
    valued.forEach(function(v,idx){
      const h=v.h; const img=thumbOf(h);
      const tags=(h.sold?'<span class="badge" style="color:var(--dim);border:1px solid var(--dim)">SOLD</span>':((h.for_sale?'<span class="badge sale">FOR SALE</span>':"")+(h.for_trade?'<span class="badge trade">TRADE</span>':"")));
      let act="";
      if(!isMe && currentSession && !h.sold && (h.for_sale||h.for_trade)){
        if(h.for_sale && h.ask_price!=null) act='<button class="ed" data-pbuy="'+idx+'">Buy '+money(h.ask_price)+'</button>';
        else act='<button class="ed" data-poffer="'+idx+'">'+(h.for_trade&&!h.for_sale?"Trade":"Offer")+'</button>';
      }
      rows+='<div class="hrow">'+
        (img?('<img src="'+escapeAttr(img)+'" data-card="'+h.id+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0;cursor:pointer"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div class="lk" data-card="'+h.id+'" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer">'+escapeHtml(h.title||h.query)+tags+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">'+escapeHtml(h.grade||"")+(h.ask_price!=null?(' · asking '+money(h.ask_price)):"")+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+money(v.current)+'</div></div>'+act+'</div>';
    });
    cardsEl.innerHTML=
      '<div class="card"><div class="stats"><div class="stat"><div class="l">Public cards</div><div class="v">'+holds.length+'</div></div>'+
      '<div class="stat hl"><div class="l">Public value</div><div class="v">'+money(total)+'</div></div></div></div>'+
      trophyHtml+
      '<div class="card"><label>FULL COLLECTION</label>'+rows+'</div>';
    holds.forEach(function(h){ h._profile=p; });
    Array.prototype.forEach.call(cardsEl.querySelectorAll("[data-card]"),function(s){ s.onclick=function(){ openCard(s.getAttribute("data-card")); }; });
    Array.prototype.forEach.call(cardsEl.querySelectorAll("[data-pbuy]"),function(b){ b.onclick=function(){ openOfferModal(holds[Number(b.getAttribute("data-pbuy"))],"buy_now"); }; });
    Array.prototype.forEach.call(cardsEl.querySelectorAll("[data-poffer]"),function(b){ b.onclick=function(){ var h=holds[Number(b.getAttribute("data-poffer"))]; openOfferModal(h, h.for_trade&&!h.for_sale?"trade":"offer"); }; });
    Array.prototype.forEach.call(cardsEl.querySelectorAll(".showcase-card[data-card]"),function(c){ c.onclick=function(){ openCard(c.getAttribute("data-card")); }; });
  }

  // ---------- EDIT PROFILE ----------
  function renderEditProfile(){
    const el=document.getElementById("editForm");
    if(!currentSession){ el.innerHTML='<div class="insight">Sign in to edit your profile.</div>'; return; }
    const p=myProfile||{};
    el.innerHTML=
      '<div style="display:flex;gap:16px;align-items:center;margin-bottom:18px">'+
        avatarHtml(p,"bigav")+
        '<div><input type="file" id="avatarFile" accept="image/*" style="font-size:13px;padding:8px"/><div class="insight" id="avatarMsg">Upload a square image for best results.</div></div>'+
      '</div>'+
      '<div class="field"><label>HANDLE</label><input id="efHandle" maxlength="20" value="'+escapeAttr(p.handle||"")+'" placeholder="yourhandle"/></div>'+
      '<div class="field"><label>DISPLAY NAME</label><input id="efName" value="'+escapeAttr(p.display_name||"")+'" placeholder="Your name"/></div>'+
      '<div class="field"><label>ABOUT ME</label><textarea id="efBio" placeholder="Collector of...">'+escapeHtml(p.bio||"")+'</textarea></div>'+
      '<div class="field"><label>TWITTER / X</label><input id="efTwitter" value="'+escapeAttr(p.twitter||"")+'" placeholder="@handle or full link"/></div>'+
      '<div class="field"><label>INSTAGRAM</label><input id="efInstagram" value="'+escapeAttr(p.instagram||"")+'" placeholder="@handle or full link"/></div>'+
      '<div class="field"><label>WEBSITE</label><input id="efWebsite" value="'+escapeAttr(p.website||"")+'" placeholder="yoursite.com"/></div>'+
      '<div class="field"><label class="switch"><input type="checkbox" id="efPublic" '+((p.is_public!==false)?"checked":"")+' style="width:auto"/> Show my profile &amp; public cards to everyone</label></div>'+
      '<button class="btn" id="efSave">Save profile</button>'+
      '<div class="msg insight" id="efMsg" style="margin-top:10px"></div>';
    document.getElementById("avatarFile").onchange=uploadAvatar;
    document.getElementById("efSave").onclick=saveProfile;
  }
  async function uploadAvatar(e){
    const file=e.target.files&&e.target.files[0];
    if(!file||!currentSession) return;
    const msg=document.getElementById("avatarMsg");
    msg.textContent="Uploading…";
    try{
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
      const path=currentSession.user.id+"/avatar_"+Date.now()+"."+ext;
      const up=await withTimeout(sb.storage.from("avatars").upload(path,file,{upsert:true,cacheControl:"3600"}),30000,"Upload");
      if(up.error){ msg.textContent="Upload failed: "+up.error.message; return; }
      const pub=sb.storage.from("avatars").getPublicUrl(path);
      const url=pub.data.publicUrl;
      const u=await withTimeout(sb.from("profiles").update({avatar_url:url}).eq("id",currentSession.user.id),25000,"Save");
      if(u.error){ msg.textContent="Saved file, but could not update profile: "+u.error.message; return; }
      myProfile=Object.assign({},myProfile,{avatar_url:url});
      msg.textContent="Avatar updated.";
      renderEditProfile(); renderAuth();
    }catch(err){ msg.textContent="Upload failed."; }
  }
  async function saveProfile(){
    const msg=document.getElementById("efMsg");
    const handle=normalizeHandle(document.getElementById("efHandle").value);
    if(!handle){ msg.style.color="var(--down)"; msg.textContent="Handle must be 3-20 letters, numbers, or underscores."; return; }
    const payload={
      handle:handle,
      display_name:document.getElementById("efName").value.trim()||null,
      bio:document.getElementById("efBio").value.trim()||null,
      twitter:document.getElementById("efTwitter").value.trim()||null,
      instagram:document.getElementById("efInstagram").value.trim()||null,
      website:document.getElementById("efWebsite").value.trim()||null,
      is_public:document.getElementById("efPublic").checked,
      updated_at:new Date().toISOString()
    };
    const btn=document.getElementById("efSave"); btn.disabled=true; btn.textContent="Saving…";
    let u;
    try{ u=await withTimeout(sb.from("profiles").update(payload).eq("id",currentSession.user.id),25000,"Save"); }
    catch(err){ btn.disabled=false; btn.textContent="Save profile"; msg.style.color="var(--down)"; msg.textContent=err.message||"Could not save. Please try again."; return; }
    btn.disabled=false; btn.textContent="Save profile";
    if(u.error){ msg.style.color="var(--down)"; msg.textContent=(/duplicate|unique/i.test(u.error.message)?"That handle is taken. Try another.":("Could not save: "+u.error.message)); return; }
    myProfile=Object.assign({},myProfile,payload);
    msg.style.color="var(--up)"; msg.textContent="Profile saved.";
    renderAuth();
  }

  // ---------- NOTIFICATIONS ----------
  // notify() removed — notifications are now created by database triggers
  async function refreshNotif(){
    if(!sb || !currentSession){ notifCount=0; return; }
    try{ const r=await sb.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",currentSession.user.id).is("read_at",null); notifCount=r.count||0; }catch(e){ notifCount=0; }
  }
  function initNotif(){
    if(!sb || !currentSession) return;
    setTimeout(async function(){ try{ await refreshNotif(); renderNav(); }catch(e){} },0);
    try{
      if(notifChannel){ sb.removeChannel(notifChannel); notifChannel=null; }
      notifChannel=sb.channel("no_"+currentSession.user.id)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+currentSession.user.id},function(){
          if(view==="notifications"){ loadNotifications(); } else { notifCount=notifCount+1; renderNav(); }
        }).subscribe();
    }catch(e){}
  }
  async function loadNotifications(){
    const wrap=document.getElementById("notifWrap");
    wrap.innerHTML='<div class="card">Loading notifications…</div>';
    const r=await sb.from("notifications").select("*").eq("user_id",currentSession.user.id).order("created_at",{ascending:false}).limit(100);
    if(r.error){ wrap.innerHTML='<div class="err"><b>Could not load notifications.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const rows=r.data||[];
    if(!rows.length){ wrap.innerHTML='<div class="card">No notifications yet. Follows, likes, comments, and offers will show up here.</div>'; return; }
    const actors=[]; rows.forEach(function(n){ if(n.actor_id && actors.indexOf(n.actor_id)<0) actors.push(n.actor_id); });
    let profs={};
    if(actors.length){ const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",actors); (pr.data||[]).forEach(function(p){ profs[p.id]=p; }); }
    const verb={follow:"started following you",like:"liked your card",comment:"commented on your card",offer:"sent you an offer",offer_accepted:"accepted your offer",offer_declined:"declined your offer"};
    let html="";
    rows.forEach(function(n,idx){
      const a=profs[n.actor_id]; const name=a?("@"+a.handle):"Someone";
      html+='<div class="notif'+(n.read_at?"":" unread")+'" data-i="'+idx+'">'+avatarHtml(a)+
        '<div class="nt"><b>'+escapeHtml(name)+'</b> '+escapeHtml(verb[n.type]||n.type)+(n.body?(' \u2014 '+escapeHtml(n.body)):"")+'<span>'+escapeHtml((n.created_at||"").slice(5,16).replace("T"," "))+'</span></div></div>';
    });
    wrap.innerHTML='<div class="card"><div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button class="authbtn" id="markAllRead">Mark all read</button></div>'+html+'</div>';
    document.getElementById("markAllRead").onclick=async function(){ await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",currentSession.user.id).is("read_at",null); await refreshNotif(); renderNav(); loadNotifications(); };
    Array.prototype.forEach.call(wrap.querySelectorAll(".notif"),function(el){
      el.onclick=function(){ const n=rows[Number(el.getAttribute("data-i"))]; const a=profs[n.actor_id];
        if(n.holding_id) openCard(n.holding_id); else if(a&&a.handle) viewProfile(a.handle); };
    });
    try{ await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",currentSession.user.id).is("read_at",null); await refreshNotif(); renderNav(); }catch(e){}
  }

  // ---------- GIF PICKER ----------
  function openGifPicker(target){
    gifTarget=target;
    document.getElementById("gifSearch").value="";
    document.getElementById("gifResults").innerHTML=GIPHY_KEY?'<div class="insight">Type to search GIFs.</div>':'<div class="insight">Paste a GIF/image URL above, then tap "Use pasted URL". (Add a free GIPHY_API_KEY to enable search.)</div>';
    document.getElementById("gifModal").style.display="flex";
    setTimeout(function(){ var gs=document.getElementById("gifSearch"); if(gs) gs.focus(); },30);
    if(GIPHY_KEY) gifSearch("trending");
  }
  let gifTimer=null;
  async function gifSearch(q){
    if(!GIPHY_KEY) return;
    const res=document.getElementById("gifResults");
    try{
      const url=(q==="trending")
        ? ("https://api.giphy.com/v1/gifs/trending?api_key="+encodeURIComponent(GIPHY_KEY)+"&limit=18&rating=pg-13")
        : ("https://api.giphy.com/v1/gifs/search?api_key="+encodeURIComponent(GIPHY_KEY)+"&q="+encodeURIComponent(q)+"&limit=18&rating=pg-13");
      const r=await fetch(url); const j=await r.json();
      const items=(j.data||[]);
      if(!items.length){ res.innerHTML='<div class="insight">No GIFs found.</div>'; return; }
      res.innerHTML=items.map(function(g){ var u=(g.images&&g.images.fixed_width&&g.images.fixed_width.url)||""; var full=(g.images&&g.images.downsized&&g.images.downsized.url)||u; return u?('<img class="gifres" src="'+escapeAttr(u)+'" data-gif="'+escapeAttr(full)+'"/>'):""; }).join("");
      Array.prototype.forEach.call(res.querySelectorAll("[data-gif]"),function(im){ im.onclick=function(){ pickGif(im.getAttribute("data-gif")); }; });
    }catch(e){ res.innerHTML='<div class="insight">GIF search failed.</div>'; }
  }
  function pickGif(url){
    document.getElementById("gifModal").style.display="none";
    if(!url) return;
    if(gifTarget==="dm"){ sendMessage(activeConvo,{gif_url:url}); }
    else if(gifTarget==="comment" && activeCard){ addComment(activeCard,url); }
    gifTarget=null;
  }
  function isImgUrl(u){ return /^https?:\\/\\/\\S+\\.(gif|png|jpe?g|webp)(\\?\\S*)?$/i.test(u||"") || /giphy\\.com|tenor\\.com|media\\d?\\.giphy/i.test(u||""); }

  // ---------- PRICE CHART (from recent sales) ----------
  function buildSalesChart(sales){
    var pts=[];
    sales.forEach(function(s){
      if(typeof s.price!=="number" || s.price_confirmed===false) return;
      var t=s.sale_date?Date.parse(s.sale_date):NaN;
      pts.push({t:(isNaN(t)?null:t), p:s.price});
    });
    pts=pts.filter(function(x){return x.p>0;});
    if(pts.length>=2 && pts.every(function(x){return x.t!=null;})){ pts.sort(function(a,b){return a.t-b.t;}); }
    else { pts=pts.slice().reverse(); pts.forEach(function(x,i){ x.t=i; }); }
    if(pts.length<2) return null;
    var W=600,H=180,padL=8,padR=8,padT=14,padB=18;
    var xs=pts.map(function(p){return p.t;}), ps=pts.map(function(p){return p.p;});
    var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs);
    var minP=Math.min.apply(null,ps), maxP=Math.max.apply(null,ps);
    if(maxX===minX) maxX=minX+1;
    var spanP=(maxP-minP)||1;
    var sx=function(x){ return padL+(x-minX)/(maxX-minX)*(W-padL-padR); };
    var sy=function(p){ return padT+(1-(p-minP)/spanP)*(H-padT-padB); };
    var line="",area="";
    pts.forEach(function(p,i){ var X=sx(p.t).toFixed(1), Y=sy(p.p).toFixed(1); line+=(i?" L":"M")+X+" "+Y; });
    area="M"+sx(pts[0].t).toFixed(1)+" "+(H-padB)+" L"+line.slice(1)+" L"+sx(pts[pts.length-1].t).toFixed(1)+" "+(H-padB)+" Z";
    var dots=pts.map(function(p){ return '<circle cx="'+sx(p.t).toFixed(1)+'" cy="'+sy(p.p).toFixed(1)+'" r="2.4" fill="#6d5cff"/>'; }).join("");
    var first=pts[0].p, last=pts[pts.length-1].p; var up=last>=first;
    var datelbl="";
    if(pts[0].t>100000){ var d1=new Date(minX), d2=new Date(maxX); var fmt=function(d){return (d.getMonth()+1)+"/"+d.getDate();}; datelbl='<text x="'+padL+'" y="'+(H-4)+'" fill="#565a73" font-size="11">'+fmt(d1)+'</text><text x="'+(W-padR)+'" y="'+(H-4)+'" fill="#565a73" font-size="11" text-anchor="end">'+fmt(d2)+'</text>'; }
    return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:180px">'+
      '<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(up?"#2bd673":"#ff5d6c")+'" stop-opacity="0.28"/><stop offset="1" stop-color="'+(up?"#2bd673":"#ff5d6c")+'" stop-opacity="0"/></linearGradient></defs>'+
      '<path d="'+area+'" fill="url(#pg)"/>'+
      '<path d="'+line+'" fill="none" stroke="'+(up?"#2bd673":"#ff5d6c")+'" stroke-width="2"/>'+
      dots+
      '<text x="'+padL+'" y="12" fill="#8a8ea8" font-size="11">'+money(maxP)+'</text>'+
      '<text x="'+padL+'" y="'+(H-padB-2)+'" fill="#8a8ea8" font-size="11">'+money(minP)+'</text>'+
      datelbl+
      '</svg>';
  }
  function saleRowMini(s){
    const g=(s.grader&&s.grade)?(s.grader+" "+s.grade):(s.grade?("Grade "+s.grade):"Raw/Ungraded");
    const img=s.thumbnail_url||s.image_url||"";
    const link=s.listing_url||"#";
    const pend=s.price_confirmed===false;
    return '<div class="sale"'+(pend?' style="opacity:.7"':'')+'>'+
      (img?('<img src="'+escapeAttr(img)+'" alt="" loading="lazy"/>'):('<div style="width:38px;height:53px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
      '<div class="t"><a href="'+escapeAttr(link)+'" target="_blank" rel="noopener">'+escapeHtml(s.title||"Listing")+'</a>'+
      '<div class="meta">'+escapeHtml(s.sale_date||"")+' · '+escapeHtml(g)+' · '+escapeHtml(s.platform||"")+(pend?" · pending":"")+'</div></div>'+
      '<div class="p">'+money(s.price)+'</div></div>';
  }
  async function renderCardMarket(h){
    const el=document.getElementById("cChart"); if(!el) return;
    el.innerHTML='<div class="card"><label>MARKET &amp; RECENT SALES</label><div class="insight">Loading recent sales…</div></div>';
    let sales=[]; let sourceLabel="The Card API";
    try{ const res=await fetch("/api?q="+encodeURIComponent(h.query)+"&limit=50&sort=date_desc"); const j=await res.json(); sales=j.data||[]; }catch(e){}
    if(!sales.filter(function(s){return typeof s.price==="number";}).length){
      const comps=await fetchComps(h.query);
      if(comps.length){ sales=comps; sourceLabel="eBay sold (via SoldComps)"; }
    }
    const withPrice=sales.filter(function(s){return typeof s.price==="number";});
    const confirmed=withPrice.filter(function(s){return s.price_confirmed!==false;});
    const basis=confirmed.length?confirmed:withPrice;
    const prices=basis.map(function(s){return s.price;});
    const sm=summarize(sales);
    const last=basis[0];
    const hi=prices.length?Math.max.apply(null,prices):0;
    const lo=prices.length?Math.min.apply(null,prices):0;
    const avg=prices.length?(prices.reduce(function(a,b){return a+b;},0)/prices.length):0;
    const svg=buildSalesChart(sales);
    if(!basis.length){
      const ownerVal=(h.manual_value!=null&&h.manual_value!=="")?Number(h.manual_value):(Number(h.added_value)||0);
      const guide=await fetchCatalogValue(h);
      let inner="";
      if(guide && guide.value){ inner='<div class="stats"><div class="stat hl"><div class="l">Price guide</div><div class="v">'+money(guide.value)+'</div></div>'+(ownerVal?('<div class="stat"><div class="l">Saved value</div><div class="v">'+money(ownerVal)+'</div></div>'):"")+'</div><div class="insight" style="margin-top:10px">No live sold listings found, so this shows the <b>'+escapeHtml(guide.name||"")+'</b> price-guide value for this grade (SportsCardsPro). Saved value is what you set.</div>'; }
      else if(ownerVal){ inner='<div class="stats"><div class="stat hl"><div class="l">Saved value</div><div class="v">'+money(ownerVal)+'</div></div></div><div class="insight" style="margin-top:10px">No marketplace sales found for this card in our data sources yet — niche cards and 1-of-1 parallels often aren\\'t indexed. Your saved value is used across the app.</div>'; }
      else { inner='<div class="insight" style="margin-top:10px">No marketplace sales found for this card in our data sources yet.</div>'; }
      el.innerHTML='<div class="card"><label>MARKET &amp; RECENT SALES</label>'+inner+'</div>';
      if(h.cert) loadPopulation(h.cert);
      return;
    }
    const stats='<div class="stats">'+
      '<div class="stat hl"><div class="l">Last sold</div><div class="v">'+(last?money(last.price):"\u2014")+'</div></div>'+
      '<div class="stat"><div class="l">Last sale date</div><div class="v" style="font-size:13px">'+escapeHtml(last&&last.sale_date?last.sale_date:"\u2014")+'</div></div>'+
      '<div class="stat"><div class="l">Median</div><div class="v">'+(sm.median?money(sm.median):"\u2014")+'</div></div>'+
      '<div class="stat"><div class="l">Average</div><div class="v">'+(avg?money(avg):"\u2014")+'</div></div>'+
      '<div class="stat"><div class="l">Sales</div><div class="v">'+(basis.length||0)+'</div></div>'+
      '<div class="stat"><div class="l">Range</div><div class="v" style="font-size:13px">'+(prices.length?(money(lo)+"–"+money(hi)):"\u2014")+'</div></div>'+
      '</div>';
    const chartHtml=svg?('<div style="margin-top:12px">'+svg+'</div>')
      :('<div class="insight" style="margin-top:10px">'+(basis.length===1?("Only one sale so far ("+money(basis[0].price)+(basis[0].sale_date?(" on "+escapeHtml(basis[0].sale_date)):"")+") — need at least two to draw a trend line."):"No recent confirmed sales found.")+'</div>');
    const list=basis.slice(0,12).map(saleRowMini).join("");
    el.innerHTML='<div class="card"><label>MARKET &amp; RECENT SALES</label>'+stats+chartHtml+
      (list?('<div style="margin-top:10px"><div class="insight" style="margin-bottom:4px">Recent sold listings · source: '+escapeHtml(sourceLabel)+'</div>'+list+'</div>'):"")+'</div>';
    if(h.cert) loadPopulation(h.cert);
  }
  async function loadPopulation(cert){
    const el=document.getElementById("cPop"); if(!el) return;
    el.innerHTML='<div class="card"><label>PSA POPULATION</label><div class="insight">Loading population report…</div></div>';
    try{
      const r=await fetch("/cert?n="+encodeURIComponent((""+cert).replace(/[^0-9]/g,"")));
      if(!r.ok){ el.innerHTML=""; return; }
      const data=await r.json();
      const c=(data&&(data.PSACert||data.cert))||data||{};
      const total=c.TotalPopulation, higher=c.PopulationHigher;
      if(total==null && higher==null){ el.innerHTML=""; return; }
      el.innerHTML='<div class="card"><label>PSA POPULATION · CERT '+escapeHtml(""+cert)+'</label><div class="stats">'+
        '<div class="stat hl"><div class="l">At this grade</div><div class="v">'+escapeHtml(total!=null?String(total):"\u2014")+'</div></div>'+
        '<div class="stat"><div class="l">Graded higher</div><div class="v">'+escapeHtml(higher!=null?String(higher):"\u2014")+'</div></div>'+
        '</div><div class="insight" style="margin-top:8px">Population data from PSA. Other graders (BGS, SGC, CGC, TAG) aren\\'t available via API yet.</div></div>';
    }catch(e){ el.innerHTML=""; }
  }

  // ---------- CARD DETAIL ----------
  async function openCard(id,skipPush){
    activeCard=id; view="card"; applyView(); renderNav();
    if(!skipPush){ try{ history.pushState({view:"card",id:id},"","/card/"+id); }catch(e){} }
    window.scrollTo(0,0);
    const body=document.getElementById("cardBody");
    if(!sb){ body.innerHTML='<div class="err">Accounts need to be configured for card pages.</div>'; return; }
    body.innerHTML='<div class="card">Loading card…</div>';
    const hr=await sb.from("holdings").select("*").eq("id",id).maybeSingle();
    if(hr.error||!hr.data){ body.innerHTML='<div class="card"><h1 style="font-size:24px">Card not found</h1><p class="sub">It may be private or removed.</p></div>'; return; }
    const h=hr.data;
    const mine=currentSession && h.user_id===currentSession.user.id;
    const op=await sb.from("profiles").select("id,handle,display_name,avatar_url").eq("id",h.user_id).maybeSingle();
    const owner=op.data||{handle:"collector"};
    const sm=await valueHolding(h);
    const ph=await sb.from("card_photos").select("*").eq("holding_id",id).order("created_at",{ascending:true});
    const photos=[]; if(h.image_url) photos.push(h.image_url); (ph.data||[]).forEach(function(x){ if(photos.indexOf(x.url)<0) photos.push(x.url); });
    let likeCount=0, iLike=false;
    try{ const lc=await sb.from("card_likes").select("user_id",{count:"exact"}).eq("holding_id",id); likeCount=lc.count||0; if(currentSession){ iLike=(lc.data||[]).some(function(x){return x.user_id===currentSession.user.id;}); } }catch(e){}
    const tags=(h.sold?'<span class="badge" style="color:var(--dim);border:1px solid var(--dim)">SOLD</span>':((h.for_sale?'<span class="badge sale">FOR SALE</span>':"")+(h.for_trade?'<span class="badge trade">TRADE</span>':"")));
    let actions="";
    if(!mine && currentSession && !h.sold){
      if(h.for_sale && h.ask_price!=null) actions+='<button class="miniadd" id="cBuy">Buy '+money(h.ask_price)+'</button> ';
      if(h.for_sale && h.accept_offers!==false) actions+='<button class="authbtn primary" id="cOffer">Make offer</button> ';
      if(h.for_trade) actions+='<button class="authbtn" id="cTrade">Propose trade</button> ';
      actions+='<button class="authbtn" id="cMsg">Message</button>';
    } else if(mine){ actions+='<button class="authbtn" id="cAddPhoto">+ Add photo</button> <input type="file" id="cPhotoFile" accept="image/*" style="display:none"/> <button class="authbtn" id="cSell">'+((h.for_sale||h.for_trade)?"Edit listing":"Sell/Trade")+'</button>'; }
    const gallery=photos.length?('<div class="cgallery">'+photos.map(function(u){return '<img src="'+escapeAttr(u)+'" onerror="this.remove()"/>';}).join("")+'</div>'):'<div class="insight">No image yet.</div>';
    body.innerHTML='<div class="card">'+gallery+
      '<h1 style="font-size:23px;margin-top:14px">'+escapeHtml(h.title||h.query)+tags+'</h1>'+
      '<div class="insight" style="margin-top:4px">'+escapeHtml(h.grade||"")+' · listed by <span id="cOwner" style="color:var(--indigo);cursor:pointer">@'+escapeHtml(owner.handle)+'</span></div>'+
      '<div class="mono" style="font-size:22px;font-weight:700;margin-top:10px">'+money(sm.current)+'<span style="font-size:12px;color:var(--dim);font-weight:400"> · est. value</span></div>'+
      (h.ask_price!=null?('<div class="insight">Asking '+money(h.ask_price)+(h.sale_note?(' \u2014 '+escapeHtml(h.sale_note)):"")+'</div>'):"")+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px"><button class="likebtn'+(iLike?" on":"")+'" id="cLike">\u2665 <span id="cLikeN">'+likeCount+'</span></button> '+actions+'</div>'+
      '</div>'+
      '<div id="cChart"></div>'+
      '<div id="cPop"></div>'+
      '<div class="card"><label>COMMENTS</label><div id="cComments">Loading…</div>'+
      (currentSession?('<div class="composer"><input id="cCommentInput" placeholder="Add a comment…"/><button class="gifbtn" id="cGif">GIF</button><button class="authbtn primary" id="cCommentSend">Post</button></div>'):'<div class="insight" style="margin-top:10px">Sign in to comment.</div>')+
      '</div>';
    document.getElementById("cOwner").onclick=function(){ if(owner.handle) viewProfile(owner.handle); };
    var ownB=document.getElementById("cOwner");
    var lb=document.getElementById("cLike");
    if(lb) lb.onclick=async function(){
      if(!currentSession){ alert("Sign in to like cards."); return; }
      lb.disabled=true;
      if(iLike){ const d=await sb.from("card_likes").delete().eq("holding_id",id).eq("user_id",currentSession.user.id); if(!d.error){ iLike=false; likeCount=Math.max(0,likeCount-1); lb.classList.remove("on"); } }
      else { const i=await sb.from("card_likes").insert({holding_id:id,user_id:currentSession.user.id}); if(!i.error){ iLike=true; likeCount++; lb.classList.add("on"); } }
      document.getElementById("cLikeN").textContent=likeCount; lb.disabled=false;
    };
    var bBuy=document.getElementById("cBuy"); if(bBuy) bBuy.onclick=function(){ h._profile=owner; openOfferModal(h,"buy_now"); };
    var bOffer=document.getElementById("cOffer"); if(bOffer) bOffer.onclick=function(){ h._profile=owner; openOfferModal(h,"offer"); };
    var bTrade=document.getElementById("cTrade"); if(bTrade) bTrade.onclick=function(){ h._profile=owner; openOfferModal(h,"trade"); };
    var bMsg=document.getElementById("cMsg"); if(bMsg) bMsg.onclick=function(){ startConversation(h.user_id, owner.handle); };
    var bSell=document.getElementById("cSell"); if(bSell) bSell.onclick=function(){ openSellModal(h); };
    var bAdd=document.getElementById("cAddPhoto"); var pf=document.getElementById("cPhotoFile");
    if(bAdd&&pf){ bAdd.onclick=function(){ pf.click(); }; pf.onchange=function(e){ uploadCardPhoto(e,id); }; }
    var cg=document.getElementById("cGif"); if(cg) cg.onclick=function(){ openGifPicker("comment"); };
    var cs=document.getElementById("cCommentSend"); if(cs) cs.onclick=function(){ var inp=document.getElementById("cCommentInput"); addComment(id,null,inp?inp.value:""); };
    var ci=document.getElementById("cCommentInput"); if(ci) ci.addEventListener("keydown",function(e){ if(e.key==="Enter") addComment(id,null,ci.value); });
    renderCardMarket(h);
    loadComments(id, h);
  }
  async function uploadCardPhoto(e,holdingId){
    const file=e.target.files&&e.target.files[0]; if(!file||!currentSession) return;
    try{
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
      const path=currentSession.user.id+"/"+holdingId+"_"+Date.now()+"."+ext;
      const up=await withTimeout(sb.storage.from("cards").upload(path,file,{upsert:true,cacheControl:"3600"}),30000,"Upload");
      if(up.error){ alert("Upload failed: "+up.error.message); return; }
      const url=sb.storage.from("cards").getPublicUrl(path).data.publicUrl;
      const ins=await sb.from("card_photos").insert({holding_id:holdingId,user_id:currentSession.user.id,url:url});
      if(ins.error){ alert("Could not save photo: "+ins.error.message); return; }
      // If the card has no stock image, use this upload as its primary image so it
      // appears as the thumbnail across profile/portfolio/market/feed.
      try{ const hr=await sb.from("holdings").select("image_url").eq("id",holdingId).maybeSingle(); if(hr.data && !hr.data.image_url){ await sb.from("holdings").update({image_url:url}).eq("id",holdingId); } }catch(e){}
      openCard(holdingId,true);
    }catch(err){ alert("Upload failed."); }
  }
  async function loadComments(id,h){
    const el=document.getElementById("cComments"); if(!el) return;
    const r=await sb.from("card_comments").select("*").eq("holding_id",id).order("created_at",{ascending:true}).limit(200);
    const rows=r.data||[];
    if(!rows.length){ el.innerHTML='<div class="insight">No comments yet. Be the first.</div>'; return; }
    const ids=[]; rows.forEach(function(c){ if(ids.indexOf(c.user_id)<0) ids.push(c.user_id); });
    let profs={}; const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",ids); (pr.data||[]).forEach(function(p){ profs[p.id]=p; });
    let html="";
    rows.forEach(function(c,idx){
      const p=profs[c.user_id]||{handle:"collector"};
      const mine=currentSession && c.user_id===currentSession.user.id;
      html+='<div class="cmt">'+avatarHtml(p)+'<div class="cbody"><div class="cn" data-h="'+escapeAttr(p.handle)+'">'+escapeHtml(p.display_name||("@"+p.handle))+'</div>'+
        (c.body?('<div class="ct">'+escapeHtml(c.body)+'</div>'):"")+
        (c.gif_url?('<img src="'+escapeAttr(c.gif_url)+'" onerror="this.remove()"/>'):"")+
        '</div>'+(mine?('<button class="rm" data-del="'+c.id+'">\u00d7</button>'):"")+'</div>';
    });
    el.innerHTML=html;
    Array.prototype.forEach.call(el.querySelectorAll(".cn[data-h]"),function(s){ var hh=s.getAttribute("data-h"); if(hh) s.onclick=function(){ viewProfile(hh); }; });
    Array.prototype.forEach.call(el.querySelectorAll("[data-del]"),function(b){ b.onclick=async function(){ await sb.from("card_comments").delete().eq("id",b.getAttribute("data-del")); loadComments(id,h); }; });
  }
  async function addComment(id,gifUrl,text){
    if(!currentSession){ alert("Sign in to comment."); return; }
    const body=(text||"").trim();
    if(!body && !gifUrl) return;
    const payload={holding_id:id,user_id:currentSession.user.id,body:body||null,gif_url:gifUrl||null};
    const inp=document.getElementById("cCommentInput"); if(inp) inp.value="";
    const r=await sb.from("card_comments").insert(payload);
    if(r.error){ alert("Could not post: "+r.error.message); return; }
    loadComments(id);
  }

  // ---------- MESSAGING ----------
  function otherId(m){ return m.sender_id===currentSession.user.id ? m.recipient_id : m.sender_id; }
  async function refreshUnread(){
    if(!sb || !currentSession){ unreadCount=0; return; }
    try{
      const r=await sb.from("messages").select("id",{count:"exact",head:true}).eq("recipient_id",currentSession.user.id).is("read_at",null);
      unreadCount=r.count||0;
    }catch(e){ unreadCount=0; }
  }
  function initMessaging(){
    if(!sb || !currentSession) return;
    setTimeout(async function(){ try{ await refreshUnread(); renderNav(); }catch(e){} },0);
    try{
      if(msgChannel){ sb.removeChannel(msgChannel); msgChannel=null; }
      msgChannel=sb.channel("dm_"+currentSession.user.id)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"recipient_id=eq."+currentSession.user.id},function(payload){
          if(view==="messages" && activeConvo && payload.new && payload.new.sender_id===activeConvo){ openConversation(activeConvo,true); }
          else { unreadCount=unreadCount+1; renderNav(); }
        }).subscribe();
    }catch(e){}
  }
  async function startConversation(userId,handle){
    if(!currentSession){ alert("Sign in to send messages."); return; }
    if(userId===currentSession.user.id){ return; }
    view="messages"; activeConvo=userId; applyView(); renderNav();
    try{ history.pushState({view:"messages"},"","/messages"); }catch(e){}
    window.scrollTo(0,0);
    openConversation(userId,false,handle);
  }
  async function loadConversations(){
    const wrap=document.getElementById("msgWrap");
    activeConvo=null;
    document.getElementById("msgSub").textContent="Your conversations with other collectors.";
    wrap.innerHTML='<div class="card">Loading conversations…</div>';
    const r=await sb.from("messages").select("*").or("sender_id.eq."+currentSession.user.id+",recipient_id.eq."+currentSession.user.id).order("created_at",{ascending:false}).limit(400);
    if(r.error){ wrap.innerHTML='<div class="err"><b>Could not load messages.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const msgs=r.data||[];
    const byUser={}; const order=[];
    msgs.forEach(function(m){ const o=otherId(m); if(!byUser[o]){ byUser[o]={last:m,unread:0}; order.push(o); } if(m.recipient_id===currentSession.user.id && !m.read_at) byUser[o].unread++; });
    if(!order.length){ wrap.innerHTML='<div class="card">No messages yet. Visit a collector\\'s profile or a marketplace card and tap <b>Message</b> to start a conversation.</div>'; return; }
    let profs={};
    const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",order);
    (pr.data||[]).forEach(function(p){ profs[p.id]=p; });
    let rows="";
    order.forEach(function(o){
      const p=profs[o]||{handle:"collector"}; const c=byUser[o];
      rows+='<div class="convo" data-uid="'+o+'">'+avatarHtml(p)+
        '<div class="cmeta"><div class="cn">'+escapeHtml(p.display_name||("@"+p.handle))+(c.unread?' <span class="navbadge">'+c.unread+'</span>':"")+'</div>'+
        '<div class="cp">'+escapeHtml((c.last.sender_id===currentSession.user.id?"You: ":"")+(c.last.body||"(card / offer)"))+'</div></div>'+
        (c.unread?'<div class="dot"></div>':'')+'</div>';
    });
    wrap.innerHTML='<div class="card"><label>CONVERSATIONS</label>'+rows+'</div>';
    Array.prototype.forEach.call(wrap.querySelectorAll(".convo"),function(c){ c.onclick=function(){ openConversation(c.getAttribute("data-uid")); }; });
  }
  async function openConversation(userId,keepScroll,handleHint){
    activeConvo=userId;
    const wrap=document.getElementById("msgWrap");
    const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").eq("id",userId).maybeSingle();
    const p=pr.data||{handle:handleHint||"collector",id:userId};
    document.getElementById("msgSub").textContent="";
    const r=await sb.from("messages").select("*").or("and(sender_id.eq."+currentSession.user.id+",recipient_id.eq."+userId+"),and(sender_id.eq."+userId+",recipient_id.eq."+currentSession.user.id+")").order("created_at",{ascending:true}).limit(300);
    const msgs=(r.data||[]);
    // gather referenced offers
    const offerIds=[]; msgs.forEach(function(m){ if(m.offer_id && offerIds.indexOf(m.offer_id)<0) offerIds.push(m.offer_id); });
    let offers={};
    if(offerIds.length){ const orr=await sb.from("offers").select("*").in("id",offerIds); (orr.data||[]).forEach(function(o){ offers[o.id]=o; }); }
    let bubbles="";
    msgs.forEach(function(m){
      const mine=m.sender_id===currentSession.user.id;
      if(m.offer_id && offers[m.offer_id]){
        const o=offers[m.offer_id];
        const kindLbl=o.kind==="buy_now"?"Buy-now request":(o.kind==="trade"?"Trade proposal":"Offer");
        const canAct=(o.seller_id===currentSession.user.id && o.status==="pending");
        bubbles+='<div class="offercard"><div style="font-size:11px;color:var(--dim)">'+escapeHtml(kindLbl)+' · '+escapeHtml(o.status)+'</div>'+
          (o.amount?('<div class="oa">'+money(o.amount)+'</div>'):"")+
          (m.body?('<div style="margin-top:4px">'+escapeHtml(m.body)+'</div>'):"")+
          (canAct?('<div class="obtns"><button class="authbtn primary" data-acc="'+o.id+'">Accept</button><button class="authbtn" data-dec="'+o.id+'">Decline</button></div>'):"")+
          '</div>';
      } else {
        bubbles+='<div class="bubble '+(mine?"me":"them")+'">'+(m.body?escapeHtml(m.body):"")+(m.gif_url?('<img src="'+escapeAttr(m.gif_url)+'" onerror="this.remove()"/>'):"")+'<div class="bt">'+escapeHtml((m.created_at||"").slice(5,16).replace("T"," "))+'</div></div>';
      }
    });
    if(!bubbles) bubbles='<div class="insight">No messages yet — say hello.</div>';
    wrap.innerHTML='<div class="card"><div style="display:flex;align-items:center;gap:10px"><button class="authbtn" id="backConvos">\u2190</button>'+avatarHtml(p)+
      '<div style="flex:1"><div style="font-weight:700;cursor:pointer" id="convoName">'+escapeHtml(p.display_name||("@"+p.handle))+'</div><div style="font-size:11px;color:var(--dim)">@'+escapeHtml(p.handle||"")+'</div></div></div>'+
      '<div class="thread" id="thread">'+bubbles+'</div>'+
      '<div class="composer"><input id="msgInput" placeholder="Write a message…"/><button class="gifbtn" id="msgGif">GIF</button><button class="authbtn primary" id="msgSend">Send</button></div></div>';
    const th=document.getElementById("thread"); if(th) th.scrollTop=th.scrollHeight;
    document.getElementById("backConvos").onclick=function(){ loadConversations(); };
    document.getElementById("convoName").onclick=function(){ if(p.handle) viewProfile(p.handle); };
    document.getElementById("msgSend").onclick=function(){ sendMessage(userId); };
    document.getElementById("msgGif").onclick=function(){ openGifPicker("dm"); };
    document.getElementById("msgInput").addEventListener("keydown",function(e){ if(e.key==="Enter") sendMessage(userId); });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-acc]"),function(b){ b.onclick=function(){ respondOffer(b.getAttribute("data-acc"),"accepted",userId); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-dec]"),function(b){ b.onclick=function(){ respondOffer(b.getAttribute("data-dec"),"declined",userId); }; });
    // mark incoming as read
    try{ await sb.from("messages").update({read_at:new Date().toISOString()}).eq("recipient_id",currentSession.user.id).eq("sender_id",userId).is("read_at",null); await refreshUnread(); renderNav(); }catch(e){}
  }
  async function sendMessage(userId,extra){
    const inp=document.getElementById("msgInput");
    const body=inp?inp.value.trim():"";
    if(!body && !(extra&&(extra.offer_id||extra.gif_url))) return;
    const payload=Object.assign({ sender_id:currentSession.user.id, recipient_id:userId, body:body||null }, extra||{});
    if(inp){ inp.value=""; inp.disabled=true; }
    const r=await sb.from("messages").insert(payload);
    if(inp){ inp.disabled=false; inp.focus(); }
    if(r.error){ alert("Could not send: "+r.error.message); return; }
    openConversation(userId,true);
  }
  async function respondOffer(offerId,status,userId){
    const u=await sb.from("offers").update({status:status}).eq("id",offerId);
    if(u.error){ alert("Could not update offer: "+u.error.message); return; }
    let body=(status==="accepted")?"\u2705 Offer accepted — let's arrange the details.":"\u274c Offer declined.";
    if(status==="accepted"){
      try{ const o=await sb.from("offers").select("holding_id").eq("id",offerId).maybeSingle(); if(o.data&&o.data.holding_id){ await sb.from("holdings").update({sold:true,for_sale:false,for_trade:false}).eq("id",o.data.holding_id); } }catch(e){}
    }
    await sb.from("messages").insert({ sender_id:currentSession.user.id, recipient_id:userId, body:body, offer_id:offerId });
    openConversation(userId,true);
  }

  // ---------- MARKETPLACE ----------
  function openSellModal(h){
    pendingSell=h;
    document.getElementById("sellTitle").textContent=h.title||h.query;
    document.getElementById("sellFor").checked=!!h.for_sale;
    document.getElementById("sellTrade").checked=!!h.for_trade;
    document.getElementById("sellOffers").checked=(h.accept_offers!==false);
    document.getElementById("sellPrice").value=(h.ask_price!=null?h.ask_price:"");
    document.getElementById("sellNote").value=h.sale_note||"";
    document.getElementById("sellModal").style.display="flex";
  }
  async function saveSell(remove){
    if(!pendingSell){ document.getElementById("sellModal").style.display="none"; return; }
    let payload;
    if(remove){ payload={for_sale:false,for_trade:false,ask_price:null,sale_note:null}; }
    else {
      const forSale=document.getElementById("sellFor").checked;
      const forTrade=document.getElementById("sellTrade").checked;
      const priceRaw=(document.getElementById("sellPrice").value||"").replace(/[^0-9.]/g,"");
      const price=priceRaw!==""?Number(priceRaw):null;
      payload={ for_sale:forSale, for_trade:forTrade, accept_offers:document.getElementById("sellOffers").checked,
        ask_price:(price!=null&&!isNaN(price))?price:null, sale_note:document.getElementById("sellNote").value.trim()||null, sold:false };
      if(forSale||forTrade){ payload.is_public=true; }
    }
    const u=await sb.from("holdings").update(payload).eq("id",pendingSell.id);
    document.getElementById("sellModal").style.display="none"; pendingSell=null;
    if(u.error){ alert("Could not update listing: "+u.error.message); return; }
    if(view==="portfolio") loadPortfolio();
  }
  async function marketHoldings(filter){
    let qb=sb.from("holdings").select("*").eq("is_public",true).eq("sold",false).order("added_at",{ascending:false}).limit(60);
    if(filter==="sale") qb=qb.eq("for_sale",true);
    else if(filter==="trade") qb=qb.eq("for_trade",true);
    else qb=qb.or("for_sale.eq.true,for_trade.eq.true");
    const r=await qb;
    const rows=r.data||[];
    const ids=[]; rows.forEach(function(h){ if(h.user_id && ids.indexOf(h.user_id)<0) ids.push(h.user_id); });
    let profs={};
    if(ids.length){ const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",ids); (pr.data||[]).forEach(function(p){ profs[p.id]=p; }); }
    rows.forEach(function(h){ h._profile=profs[h.user_id]||null; });
    await fillThumbs(rows);
    return rows;
  }
  async function loadMarket(){
    const wrap=document.getElementById("mktWrap");
    wrap.innerHTML='<div class="card">Loading the marketplace…</div>';
    Array.prototype.forEach.call(document.querySelectorAll("#mktTabs button"),function(b){ b.classList.toggle("on", b.getAttribute("data-mkt")===mktFilter); });
    let rows;
    try{ rows=await marketHoldings(mktFilter); }catch(e){ wrap.innerHTML='<div class="err">Could not load the marketplace.</div>'; return; }
    if(!rows.length){ wrap.innerHTML='<div class="card">No cards listed yet. List one of your own from <b>Portfolio</b> → <b>Sell/Trade</b>.</div>'; return; }
    let cards="";
    rows.forEach(function(h,idx){
      const p=h._profile; const seller=p?("@"+p.handle):"a collector";
      const mine=currentSession && h.user_id===currentSession.user.id;
      const img=thumbOf(h);
      const tags=(h.for_sale?'<span class="badge sale">FOR SALE</span>':"")+(h.for_trade?'<span class="badge trade">TRADE</span>':"");
      let acts="";
      if(mine){ acts='<button data-edit="'+idx+'">Edit listing</button>'; }
      else if(currentSession){
        if(h.for_sale && h.ask_price!=null) acts+='<button class="buy" data-buy="'+idx+'">Buy '+money(h.ask_price)+'</button>';
        if(h.for_sale && h.accept_offers!==false) acts+='<button class="offer" data-offer="'+idx+'">Make offer</button>';
        if(h.for_trade) acts+='<button data-trade="'+idx+'">Propose trade</button>';
        acts+='<button data-msg="'+idx+'">Message</button>';
      } else { acts='<button data-signin="1">Sign in to buy</button>'; }
      cards+='<div class="mktcard">'+
        (img?('<img src="'+escapeAttr(img)+'" data-card="'+h.id+'" style="cursor:pointer" onerror="this.style.display=\\'none\\'"/>'):'')+
        '<div class="nm" data-card="'+h.id+'" style="cursor:pointer">'+escapeHtml(h.title||h.query)+tags+'</div>'+
        '<div class="seller" data-h="'+(p?escapeAttr(p.handle):"")+'">'+escapeHtml(seller)+'</div>'+
        (h.ask_price!=null?('<div class="ask">'+money(h.ask_price)+'</div>'):'<div class="ask" style="color:var(--muted);font-size:13px">Open to offers</div>')+
        (h.sale_note?('<div class="insight" style="margin-top:6px">'+escapeHtml(h.sale_note)+'</div>'):"")+
        '<div class="acts">'+acts+'</div></div>';
    });
    wrap.innerHTML='<div class="mkt">'+cards+'</div>';
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-card]"),function(s){ s.onclick=function(){ openCard(s.getAttribute("data-card")); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll(".seller[data-h]"),function(s){ var hh=s.getAttribute("data-h"); if(hh) s.onclick=function(){ viewProfile(hh); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-edit]"),function(b){ b.onclick=function(){ openSellModal(rows[Number(b.getAttribute("data-edit"))]); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-buy]"),function(b){ b.onclick=function(){ openOfferModal(rows[Number(b.getAttribute("data-buy"))],"buy_now"); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-offer]"),function(b){ b.onclick=function(){ openOfferModal(rows[Number(b.getAttribute("data-offer"))],"offer"); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-trade]"),function(b){ b.onclick=function(){ openOfferModal(rows[Number(b.getAttribute("data-trade"))],"trade"); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-msg]"),function(b){ b.onclick=function(){ var h=rows[Number(b.getAttribute("data-msg"))]; startConversation(h.user_id, h._profile&&h._profile.handle); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-signin]"),function(b){ b.onclick=function(){ alert("Sign in to buy, offer, or message."); }; });
  }
  function openOfferModal(h,kind){
    pendingOffer={holding:h,kind:kind};
    const t=document.getElementById("offerTitle"); const sub=document.getElementById("offerSub");
    const amt=document.getElementById("offerAmount"); const note=document.getElementById("offerNote");
    t.textContent=h.title||h.query;
    if(kind==="buy_now"){ sub.textContent="Buy it now at the seller's asking price."; amt.value=(h.ask_price!=null?h.ask_price:""); amt.style.display=""; note.placeholder="Add a message (optional)"; }
    else if(kind==="trade"){ sub.textContent="Propose a trade. Describe what you're offering."; amt.value=""; amt.style.display="none"; note.placeholder="What are you offering to trade?"; }
    else { sub.textContent="Make an offer to the seller."; amt.value=""; amt.style.display=""; note.placeholder="Add a message (optional)"; }
    document.getElementById("offerSend").textContent=(kind==="buy_now"?"Send buy request":(kind==="trade"?"Send proposal":"Send offer"));
    document.getElementById("offerModal").style.display="flex";
  }
  async function submitOffer(){
    if(!pendingOffer){ document.getElementById("offerModal").style.display="none"; return; }
    const h=pendingOffer.holding; const kind=pendingOffer.kind;
    const note=document.getElementById("offerNote").value.trim();
    let amount=null;
    if(kind!=="trade"){ const raw=(document.getElementById("offerAmount").value||"").replace(/[^0-9.]/g,""); amount=raw!==""?Number(raw):null; if(kind==="offer" && (amount==null||isNaN(amount))){ alert("Enter an offer amount."); return; } }
    const btn=document.getElementById("offerSend"); btn.disabled=true; btn.textContent="Sending…";
    const off=await sb.from("offers").insert({ holding_id:h.id, buyer_id:currentSession.user.id, seller_id:h.user_id, amount:(amount!=null&&!isNaN(amount))?amount:null, kind:kind, note:note||null }).select("id").maybeSingle();
    if(off.error||!off.data){ btn.disabled=false; btn.textContent="Send"; alert("Could not send: "+((off.error&&off.error.message)||"try again")); return; }
    const kindLbl=kind==="buy_now"?"Buy-now request":(kind==="trade"?"Trade proposal":"Offer");
    const body=kindLbl+" for "+(h.title||h.query)+(amount!=null?(" — "+money(amount)):"")+(note?(" — "+note):"");
    await sb.from("messages").insert({ sender_id:currentSession.user.id, recipient_id:h.user_id, body:body, holding_id:h.id, offer_id:off.data.id });
    document.getElementById("offerModal").style.display="none"; pendingOffer=null;
    btn.disabled=false; btn.textContent="Send";
    startConversation(h.user_id, h._profile&&h._profile.handle);
  }

  // ---------- LEADERBOARDS ----------
  async function loadLeaderboard(){
    const wrap=document.getElementById("lbWrap");
    const searchWrap=document.getElementById("lbSearchWrap");
    const hintEl=document.getElementById("lbSubjectHint");
    wrap.innerHTML='<div class="card">Crunching the rankings…</div>';
    Array.prototype.forEach.call(document.querySelectorAll("#lbTabs button"),function(b){ b.classList.toggle("on", b.getAttribute("data-lb")===lbTab); });
    if(searchWrap) searchWrap.style.display=(lbTab==="subject")?"flex":"none";
    if(hintEl) hintEl.style.display=(lbTab==="subject")?"":"none";
    if(lbTab==="subject"){
      const inp=document.getElementById("lbSubjectInput");
      const goBtn=document.getElementById("lbSubjectGo");
      if(goBtn && !goBtn._wired){ goBtn._wired=true; goBtn.onclick=function(){ runSubjectLeaderboard(); }; inp.addEventListener("keydown",function(e){ if(e.key==="Enter") runSubjectLeaderboard(); }); }
      const term=(inp?inp.value.trim():"");
      if(!term){ wrap.innerHTML='<div class="card" style="text-align:center;padding:32px 20px"><div style="font-size:36px;margin-bottom:12px">🏆</div><div style="font-size:16px;font-weight:700;margin-bottom:8px">Who owns the biggest collection?</div><div class="insight">Search any player, character, or set above — e.g. <b>Michael Jordan</b>, <b>Charizard</b>, <b>Shohei Ohtani</b>, or <b>Prizm Rookie</b>. See who has the most cards and the highest-valued PC.</div></div>'; return; }
      await runSubjectLeaderboard();
      return;
    }
    if(!sb){ wrap.innerHTML='<div class="card"><div class="insight">Accounts not configured.</div></div>'; return; }
    try{
      if(lbTab==="followers"){
        const fr=await sb.from("follows").select("following_id").limit(5000);
        const counts={}; (fr.data||[]).forEach(function(f){ counts[f.following_id]=(counts[f.following_id]||0)+1; });
        renderLeaderboard(counts,function(v){ return v+" follower"+(v===1?"":"s"); });
      } else {
        const hr=await sb.from("holdings").select("user_id,added_value,manual_value").eq("is_public",true).limit(5000);
        const agg={};
        (hr.data||[]).forEach(function(h){ if(!h.user_id) return; if(!agg[h.user_id]) agg[h.user_id]={val:0,cards:0}; const v=(h.manual_value!=null&&h.manual_value!=="")?Number(h.manual_value):Number(h.added_value)||0; agg[h.user_id].val+=(isNaN(v)?0:v); agg[h.user_id].cards++; });
        if(lbTab==="cards"){ const c={}; for(var k in agg){ c[k]=agg[k].cards; } renderLeaderboard(c,function(v){ return v+" card"+(v===1?"":"s"); }); }
        else { const c={}; for(var k2 in agg){ c[k2]=agg[k2].val; } renderLeaderboard(c,function(v){ return money(v); }); }
      }
    }catch(e){ wrap.innerHTML='<div class="err">Could not load leaderboards.</div>'; }
  }

  async function runSubjectLeaderboard(){
    const wrap=document.getElementById("lbWrap");
    const inp=document.getElementById("lbSubjectInput");
    const term=(inp?inp.value.trim():"");
    if(!term){ wrap.innerHTML='<div class="card">Type a player name, character, or set above.</div>'; return; }
    wrap.innerHTML='<div class="card">Finding the top <b>'+escapeHtml(term)+'</b> collectors…</div>';
    try{
      const hr=await sb.from("holdings").select("user_id,added_value,manual_value,title,query,image_url,grade,id").eq("is_public",true).or("title.ilike.%"+term+"%,query.ilike.%"+term+"%").limit(5000);
      const holds=hr.data||[];
      // Fill thumbs for image display
      try{ const need=holds.filter(function(h){return !h.image_url;}).map(function(h){return h.id;}); if(need.length){ const ph=await sb.from("card_photos").select("holding_id,url").in("holding_id",need).order("created_at",{ascending:true}); const byH={}; (ph.data||[]).forEach(function(x){if(!byH[x.holding_id])byH[x.holding_id]=x.url;}); holds.forEach(function(h){if(!h.image_url&&byH[h.id])h._thumb=byH[h.id];}); } }catch(e){}
      const agg={};
      holds.forEach(function(h){
        if(!h.user_id) return;
        if(!agg[h.user_id]) agg[h.user_id]={val:0,cards:0,imgs:[]};
        const v=(h.manual_value!=null&&h.manual_value!=="")?Number(h.manual_value):Number(h.added_value)||0;
        agg[h.user_id].val+=(isNaN(v)?0:v);
        agg[h.user_id].cards++;
        if(agg[h.user_id].imgs.length<3){ const img=h.image_url||h._thumb||""; if(img) agg[h.user_id].imgs.push(img); }
      });
      const arr=Object.keys(agg).map(function(k){return{id:k,val:agg[k].val,cards:agg[k].cards,imgs:agg[k].imgs};}).filter(function(x){return x.cards>0;}).sort(function(a,b){return b.cards-a.cards||b.val-a.val;}).slice(0,20);
      if(!arr.length){ wrap.innerHTML='<div class="card">No public collections found for "<b>'+escapeHtml(term)+'</b>". Collectors need to set their cards as public.</div>'; return; }
      const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url,bio").in("id",arr.map(function(x){return x.id;}));
      const profs={}; (pr.data||[]).forEach(function(p){profs[p.id]=p;});
      const medals=["🥇","🥈","🥉"];
      let rows="";
      arr.forEach(function(x,i){
        const p=profs[x.id]; if(!p) return;
        const medal=medals[i]||(""+( i+1));
        const isMedal=i<3;
        const cardPreview=x.imgs.length?('<div class="lbrow-cards">'+x.imgs.map(function(u){return '<img src="'+escapeAttr(u)+'" onerror="this.remove()"/>';}).join("")+'</div>'):"";
        rows+='<div class="lbrow" style="flex-wrap:nowrap;align-items:flex-start">'+
          '<div style="font-size:'+(isMedal?"18px":"13px")+';width:28px;text-align:center;flex-shrink:0;padding-top:2px">'+escapeHtml(medal)+'</div>'+
          avatarHtml(p)+
          '<div style="flex:1;min-width:0">'+
            '<div class="nm" data-h="'+escapeAttr(p.handle)+'" style="cursor:pointer">'+escapeHtml(p.display_name||("@"+p.handle))+'</div>'+
            '<div style="font-size:11px;color:var(--muted);margin-top:1px">'+escapeHtml(x.cards)+' card'+(x.cards===1?"":"s")+' · '+money(x.val)+(p.bio?(' · '+escapeHtml(p.bio.slice(0,40))+(p.bio.length>40?"…":"")):"")+'</div>'+
            cardPreview+
          '</div>'+
          '<button class="authbtn" data-h="'+escapeAttr(p.handle)+'" style="font-size:11px;flex-shrink:0;align-self:flex-start">View PC</button>'+
        '</div>';
      });
      wrap.innerHTML='<div class="card"><div style="font-size:13px;color:var(--muted);margin-bottom:14px">Top collectors of <b style="color:var(--text)">'+escapeHtml(term)+'</b> · ranked by card count</div>'+rows+'</div>';
      Array.prototype.forEach.call(wrap.querySelectorAll(".nm[data-h]"),function(s){ var hh=s.getAttribute("data-h"); if(hh) s.onclick=function(){ viewProfile(hh); }; });
      Array.prototype.forEach.call(wrap.querySelectorAll("button[data-h]"),function(b){ var hh=b.getAttribute("data-h"); if(hh) b.onclick=function(){ viewProfile(hh); }; });
    }catch(e){ wrap.innerHTML='<div class="err">Could not run the search.</div>'; }
  }

  async function renderLeaderboard(counts,fmt,heading){
    const wrap=document.getElementById("lbWrap");
    const arr=Object.keys(counts).map(function(k){ return {id:k,v:counts[k]}; }).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;}).slice(0,25);
    if(!arr.length){ wrap.innerHTML='<div class="card" style="text-align:center;padding:28px 20px"><div style="font-size:32px;margin-bottom:10px">📊</div>'+(heading?('<b>'+escapeHtml(heading)+'</b><br><br>'):"")+'Not enough data yet. As collectors add public cards and follow each other, the rankings fill in.</div>'; return; }
    let profs={};
    const pr=await sb.from("profiles").select("id,handle,display_name,avatar_url").in("id",arr.map(function(x){return x.id;}));
    (pr.data||[]).forEach(function(p){ profs[p.id]=p; });
    const medals=["🥇","🥈","🥉"];
    let rows="";
    arr.forEach(function(x,i){
      const p=profs[x.id]; if(!p) return;
      const label=typeof fmt==="function"?fmt(x.v,x.id):fmt;
      const medal=i<3?medals[i]:null;
      rows+='<div class="lbrow">'+
        (medal?('<div style="font-size:18px;width:28px;text-align:center;flex-shrink:0">'+medal+'</div>'):('<div class="rank">'+(i+1)+'</div>'))+
        avatarHtml(p)+
        '<div class="nm" data-h="'+escapeAttr(p.handle)+'">'+escapeHtml(p.display_name||("@"+p.handle))+'</div>'+
        '<div class="val">'+escapeHtml(label)+'</div></div>';
    });
    wrap.innerHTML='<div class="card">'+(heading?('<div style="font-size:13px;color:var(--muted);margin-bottom:10px">'+escapeHtml(heading)+'</div>'):"")+rows+'</div>';
    Array.prototype.forEach.call(wrap.querySelectorAll(".nm[data-h]"),function(s){ var hh=s.getAttribute("data-h"); if(hh) s.onclick=function(){ viewProfile(hh); }; });
  }

  // ---------- MANUAL ADD ----------
  function openManualModal(){
    if(!currentSession){ alert("Sign in to add cards."); return; }
    document.getElementById("mTitle").value="";
    document.getElementById("mGrader").value="Raw";
    document.getElementById("mGrade").value="";
    document.getElementById("mValue").value="";
    var pf=document.getElementById("mPhoto"); if(pf) pf.value="";
    document.getElementById("manualMsg").textContent="";
    document.getElementById("mGradeWrap").style.display="none";
    document.getElementById("manualModal").style.display="flex";
    setTimeout(function(){ var t=document.getElementById("mTitle"); if(t) t.focus(); },30);
  }
  async function saveManual(){
    const msg=document.getElementById("manualMsg");
    const title=(document.getElementById("mTitle").value||"").trim();
    if(!title){ msg.style.color="var(--down)"; msg.textContent="Enter the card name."; return; }
    const grader=document.getElementById("mGrader").value;
    const grade=(document.getElementById("mGrade").value||"").trim();
    const raw=(document.getElementById("mValue").value||"").replace(/[^0-9.]/g,"");
    const value=raw!==""?Number(raw):null;
    const gradeLabel=(grader==="Raw")?"Raw/Ungraded":(grader+(grade?(" "+grade):""));
    const query=((grader!=="Raw"&&grade)?(grader+" "+grade+" "):"")+title;
    const btn=document.getElementById("manualSave"); btn.disabled=true; btn.textContent="Adding…";
    const payload={ user_id:currentSession.user.id, title:title, grade:gradeLabel, query:query,
      added_value:(value!=null&&!isNaN(value))?value:0,
      manual_value:(value!=null&&!isNaN(value))?value:null };
    let ins;
    try{ ins=await withTimeout(sb.from("holdings").insert(payload).select("id").maybeSingle(),25000,"Add"); }
    catch(err){ btn.disabled=false; btn.textContent="Add to portfolio"; msg.style.color="var(--down)"; msg.textContent=err.message||"Could not add."; return; }
    if(ins.error||!ins.data){ btn.disabled=false; btn.textContent="Add to portfolio"; msg.style.color="var(--down)"; msg.textContent="Could not add: "+((ins.error&&ins.error.message)||"try again"); return; }
    const newId=ins.data.id;
    const file=document.getElementById("mPhoto").files&&document.getElementById("mPhoto").files[0];
    if(file){
      try{
        const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
        const path=currentSession.user.id+"/"+newId+"_"+Date.now()+"."+ext;
        const up=await withTimeout(sb.storage.from("cards").upload(path,file,{upsert:true,cacheControl:"3600"}),30000,"Upload");
        if(!up.error){ const url=sb.storage.from("cards").getPublicUrl(path).data.publicUrl; await sb.from("holdings").update({image_url:url}).eq("id",newId); await sb.from("card_photos").insert({holding_id:newId,user_id:currentSession.user.id,url:url}); }
      }catch(e){}
    }
    document.getElementById("manualModal").style.display="none";
    btn.disabled=false; btn.textContent="Add to portfolio";
    if(view==="portfolio") loadPortfolio(); else setView("portfolio");
  }

  // ---------- CERT LOOKUP ----------
  async function certLookup(){
    const co=document.getElementById("certOut");
    const n=(document.getElementById("certNum").value||"").replace(/[^0-9]/g,"");
    if(n.length<5){ co.innerHTML='<div class="err">Enter a valid PSA cert number (digits only).</div>'; return; }
    const btn=document.getElementById("certLookupBtn"); btn.disabled=true; btn.textContent="…";
    try{
      const res=await fetch("/cert?n="+encodeURIComponent(n));
      if(!res.ok){ throw {code:res.status}; }
      const data=await res.json();
      if(data && data.IsValidRequest===false){ co.innerHTML='<div class="err"><b>'+escapeHtml(data.ServerMessage||"Invalid cert number")+'.</b></div>'; return; }
      if(data && data.ServerMessage==="No data found"){ co.innerHTML='<div class="err"><b>No card found for that cert number.</b></div>'; return; }
      const c=(data&&(data.PSACert||data.cert))||data||{};
      const images=findImages(data);
      if(!c || (!c.Subject && !c.Brand && !c.Year)){
        co.innerHTML='<div class="err"><b>PSA returned an unexpected format.</b><br><span style="font-size:11px">Raw: '+escapeHtml(JSON.stringify(data)).slice(0,400)+'</span></div>'; return;
      }
      const year=c.Year||""; const brand=c.Brand||""; const subj=c.Subject||"";
      const cardNo=c.CardNumber||""; const variety=c.Variety||"";
      var gsrc=((c.CardGrade||c.GradeDescription||"")+"");
      var gm=gsrc.match(/[0-9]+([.][0-9]+)?/);
      var gnum=gm?gm[0]:"";
      const gradeLabel=gnum?("PSA "+gnum):(c.GradeDescription||c.CardGrade||"");
      const title=[year,brand,subj,(cardNo?("#"+cardNo):""),variety].filter(Boolean).join(" ");
      const query=[gradeLabel,year,brand,subj,cardNo,variety].filter(Boolean).join(" ");
      co.innerHTML='<div class="insight" style="margin-top:12px">Pricing '+escapeHtml(title)+'…</div>';
      let med=0, nconf=0, thumb="";
      try{ const pr=await fetch("/api?q="+encodeURIComponent(query)+"&limit=20&sort=date_desc"); const pj=await pr.json(); const arr=pj.data||[]; const sm=summarize(arr); med=sm.median; nconf=sm.n; for(var i=0;i<arr.length;i++){ if(arr[i].thumbnail_url||arr[i].image_url){ thumb=arr[i].thumbnail_url||arr[i].image_url; break; } } }catch(e){}
      const showImgs = images.length ? images.slice(0,2) : (thumb ? [thumb] : []);
      certResult={ query:query, title:title, grade:gradeLabel, cert:n, image:(showImgs[0]||""), median:med };
      const imgHtml = showImgs.length ? ('<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+showImgs.map(function(u){return '<img src="'+escapeAttr(u)+'" alt="card image" style="height:160px;border-radius:6px;background:var(--surface2)" onerror="this.remove()"/>';}).join("")+'</div>') : '';
      co.innerHTML='<div class="card" style="margin-top:12px;background:var(--ink)">'+
        imgHtml+
        '<div style="font-size:14px;font-weight:700">'+escapeHtml(title)+'</div>'+
        '<div style="font-size:12px;color:var(--dim);margin-top:2px">'+escapeHtml(gradeLabel)+' · cert '+escapeHtml(n)+(variety?(" · "+escapeHtml(variety)):"")+'</div>'+
        '<div class="mono" style="font-size:18px;font-weight:700;margin-top:10px">'+(med?money(med):"no recent sales found")+'</div>'+
        (nconf?('<div class="insight">Based on '+nconf+' confirmed sale'+(nconf>1?"s":"")+'</div>'):"")+
        '<button class="addbtn" id="certAdd" style="margin-top:12px">+ Add this card to my portfolio</button>'+
        '<details style="margin-top:10px"><summary style="font-size:11px;color:var(--dim);cursor:pointer">show raw PSA data</summary><pre style="font-size:10px;color:var(--dim);white-space:pre-wrap;margin-top:6px">'+escapeHtml(JSON.stringify(c,null,1))+'</pre></details>'+
        '</div>';
      document.getElementById("certAdd").onclick=async function(){
        const b=document.getElementById("certAdd"); b.disabled=true; b.textContent="Adding…";
        const r=await sb.from("holdings").insert({ user_id:currentSession.user.id, query:certResult.query, title:certResult.title, grade:certResult.grade, image_url:certResult.image, added_value:certResult.median, cert:certResult.cert });
        if(r.error){ b.disabled=false; b.textContent="+ Add this card to my portfolio"; alert("Could not add: "+r.error.message); }
        else { b.textContent="\u2713 Added — refreshing…"; loadPortfolio(); }
      };
    }catch(e){
      if(e&&e.code===500) co.innerHTML='<div class="err"><b>PSA rejected the request (500)</b> — usually an invalid or expired token. The PSA token in the worker may need regenerating.</div>';
      else if(e&&e.code===404) co.innerHTML='<div class="err"><b>Cert not found.</b> Double-check the number.</div>';
      else if(e&&e.code===429) co.innerHTML='<div class="err"><b>PSA rate limit reached.</b> Wait a bit and try again.</div>';
      else co.innerHTML='<div class="err"><b>Lookup failed.</b> Please try again.</div>';
    }finally{
      const b=document.getElementById("certLookupBtn"); if(b){ b.disabled=false; b.textContent="Look up"; }
    }
  }

  // ---------- CARD SEARCH ----------
  const examples=[
    "PSA 10 Jalen Brunson Prizm",
    "PSA 10 Wembanyama Prizm Silver",
    "Charizard Base Set 1st Edition PSA",
    "2026 Topps Chrome Disney Art of Disney",
  ];
  const chips=document.getElementById('chips');
  examples.forEach(function(ex){
    const c=document.createElement('span');c.className='chip';c.textContent=ex;
    c.onclick=function(){document.getElementById('q').value=ex;};
    chips.appendChild(c);
  });
  const out=document.getElementById('out');

  function gradeOf(s){ return (s.grader&&s.grade)?(s.grader+" "+s.grade):(s.grade?("Grade "+s.grade):"Raw/Ungraded"); }

  async function addSaleToPortfolio(idx,btn){
    if(!sb || !currentSession){ alert("Sign in to save cards to your portfolio."); return; }
    const s=lastSales[idx]; if(!s) return;
    btn.disabled=true; btn.textContent="Adding…";
    const grade=gradeOf(s);
    const value=(typeof s.price==="number")?s.price:(lastResult?lastResult.median:0);
    const r=await sb.from("holdings").insert({
      user_id:currentSession.user.id,
      query:(lastResult&&lastResult.query)||"",
      title:s.title||(lastResult&&lastResult.title)||"",
      grade:grade,
      image_url:s.thumbnail_url||s.image_url||"",
      added_value:value
    });
    if(r.error){ btn.disabled=false; btn.textContent="+ Add"; alert("Could not add: "+r.error.message); }
    else { btn.textContent="\u2713 Added"; }
  }

  async function run(){
    const q=document.getElementById('q').value.trim();
    out.innerHTML="";
    if(q.length<4){out.innerHTML='<div class="err"><b>Search needs at least 4 characters.</b></div>';return;}
    const btn=document.getElementById('go');
    btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Checking…';
    try{
      const res=await fetch("/api?q="+encodeURIComponent(q)+"&limit=20&sort=date_desc");
      if(res.status===429){throw {kind:"limit"};}
      if(!res.ok){throw {kind:"server",code:res.status};}
      const json=await res.json();
      let sales=(json.data||[]);
      let srcNote="";
      if(!sales.length){
        const comps=await fetchComps(q);
        if(comps.length){ sales=comps; srcNote=' · source: eBay sold (via SoldComps)'; }
      }
      if(!sales.length){out.innerHTML='<div class="err"><b>No recent sales found.</b> Try fewer or different words — e.g. just the player and set.</div>';return;}
      const isPending=function(s){return s.price_confirmed===false;};
      const confirmed=sales.filter(function(s){return !isPending(s);});
      const pending=sales.filter(isPending);
      const basis=confirmed.length?confirmed:sales;
      const prices=basis.map(function(s){return s.price;}).filter(function(p){return typeof p==="number";});
      const avg=prices.reduce(function(a,b){return a+b;},0)/prices.length;
      const med=median(prices);
      const lo=Math.min.apply(null,prices), hi=Math.max.apply(null,prices);
      const spread=hi/(lo||1);
      const top=basis[0]||sales[0];
      lastResult={ query:q, median:med,
        title:(top&&top.title)||q,
        grade:(top&&top.grader&&top.grade)?(top.grader+" "+top.grade):((top&&top.grade)?("Grade "+top.grade):""),
        image:(top&&(top.thumbnail_url||top.image_url))||"" };
      let notes="";
      if(pending.length){ notes+='<div class="insight">\u26a0 '+pending.length+' sale'+(pending.length>1?"s":"")+' with an <b>unconfirmed Best Offer price</b> '+(confirmed.length?"excluded from the summary":"shown below — treat with caution")+'. eBay hides accepted-offer amounts.</div>'; }
      if(spread>=3 && confirmed.length){ notes+='<div class="insight">Wide range — likely a mix of base cards and rarer parallels. The <b>median ('+money(med)+')</b> is the more reliable read here.</div>'; }
      const basisLabel = confirmed.length ? ('Based on '+confirmed.length+' confirmed sale'+(confirmed.length>1?"s":"")) : ('Based on '+sales.length+' sale'+(sales.length>1?"s":"")+' (none confirmed yet)');
      const watchBtn = '<button class="authbtn" id="watchSearch" style="margin-top:10px">\u2606 Watch this search</button>';
      const stats='<div class="card"><div class="stats">'+
        '<div class="stat"><div class="l">'+(confirmed.length?"Confirmed sales":"Sales found")+'</div><div class="v">'+(confirmed.length||sales.length)+'</div></div>'+
        '<div class="stat"><div class="l">Average</div><div class="v">'+money(avg)+'</div></div>'+
        '<div class="stat hl"><div class="l">Median</div><div class="v">'+money(med)+'</div></div>'+
        '<div class="stat"><div class="l">Low</div><div class="v">'+money(lo)+'</div></div>'+
        '<div class="stat"><div class="l">High</div><div class="v">'+money(hi)+'</div></div>'+
        '</div><div class="insight" style="margin-top:10px">'+basisLabel+srcNote+'</div>'+notes+watchBtn+'</div>';
      lastSales=confirmed.concat(pending);
      const renderSale=function(s,idx){
        const g=gradeOf(s);
        const img=s.thumbnail_url||s.image_url||"";
        const link=s.listing_url||"#";
        const title=escapeHtml(s.title||"Untitled listing");
        const pend=isPending(s);
        const pTag=pend?' <span style="font-size:10px;color:var(--gold);border:1px solid var(--gold);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:1px">PENDING</span>':"";
        const acts=(sb&&currentSession)?('<div class="saleacts"><button class="miniadd" data-add="'+idx+'">+ Add</button><button class="miniwatch" data-watch="'+idx+'" title="Watch">\u2606</button></div>'):"";
        return '<div class="sale" style="'+(pend?"opacity:.7":"")+'">'+
          (img?('<img src="'+escapeAttr(img)+'" alt="" loading="lazy"/>'):('<div style="width:38px;height:53px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
          '<div class="t"><a href="'+escapeAttr(link)+'" target="_blank" rel="noopener">'+title+'</a>'+
          '<div class="meta">'+escapeHtml(s.sale_date||"")+' · '+escapeHtml(g)+' · '+escapeHtml(s.platform||"")+(s.listing_type==="best_offer"?" · Best Offer":"")+'</div></div>'+
          '<div class="p">'+money(s.price)+pTag+'</div>'+acts+'</div>';
      };
      const rows=lastSales.map(renderSale).join("");
      const hint=(sb&&currentSession)?'<div class="insight" style="margin-bottom:6px">Tap <b>+ Add</b> on the exact card you own to save it, or <b>\u2606</b> to watch it.</div>':'<div class="insight" style="margin-bottom:6px">Sign in to add cards to a portfolio or watchlist.</div>';
      out.innerHTML=stats+'<div class="card"><label>RECENT SOLD LISTINGS</label>'+hint+rows+'</div>';
      var ws=document.getElementById("watchSearch");
      if(ws) ws.onclick=function(){ if(!currentSession){ alert("Sign in to use the watchlist."); return; } openWatchModal(q, lastResult.title, lastResult.image); };
      Array.prototype.forEach.call(out.querySelectorAll("[data-add]"),function(b){ b.onclick=function(){ addSaleToPortfolio(Number(b.getAttribute("data-add")), b); }; });
      Array.prototype.forEach.call(out.querySelectorAll("[data-watch]"),function(b){ b.onclick=function(){ if(!currentSession){ alert("Sign in to use the watchlist."); return; } var s=lastSales[Number(b.getAttribute("data-watch"))]; openWatchModal((lastResult&&lastResult.query)||q, s.title||((lastResult&&lastResult.title)), s.thumbnail_url||s.image_url||""); }; });
    }catch(e){
      let msg;
      if(e&&e.kind==="limit") msg='<b>Busy right now — daily data limit hit.</b> Please try again later.';
      else if(e&&e.kind==="server") msg='<b>Something went wrong ('+e.code+').</b> Please try again in a moment.';
      else msg='<b>Could not load results.</b> Please try again.';
      out.innerHTML='<div class="err">'+msg+'</div>';
    }finally{
      btn.disabled=false;btn.textContent="Check price";
    }
  }
  document.getElementById('go').onclick=run;
  document.getElementById('q').addEventListener('keydown',function(e){if(e.key==="Enter")run();});
  var _cb=document.getElementById("certLookupBtn"); if(_cb) _cb.onclick=certLookup;
  var _cn=document.getElementById("certNum"); if(_cn) _cn.addEventListener("keydown",function(e){if(e.key==="Enter")certLookup();});
  var _ms=document.getElementById("modalSave"); if(_ms) _ms.onclick=function(){ saveModalValue(false); };
  var _mc=document.getElementById("modalCancel"); if(_mc) _mc.onclick=function(){ document.getElementById("modal").style.display="none"; };
  var _mcl=document.getElementById("modalClear"); if(_mcl) _mcl.onclick=function(){ saveModalValue(true); };
  var _miEl=document.getElementById("modalInput"); if(_miEl) _miEl.addEventListener("keydown",function(e){ if(e.key==="Enter") saveModalValue(false); });
  var _mo=document.getElementById("modal"); if(_mo) _mo.addEventListener("click",function(e){ if(e.target.id==="modal") _mo.style.display="none"; });
  var _ws=document.getElementById("watchSave"); if(_ws) _ws.onclick=saveWatch;
  var _wc=document.getElementById("watchCancel"); if(_wc) _wc.onclick=function(){ document.getElementById("watchModal").style.display="none"; pendingWatch=null; };
  var _wm=document.getElementById("watchModal"); if(_wm) _wm.addEventListener("click",function(e){ if(e.target.id==="watchModal"){ _wm.style.display="none"; pendingWatch=null; } });
  var _ss=document.getElementById("sellSave"); if(_ss) _ss.onclick=function(){ saveSell(false); };
  var _sc=document.getElementById("sellCancel"); if(_sc) _sc.onclick=function(){ document.getElementById("sellModal").style.display="none"; pendingSell=null; };
  var _sr=document.getElementById("sellRemove"); if(_sr) _sr.onclick=function(){ saveSell(true); };
  var _sm=document.getElementById("sellModal"); if(_sm) _sm.addEventListener("click",function(e){ if(e.target.id==="sellModal"){ _sm.style.display="none"; pendingSell=null; } });
  var _os=document.getElementById("offerSend"); if(_os) _os.onclick=submitOffer;
  var _oc=document.getElementById("offerCancel"); if(_oc) _oc.onclick=function(){ document.getElementById("offerModal").style.display="none"; pendingOffer=null; };
  var _om=document.getElementById("offerModal"); if(_om) _om.addEventListener("click",function(e){ if(e.target.id==="offerModal"){ _om.style.display="none"; pendingOffer=null; } });
  Array.prototype.forEach.call(document.querySelectorAll("#mktTabs button"),function(b){ b.onclick=function(){ mktFilter=b.getAttribute("data-mkt"); loadMarket(); }; });
  Array.prototype.forEach.call(document.querySelectorAll("#lbTabs button"),function(b){ b.onclick=function(){ lbTab=b.getAttribute("data-lb"); loadLeaderboard(); window.scrollTo(0,0); }; });
  var _gc=document.getElementById("gifCancel"); if(_gc) _gc.onclick=function(){ document.getElementById("gifModal").style.display="none"; gifTarget=null; };
  var _gm=document.getElementById("gifModal"); if(_gm) _gm.addEventListener("click",function(e){ if(e.target.id==="gifModal"){ _gm.style.display="none"; gifTarget=null; } });
  var _gu=document.getElementById("gifUseUrl"); if(_gu) _gu.onclick=function(){ var v=(document.getElementById("gifSearch").value||"").trim(); if(isImgUrl(v)){ pickGif(v); } else { alert("Paste a direct GIF or image URL (ending in .gif/.png/.jpg) or a Giphy/Tenor link."); } };
  var _mab=document.getElementById("manualAddBtn"); if(_mab) _mab.onclick=openManualModal;
  var _msv=document.getElementById("manualSave"); if(_msv) _msv.onclick=saveManual;
  var _mcl2=document.getElementById("manualCancel"); if(_mcl2) _mcl2.onclick=function(){ document.getElementById("manualModal").style.display="none"; };
  var _mmo=document.getElementById("manualModal"); if(_mmo) _mmo.addEventListener("click",function(e){ if(e.target.id==="manualModal") _mmo.style.display="none"; });
  var _mgr=document.getElementById("mGrader"); if(_mgr) _mgr.onchange=function(){ document.getElementById("mGradeWrap").style.display=(_mgr.value==="Raw")?"none":""; };
  var _mt=document.getElementById("mTitle"); var _mSugTimer=null;
  if(_mt) _mt.addEventListener("input",function(){
    const sug=document.getElementById("mSuggest"); const v=_mt.value.trim();
    clearTimeout(_mSugTimer);
    if(v.length<3){ sug.style.display="none"; return; }
    _mSugTimer=setTimeout(async function(){
      try{
        const r=await fetch("/catalog?q="+encodeURIComponent(v)); const j=await r.json(); const items=j.data||[];
        if(!items.length){ sug.style.display="none"; return; }
        sug.innerHTML=items.map(function(it){ return '<div class="convo" data-nm="'+escapeAttr(it.name)+'" style="padding:9px 12px"><div class="cmeta"><div class="cn" style="font-size:13px">'+escapeHtml(it.name)+'</div><div class="cp">'+escapeHtml(it.set)+'</div></div></div>'; }).join("");
        sug.style.display="";
        Array.prototype.forEach.call(sug.querySelectorAll("[data-nm]"),function(d){ d.onclick=function(){ _mt.value=d.getAttribute("data-nm"); sug.style.display="none"; }; });
      }catch(e){ sug.style.display="none"; }
    },300);
  });
  var _gs=document.getElementById("gifSearch"); if(_gs) _gs.addEventListener("input",function(){ if(!GIPHY_KEY) return; clearTimeout(gifTimer); var v=_gs.value.trim(); gifTimer=setTimeout(function(){ gifSearch(v||"trending"); },350); });
</script>
</body>
</html>`;
}
