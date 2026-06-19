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
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Foilio — Real sold prices for any trading card</title>
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
  .top{border-bottom:1px solid var(--border);background:var(--surface)}
  .topin{max-width:920px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:12px}
  .foil{background:linear-gradient(100deg,#a78bfa,#22d3ee 28%,#34d399 52%,#fbbf24 74%,#f472b6);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:foil 6s linear infinite}
  @keyframes foil{to{background-position:200% center}}
  @media (prefers-reduced-motion:reduce){.foil{animation:none}}
  .wrap{max-width:920px;margin:0 auto;padding:40px 20px 90px}
  h1{font-family:'Space Grotesk',sans-serif;font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1.1}
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
  .foot{max-width:920px;margin:0 auto;padding:24px 20px 50px;color:var(--dim);font-size:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .authbtn{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif}
  .authbtn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff}
  .who{font-size:13px;color:var(--muted);cursor:pointer} .who b{color:var(--text)}
  .panel{position:absolute;right:0;top:42px;width:280px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;z-index:30;box-shadow:0 16px 50px rgba(0,0,0,.55)}
  .panel input{margin-bottom:8px;font-size:14px;padding:10px 12px}
  .panel .msg{font-size:12px;margin-top:9px;line-height:1.45}
  .tabs{display:flex;gap:4px;margin-bottom:12px;background:var(--ink);border:1px solid var(--border);border-radius:8px;padding:3px}
  .tab{flex:1;background:transparent;border:none;color:var(--muted);border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .tab.on{background:var(--indigo);color:#fff}
  .nav{display:flex;gap:3px;background:var(--ink);border:1px solid var(--border);border-radius:8px;padding:3px;margin-left:auto;flex-wrap:wrap}
  .nav button{background:transparent;border:none;color:var(--muted);border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif}
  .nav button.on{background:var(--surface2);color:var(--text)}
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
  .modalbox{background:var(--surface);border:1px solid var(--borderB);border-radius:16px;padding:24px;max-width:380px;width:100%}
  @media (max-width:720px){.vision{grid-template-columns:1fr}.pillars{grid-template-columns:1fr}.topin{flex-wrap:wrap}.nav{order:3;width:100%;justify-content:center}.nav button{flex:1}}
</style>
</head>
<body>
<div class="top"><div class="topin">
  <span class="foil" id="logo" style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;cursor:pointer">Foilio</span>
  <span style="font-size:13px;color:var(--muted)" id="tagline">real sold prices, every card</span>
  <div id="navArea"></div>
  <div style="position:relative" id="authArea"></div>
</div></div>

<div id="searchView"><div class="wrap">
  <h1>What's it <span class="foil">actually</span> worth?</h1>
  <p class="sub">Search any trading card — sports, Pokémon, or any TCG — and see what it's really selling for, based on actual recent marketplace sales.</p>
  <div class="card">
    <label>SEARCH A CARD</label>
    <input id="q" placeholder='e.g. "PSA 10 Jalen Brunson Prizm"' value="PSA 10 Jalen Brunson Prizm"/>
    <div class="chips" id="chips"></div>
    <button class="btn" id="go">Check price</button>
  </div>
  <div class="vision">
    <div class="card" style="margin-top:0">
      <label>THE FOILIO NETWORK</label>
      <h2>Card Ladder data, portfolio tracking, and collector reputation in one place.</h2>
      <p class="sub" style="font-size:14px">Foilio starts with live sold prices and saved portfolios. The next layer is a social market where every collector can build an @handle, post cards, follow trusted sellers, and react to new market moves.</p>
      <div class="pillars">
        <div class="pillar"><b>Live market tape</b><span>Trend cards by category, price velocity, and recent confirmed sales.</span></div>
        <div class="pillar"><b>Public portfolios</b><span>Show holdings, gains, grails, and cards available for sale or trade.</span></div>
        <div class="pillar"><b>@handles + follow graph</b><span>Build collector profiles that make reputation and taste visible.</span></div>
        <div class="pillar"><b>Watchlists + alerts</b><span>Track cards and get flagged when a watchlist price moves.</span></div>
      </div>
    </div>
    <div class="network-card">
      <label>COLLECTOR ACTIVITY</label>
      <div id="homeFeed"><div class="insight">Loading recent collector activity…</div></div>
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
  <h1 style="font-size:28px">My Portfolio</h1>
  <p class="sub">Your saved cards, valued from recent sales. Tap <b>Edit</b> to set your own value, or <b>toggle</b> whether a card shows on your public profile.</p>
  <div class="card">
    <label>ADD A CARD BY PSA CERT</label>
    <div style="display:flex;gap:8px">
      <input id="certNum" placeholder="PSA cert number (digits only)" style="flex:1"/>
      <button class="authbtn primary" id="certLookupBtn" style="white-space:nowrap">Look up</button>
    </div>
    <div id="certOut"></div>
  </div>
  <div id="pfSummary"></div>
  <div id="pfList"></div>
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

<div class="foot">
  <span class="foil" style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px">Foilio</span>
  <span>Prices from real recent sales · a social market for collectors</span>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  // ---------- CONFIG ----------
  const FOILIO_CONFIG=${publicConfig};
  const SB_URL=FOILIO_CONFIG.supabaseUrl||"";
  const SB_KEY=FOILIO_CONFIG.supabaseAnonKey||"";
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

  // ---------- HELPERS ----------
  const money=function(n){return "$"+Math.round(n||0).toLocaleString();};
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
  async function valueHolding(h){
    const manual=(h.manual_value!=null && h.manual_value!=="")?Number(h.manual_value):null;
    if(manual!=null && !isNaN(manual)){ return {current:manual, manual:true}; }
    try{
      const res=await fetch("/api?q="+encodeURIComponent(h.query)+"&limit=20&sort=date_desc");
      const j=await res.json();
      const sm=summarize(j.data||[]);
      return {current:sm.median, manual:false};
    }catch(e){ return {current:0, manual:false}; }
  }
  async function liveMedian(query){
    try{
      const res=await fetch("/api?q="+encodeURIComponent(query)+"&limit=20&sort=date_desc");
      const j=await res.json();
      return summarize(j.data||[]);
    }catch(e){ return {median:0,n:0,top:null}; }
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
  function panelHTML(){
    return '<div class="panel">'+
      '<div class="tabs"><button class="tab'+(authMode==="login"?" on":"")+'" id="tabLogin">Log in</button>'+
      '<button class="tab'+(authMode==="signup"?" on":"")+'" id="tabSignup">Sign up</button></div>'+
      '<input id="authEmail" type="email" placeholder="Email" autocomplete="email"/>'+
      (authMode==="signup"?'<input id="authHandle" type="text" placeholder="@handle (3-20 letters/numbers)" autocomplete="username" maxlength="21"/>':"")+
      '<input id="authPass" type="password" placeholder="Password (6+ chars)" autocomplete="current-password"/>'+
      '<button class="authbtn primary" id="authAction" style="width:100%;margin-top:2px">'+(authMode==="login"?"Log in":"Create account")+'</button>'+
      '<div class="msg" id="authMsg"></div></div>';
  }
  function renderAuth(){
    if(!sb){ authArea.innerHTML='<span class="who">accounts setup pending</span>'; return; }
    if(currentSession && currentSession.user){
      const handle=myProfile?myProfile.handle:normalizeHandle((currentSession.user.user_metadata||{}).handle);
      const identity=handle?("@"+handle):currentSession.user.email;
      authArea.innerHTML='<span class="who" id="meLink">\u2713 <b>'+escapeHtml(identity)+'</b></span> <button class="authbtn" id="logoutBtn">Log out</button>';
      var meL=document.getElementById("meLink");
      if(meL) meL.onclick=function(){ if(handle) viewProfile(handle); };
      document.getElementById("logoutBtn").onclick=function(){ sb.auth.signOut(); };
    } else {
      authArea.innerHTML='<button class="authbtn primary" id="signinToggle">Sign in</button>'+(panelOpen?panelHTML():"");
      document.getElementById("signinToggle").onclick=function(){ panelOpen=!panelOpen; renderAuth(); };
      if(panelOpen) wirePanel();
    }
  }
  function wirePanel(){
    document.getElementById("tabLogin").onclick=function(){ authMode="login"; renderAuth(); };
    document.getElementById("tabSignup").onclick=function(){ authMode="signup"; renderAuth(); };
    const gE=function(){return document.getElementById("authEmail").value.trim();};
    const gP=function(){return document.getElementById("authPass").value;};
    const gH=function(){var el=document.getElementById("authHandle");return el?el.value:"";};
    const say=function(t,ok){var m=document.getElementById("authMsg");if(!m)return;m.style.color=ok?"var(--up)":"var(--down)";m.textContent=t;};
    document.getElementById("authAction").onclick=async function(){
      if(authMode==="login"){
        if(!gE()||!gP()){say("Enter your email and password.");return;}
        const r=await sb.auth.signInWithPassword({email:gE(),password:gP()});
        if(r.error) say(r.error.message);
      } else {
        if(!gE()||gP().length<6){say("Use a valid email and a 6+ character password.");return;}
        const handle=normalizeHandle(gH());
        if(!handle){say("Choose a 3-20 character handle using letters, numbers, or underscores.");return;}
        const r=await sb.auth.signUp({email:gE(),password:gP(),options:{data:{handle:handle}}});
        if(r.error) say(r.error.message);
        else if(r.data && r.data.session) say("Account created \u2014 you are signed in!",true);
        else say("Account created. If email confirmation is on, check your inbox; otherwise just log in.",true);
      }
    };
  }
  function renderNav(){
    var items='';
    items+='<button id="navSearch" class="'+(view==="search"?"on":"")+'">Search</button>';
    items+='<button id="navTrending" class="'+(view==="trending"?"on":"")+'">Trending</button>';
    if(sb && currentSession){
      items+='<button id="navPortfolio" class="'+(view==="portfolio"?"on":"")+'">Portfolio</button>';
      items+='<button id="navWatch" class="'+(view==="watchlist"?"on":"")+'">Watchlist</button>';
      items+='<button id="navProfile" class="'+(view==="profile"||view==="editProfile"?"on":"")+'">My Profile</button>';
    }
    navArea.innerHTML='<div class="nav">'+items+'</div>';
    document.getElementById("navSearch").onclick=function(){ setView("search"); };
    document.getElementById("navTrending").onclick=function(){ setView("trending"); };
    if(sb && currentSession){
      document.getElementById("navPortfolio").onclick=function(){ setView("portfolio"); };
      document.getElementById("navWatch").onclick=function(){ setView("watchlist"); };
      document.getElementById("navProfile").onclick=function(){ if(myProfile&&myProfile.handle){ viewProfile(myProfile.handle); } else { setView("editProfile"); } };
    }
  }
  const VIEWS=["search","trending","portfolio","watchlist","profile","editProfile"];
  function applyView(){
    document.getElementById("searchView").style.display=(view==="search")?"":"none";
    document.getElementById("trendingView").style.display=(view==="trending")?"":"none";
    document.getElementById("portfolioView").style.display=(view==="portfolio")?"":"none";
    document.getElementById("watchlistView").style.display=(view==="watchlist")?"":"none";
    document.getElementById("profileView").style.display=(view==="profile")?"":"none";
    document.getElementById("editProfileView").style.display=(view==="editProfile")?"":"none";
  }
  function setView(v,skipPush){
    view=v; applyView(); renderNav();
    if(!skipPush){ try{ history.pushState({view:v}, "", v==="search"?"/":("/"+ (v==="trending"?"trending":v))); }catch(e){} }
    if(v==="portfolio") loadPortfolio();
    if(v==="watchlist") loadWatchlist();
    if(v==="trending") loadTrending();
    if(v==="editProfile") renderEditProfile();
    window.scrollTo(0,0);
  }

  // Render the shell immediately so the header/nav never blanks out, even if
  // Supabase is slow, offline, or misconfigured. The async session check below
  // re-renders once it knows who (if anyone) is signed in.
  renderAuth(); renderNav(); routeFromPath(true); loadHomeFeed();
  if(sb){
    sb.auth.getSession().then(async function(res){
      try{
        currentSession=(res&&res.data)?res.data.session:null;
        await ensureMyProfile();
        renderAuth(); renderNav();
        if(currentSession) loadHomeFeed();
      }catch(e){}
    }).catch(function(){});
    sb.auth.onAuthStateChange(async function(_e,session){
      try{
        currentSession=session; panelOpen=false;
        await ensureMyProfile();
        renderAuth(); renderNav();
        if(!session && (view==="portfolio"||view==="watchlist"||view==="editProfile")){ setView("search"); }
        loadHomeFeed();
      }catch(e){}
    });
  }

  // ---------- ROUTING ----------
  function routeFromPath(initial){
    var path=location.pathname||"/";
    var m=path.match(/^\\/u\\/([A-Za-z0-9_]{1,30})$/)||path.match(/^\\/@([A-Za-z0-9_]{1,30})$/);
    if(m){ viewProfile(m[1], true); return; }
    if(path==="/trending"){ setView("trending", true); return; }
    if(path==="/watchlist" && currentSession){ setView("watchlist", true); return; }
    if(path==="/portfolio" && currentSession){ setView("portfolio", true); return; }
    setView("search", true);
  }
  window.addEventListener("popstate",function(){ routeFromPath(false); });
  document.getElementById("logo").onclick=function(){ setView("search"); };

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
      return rows;
    }catch(e){ return []; }
  }
  async function loadHomeFeed(){
    const el=document.getElementById("homeFeed");
    if(!el) return;
    if(!sb){ el.innerHTML='<div class="insight">Sign in to see collector activity.</div>'; return; }
    const rows=await recentPublicUploads(4);
    if(!rows.length){ el.innerHTML='<div class="activity"><div class="avatar">F</div><div class="copy"><b>Be the first.</b><span>Add a public card and it shows up here for the community.</span></div></div>'; return; }
    el.innerHTML=rows.map(function(h){
      const p=h._profile; const name=p?("@"+p.handle):"a collector";
      return '<div class="activity">'+avatarHtml(p)+'<div class="copy"><b data-h="'+(p?escapeAttr(p.handle):"")+'">'+escapeHtml(name)+'</b> added '+escapeHtml(h.title||h.query)+'<span>'+escapeHtml(h.grade||"")+(h.added_value?(' · '+money(h.added_value)):"")+'</span></div></div>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("b[data-h]"),function(b){ var hh=b.getAttribute("data-h"); if(hh) b.onclick=function(){ viewProfile(hh); }; });
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
  async function loadPortfolio(){
    const sum=document.getElementById("pfSummary");
    const list=document.getElementById("pfList");
    sum.innerHTML=""; list.innerHTML='<div class="card">Loading your portfolio…</div>';
    const r=await sb.from("holdings").select("*").order("added_at",{ascending:false});
    if(r.error){ list.innerHTML='<div class="err"><b>Could not load portfolio.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const holds=r.data||[];
    if(!holds.length){ list.innerHTML='<div class="card">No cards yet. Go to <b>Search</b>, look up a card, and tap <b>"+ Add"</b> on the one you own.</div>'; return; }
    const valued=await Promise.all(holds.map(async function(h){ const v=await valueHolding(h); return {h:h, current:v.current, manual:v.manual}; }));
    let totalCur=0, totalAdd=0;
    valued.forEach(function(v){ totalCur+=v.current; totalAdd+=(Number(v.h.added_value)||0); });
    const gl=totalCur-totalAdd; const glPct=totalAdd?(gl/totalAdd*100):0;
    sum.innerHTML='<div class="card"><div class="stats">'+
      '<div class="stat"><div class="l">Cards</div><div class="v">'+holds.length+'</div></div>'+
      '<div class="stat hl"><div class="l">Current value</div><div class="v">'+money(totalCur)+'</div></div>'+
      '<div class="stat"><div class="l">Added value</div><div class="v">'+money(totalAdd)+'</div></div>'+
      '<div class="stat"><div class="l">Gain / loss</div><div class="v" style="color:'+(gl>=0?"var(--up)":"var(--down)")+'">'+(gl>=0?"+":"")+money(gl)+' ('+(glPct>=0?"+":"")+glPct.toFixed(0)+'%)</div></div>'+
      '</div><div class="insight" style="margin-top:10px">Values are estimates from recent confirmed sales (median). Best Offer data can be imperfect.</div></div>';
    let rows="";
    valued.forEach(function(v){
      const h=v.h; const add=Number(h.added_value)||0; const diff=v.current-add; const dpct=add?(diff/add*100):0;
      const img=h.image_url||"";
      const manualTag=v.manual?' <span style="font-size:9px;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:0 4px;vertical-align:1px">MANUAL</span>':"";
      const pubTag=(h.is_public!==false)?'<span style="font-size:9px;color:var(--up)">public</span>':'<span style="font-size:9px;color:var(--dim)">private</span>';
      const glHtml=add>0?('<div style="font-size:12px;color:'+(diff>=0?"var(--up)":"var(--down)")+'">'+(diff>=0?"+":"")+money(diff)+' ('+(dpct>=0?"+":"")+dpct.toFixed(0)+'%)</div>'):'<div style="font-size:12px;color:var(--dim)">\u2014</div>';
      rows+='<div class="hrow">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(h.title||h.query)+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">'+escapeHtml(h.grade||"")+' · added '+money(add)+' · '+pubTag+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+money(v.current)+manualTag+'</div>'+glHtml+'</div>'+
        '<button class="ed" data-pub="'+h.id+'">'+((h.is_public!==false)?"Hide":"Show")+'</button>'+
        '<button class="ed" data-edit="'+h.id+'">Edit</button>'+
        '<button class="rm" data-id="'+h.id+'">Remove</button></div>';
    });
    list.innerHTML='<div class="card"><label>YOUR CARDS</label>'+rows+'</div>';
    Array.prototype.forEach.call(list.querySelectorAll(".rm"),function(b){
      b.onclick=async function(){
        const id=b.getAttribute("data-id");
        b.disabled=true; b.textContent="…";
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
    const r=await sb.from("watchlist").select("*").order("created_at",{ascending:false});
    if(r.error){ el.innerHTML='<div class="err"><b>Could not load watchlist.</b> '+escapeHtml(r.error.message)+'</div>'; return; }
    const items=r.data||[];
    if(!items.length){ el.innerHTML='<div class="card">Nothing tracked yet. Search a card and tap the <b>\u2606 watch</b> button to track it here.</div>'; return; }
    const valued=await Promise.all(items.map(async function(w){ const sm=await liveMedian(w.query); return {w:w, current:sm.median, n:sm.n}; }));
    let rows="";
    valued.forEach(function(v){
      const w=v.w; const cur=v.current; const target=(w.target_price!=null)?Number(w.target_price):null;
      let alerted=false;
      if(target!=null && cur){ alerted=(w.direction==="below")?(cur<=target):(cur>=target); }
      const img=w.image_url||"";
      const targetTxt=(target!=null)?((w.direction==="below"?"below ":"above ")+money(target)):"no target";
      rows+='<div class="hrow"'+(alerted?' style="background:rgba(43,214,115,.08)"':'')+'>'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(w.label||w.query)+(alerted?' <span style="font-size:9px;color:var(--up);border:1px solid var(--up);border-radius:3px;padding:0 5px">ALERT</span>':"")+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">target: '+escapeHtml(targetTxt)+(v.n?(' · '+v.n+' sales'):"")+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+(cur?money(cur):"\u2014")+'</div></div>'+
        '<button class="ed" data-look="'+escapeAttr(w.query)+'">View</button>'+
        '<button class="rm" data-wid="'+w.id+'">Remove</button></div>';
    });
    el.innerHTML='<div class="card"><label>TRACKED CARDS</label>'+rows+
      '<div class="insight" style="margin-top:12px">Targets are checked each time you open this page. Automated email/push alerts are coming next.</div></div>';
    Array.prototype.forEach.call(el.querySelectorAll("[data-wid]"),function(b){
      b.onclick=async function(){ const id=b.getAttribute("data-wid"); b.disabled=true; b.textContent="…"; const d=await sb.from("watchlist").delete().eq("id",id); if(d.error){ b.disabled=false; b.textContent="Remove"; alert("Could not remove: "+d.error.message); } else loadWatchlist(); };
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-look]"),function(b){
      b.onclick=function(){ const qv=b.getAttribute("data-look"); setView("search"); document.getElementById("q").value=qv; run(); };
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
      const p=h._profile; const name=p?("@"+p.handle):"a collector"; const img=h.image_url||"";
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
      : (currentSession?('<button class="followbtn'+(iFollow?" following":"")+'" id="followBtn">'+(iFollow?"Following":"Follow")+'</button>'):'');

    body.innerHTML='<div class="card"><div class="profhead">'+
      avatarHtml(p,"bigav")+
      '<div style="flex:1;min-width:200px"><h1 style="font-size:26px">'+escapeHtml(p.display_name||("@"+p.handle))+'</h1>'+
      '<div class="mono" style="color:var(--gold);font-size:13px">@'+escapeHtml(p.handle)+'</div>'+
      (p.bio?('<p class="sub" style="font-size:14px;margin-top:8px">'+escapeHtml(p.bio)+'</p>'):"")+
      (links.length?('<div class="sociallinks">'+links.join("")+'</div>'):"")+
      '<div class="pstats"><div><b id="followersN">'+followers+'</b>followers</div><div><b>'+following+'</b>following</div></div>'+
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
    }

    // public cards
    const cardsEl=document.getElementById("profCards");
    const hr=await sb.from("holdings").select("*").eq("user_id",p.id).eq("is_public",true).order("added_at",{ascending:false});
    const holds=(hr.data||[]);
    if(!holds.length){ cardsEl.innerHTML='<div class="card"><label>PUBLIC CARDS</label><div class="insight">This collector has no public cards yet.</div></div>'; return; }
    const valued=await Promise.all(holds.slice(0,40).map(async function(h){ const v=await valueHolding(h); return {h:h, current:v.current}; }));
    let total=0; valued.forEach(function(v){ total+=v.current; });
    let rows="";
    valued.forEach(function(v){
      const h=v.h; const img=h.image_url||"";
      rows+='<div class="hrow">'+
        (img?('<img src="'+escapeAttr(img)+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(h.title||h.query)+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">'+escapeHtml(h.grade||"")+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+money(v.current)+'</div></div></div>';
    });
    cardsEl.innerHTML='<div class="card"><div class="stats"><div class="stat"><div class="l">Public cards</div><div class="v">'+holds.length+'</div></div>'+
      '<div class="stat hl"><div class="l">Public value</div><div class="v">'+money(total)+'</div></div></div></div>'+
      '<div class="card"><label>PUBLIC CARDS</label>'+rows+'</div>';
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
      const up=await sb.storage.from("avatars").upload(path,file,{upsert:true,cacheControl:"3600"});
      if(up.error){ msg.textContent="Upload failed: "+up.error.message; return; }
      const pub=sb.storage.from("avatars").getPublicUrl(path);
      const url=pub.data.publicUrl;
      const u=await sb.from("profiles").update({avatar_url:url}).eq("id",currentSession.user.id);
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
    const u=await sb.from("profiles").update(payload).eq("id",currentSession.user.id);
    btn.disabled=false; btn.textContent="Save profile";
    if(u.error){ msg.style.color="var(--down)"; msg.textContent=(/duplicate|unique/i.test(u.error.message)?"That handle is taken. Try another.":("Could not save: "+u.error.message)); return; }
    myProfile=Object.assign({},myProfile,payload);
    msg.style.color="var(--up)"; msg.textContent="Profile saved.";
    renderAuth();
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
        const r=await sb.from("holdings").insert({ query:certResult.query, title:certResult.title, grade:certResult.grade, image_url:certResult.image, added_value:certResult.median, cert:certResult.cert });
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
      const sales=(json.data||[]);
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
        '</div><div class="insight" style="margin-top:10px">'+basisLabel+' · last 7 days</div>'+notes+watchBtn+'</div>';
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
</script>
</body>
</html>`;
}
