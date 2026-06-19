// ============================================================
//  FOILIO  —  all-in-one Cloudflare Worker
//  Serves the site, relays The Card API (/api), and powers
//  accounts + saved portfolios via Supabase.
//  All credentials are baked in below — just paste & Deploy.
// ============================================================

const API_KEY = "tca_74351763bc5e266abd439c9a88584aafd0cec7ec0f26ef8f";

// PSA cert lookup token (server-side only — never goes into the page). Get yours at psacard.com -> API.
const PSA_TOKEN = "cTFEajZ_9M-z7VT0cGzHE2OFv5LrXe9dS2hNuVTSRj1tmPib_g4TKMd0vh00dt1R2og1sU6a1i-9k2MoIUkTC2IsfCLOHM1oAqjzJFKGaD9NU9a50nNw-tPfxwKoBcIvxPeQp37KR6mALqby4fCHN8ZfUuWI8WLTmwKZvvay-ffs_IwR9jIOK7EhAd1tiBW9EqhXQ9awKqd14YyG7BbUZg-Oe2XMF7YbNgVkP5uXE-hZ79VzvLa1HWDOxGRfR7NBnPLsoOvnaU4remMCo-tRtPrVCBzNKzplvVnM9-lYO4MKNIK_";

const UPSTREAM = "https://thecardapi.com/api/v1/market/sales";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const q = url.searchParams.get("q") || "";
      const limit = url.searchParams.get("limit") || "20";
      const sort = url.searchParams.get("sort") || "date_desc";
      if (q.length < 4) {
        return new Response(JSON.stringify({ error: "Query must be at least 4 characters." }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const upstreamUrl = UPSTREAM + "?q=" + encodeURIComponent(q) +
        "&limit=" + encodeURIComponent(limit) + "&sort=" + encodeURIComponent(sort);
      try {
        const r = await fetch(upstreamUrl, { headers: { "x-market-api-key": API_KEY } });
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Could not reach the data source." }),
          { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/cert") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const n = (url.searchParams.get("n") || "").replace(/[^0-9]/g, "");
      if (n.length < 5) {
        return new Response(JSON.stringify({ error: "Invalid cert number." }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      try {
        const r = await fetch("https://api.psacard.com/publicapi/cert/GetByCertNumber/" + encodeURIComponent(n),
          { headers: { "Authorization": "bearer " + PSA_TOKEN } });
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Cert relay failed." }),
          { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }
    return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};

const PAGE = `<!DOCTYPE html>
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
  .topin{max-width:820px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:12px}
  .foil{background:linear-gradient(100deg,#a78bfa,#22d3ee 28%,#34d399 52%,#fbbf24 74%,#f472b6);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:foil 6s linear infinite}
  @keyframes foil{to{background-position:200% center}}
  @media (prefers-reduced-motion:reduce){.foil{animation:none}}
  .wrap{max-width:820px;margin:0 auto;padding:40px 20px 90px}
  h1{font-family:'Space Grotesk',sans-serif;font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1.1}
  .sub{color:var(--muted);font-size:16px;margin-top:10px;max-width:560px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-top:18px}
  input{width:100%;background:var(--ink);border:1px solid var(--border);border-radius:10px;padding:14px 16px;color:var(--text);font-size:16px;outline:none}
  input:focus{border-color:var(--indigo)}
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
  .err{background:rgba(255,93,108,.1);border:1px solid var(--down);border-radius:10px;padding:14px 16px;color:#ffb4bc;font-size:13px;margin-top:14px}
  .err b{color:#fff}
  .insight{font-size:13px;color:var(--muted);margin-top:6px}
  .foot{max-width:820px;margin:0 auto;padding:24px 20px 50px;color:var(--dim);font-size:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .authbtn{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif}
  .authbtn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff}
  .who{font-size:13px;color:var(--muted)} .who b{color:var(--text)}
  .panel{position:absolute;right:0;top:42px;width:280px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;z-index:30;box-shadow:0 16px 50px rgba(0,0,0,.55)}
  .panel input{margin-bottom:8px;font-size:14px;padding:10px 12px}
  .panel .msg{font-size:12px;margin-top:9px;line-height:1.45}
  .tabs{display:flex;gap:4px;margin-bottom:12px;background:var(--ink);border:1px solid var(--border);border-radius:8px;padding:3px}
  .tab{flex:1;background:transparent;border:none;color:var(--muted);border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif}
  .tab.on{background:var(--indigo);color:#fff}
  .nav{display:flex;gap:3px;background:var(--ink);border:1px solid var(--border);border-radius:8px;padding:3px;margin-left:auto}
  .nav button{background:transparent;border:none;color:var(--muted);border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif}
  .nav button.on{background:var(--surface2);color:var(--text)}
  .addbtn{background:var(--up);color:#04210f;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Manrope',sans-serif;margin-top:12px;width:100%}
  .addbtn:disabled{opacity:.7}
  .hrow{display:flex;align-items:center;gap:12px;padding:13px 4px;border-bottom:1px solid var(--border)}
  .hrow .rm{background:none;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;flex-shrink:0}
  .hrow .rm:hover{border-color:var(--down);color:var(--down)}
  .hrow .ed{background:none;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;flex-shrink:0}
  .hrow .ed:hover{border-color:var(--indigo);color:var(--indigo)}
</style>
</head>
<body>
<div class="top"><div class="topin">
  <span class="foil" style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700">Foilio</span>
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
  <div id="out"></div>
</div></div>

<div id="portfolioView" style="display:none"><div class="wrap">
  <h1 style="font-size:28px">My Portfolio</h1>
  <p class="sub">Your saved cards, valued from recent sales. Tap <b>Edit</b> on any card to set your own value.</p>
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

<div id="modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:20px">
  <div style="background:var(--surface);border:1px solid var(--borderB);border-radius:16px;padding:24px;max-width:380px;width:100%">
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

<div class="foot">
  <span class="foil" style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px">Foilio</span>
  <span>Prices from real recent sales · more features coming soon</span>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  // ---------- CONFIG ----------
  const SB_URL="https://feaoxyrpkjfoouadwaai.supabase.co";
  const SB_KEY="sb_publishable_pmH-3MD9OO_JwFDaYw7zgg_yrQeqU-9";
  let sb=null;
  try{ if(window.supabase){ sb=window.supabase.createClient(SB_URL,SB_KEY); } }catch(e){}

  // ---------- STATE ----------
  let currentSession=null;
  let panelOpen=false;
  let authMode="login";
  let view="search";
  let lastResult=null;
  let certResult=null;
  let editingId=null;

  // ---------- HELPERS ----------
  const money=function(n){return "$"+Math.round(n).toLocaleString();};
  function median(a){if(!a.length)return 0;const s=a.slice().sort(function(x,y){return x-y;});const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
  function summarize(sales){
    const conf=sales.filter(function(s){return s.price_confirmed!==false;});
    const basis=conf.length?conf:sales;
    const prices=basis.map(function(s){return s.price;}).filter(function(p){return typeof p==="number";});
    if(!prices.length) return {median:0,n:0,top:(sales[0]||null)};
    return {median:median(prices),n:(conf.length||sales.length),top:(basis[0]||sales[0])};
  }
  function escapeHtml(t){ return (t==null?"":(""+t)).replace(/[&<>"]/g,function(ch){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[ch]; }); }
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
      const imgHtml = showImgs.length ? ('<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+showImgs.map(function(u){return '<img src="'+u+'" alt="card image" style="height:160px;border-radius:6px;background:var(--surface2)" onerror="this.remove()"/>';}).join("")+'</div>') : '';
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

  // ---------- AUTH UI ----------
  const authArea=document.getElementById("authArea");
  const navArea=document.getElementById("navArea");
  function panelHTML(){
    return '<div class="panel">'+
      '<div class="tabs"><button class="tab'+(authMode==="login"?" on":"")+'" id="tabLogin">Log in</button>'+
      '<button class="tab'+(authMode==="signup"?" on":"")+'" id="tabSignup">Sign up</button></div>'+
      '<input id="authEmail" type="email" placeholder="Email" autocomplete="email"/>'+
      '<input id="authPass" type="password" placeholder="Password (6+ chars)" autocomplete="current-password"/>'+
      '<button class="authbtn primary" id="authAction" style="width:100%;margin-top:2px">'+(authMode==="login"?"Log in":"Create account")+'</button>'+
      '<div class="msg" id="authMsg"></div></div>';
  }
  function renderAuth(){
    if(!sb){ authArea.innerHTML='<span class="who">accounts setup pending</span>'; return; }
    if(currentSession && currentSession.user){
      authArea.innerHTML='<span class="who">\u2713 <b>'+currentSession.user.email+'</b></span> <button class="authbtn" id="logoutBtn">Log out</button>';
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
    const say=function(t,ok){var m=document.getElementById("authMsg");if(!m)return;m.style.color=ok?"var(--up)":"var(--down)";m.innerHTML=t;};
    document.getElementById("authAction").onclick=async function(){
      if(authMode==="login"){
        if(!gE()||!gP()){say("Enter your email and password.");return;}
        const r=await sb.auth.signInWithPassword({email:gE(),password:gP()});
        if(r.error) say(r.error.message);
      } else {
        if(!gE()||gP().length<6){say("Use a valid email and a 6+ character password.");return;}
        const r=await sb.auth.signUp({email:gE(),password:gP()});
        if(r.error) say(r.error.message);
        else if(r.data && r.data.session) say("Account created \u2014 you are signed in!",true);
        else say("Account created. If email confirmation is on, check your inbox; otherwise just log in.",true);
      }
    };
  }
  function renderNav(){
    if(sb && currentSession){
      navArea.innerHTML='<div class="nav"><button id="navSearch" class="'+(view==="search"?"on":"")+'">Search</button>'+
        '<button id="navPortfolio" class="'+(view==="portfolio"?"on":"")+'">My Portfolio</button></div>';
      document.getElementById("navSearch").onclick=function(){ setView("search"); };
      document.getElementById("navPortfolio").onclick=function(){ setView("portfolio"); };
    } else { navArea.innerHTML=""; }
  }
  function applyView(){
    document.getElementById("searchView").style.display=(view==="search")?"":"none";
    document.getElementById("portfolioView").style.display=(view==="portfolio")?"":"none";
  }
  function setView(v){ view=v; applyView(); renderNav(); if(v==="portfolio") loadPortfolio(); }

  if(sb){
    sb.auth.getSession().then(function(res){ currentSession=res.data.session; renderAuth(); renderNav(); });
    sb.auth.onAuthStateChange(function(_e,session){ currentSession=session; panelOpen=false; if(!session){ view="search"; applyView(); } renderAuth(); renderNav(); });
  } else { renderAuth(); }

  // ---------- PORTFOLIO ----------
  async function addToPortfolio(){
    if(!sb || !currentSession || !lastResult) return;
    const btn=document.getElementById("addPf");
    btn.disabled=true; btn.textContent="Adding…";
    const r=await sb.from("holdings").insert({
      query:lastResult.query, title:lastResult.title, grade:lastResult.grade,
      image_url:lastResult.image, added_value:lastResult.median
    });
    if(r.error){ btn.disabled=false; btn.textContent="+ Add to my portfolio"; alert("Could not add: "+r.error.message); }
    else { btn.textContent="\u2713 Added to portfolio"; }
  }
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
    if(r.error){ list.innerHTML='<div class="err"><b>Could not load portfolio.</b> '+r.error.message+'</div>'; return; }
    const holds=r.data||[];
    if(!holds.length){ list.innerHTML='<div class="card">No cards yet. Go to <b>Search</b>, look up a card, and tap <b>“Add to my portfolio.”</b></div>'; return; }
    const valued=await Promise.all(holds.map(async function(h){
      const manual=(h.manual_value!=null && h.manual_value!=="")?Number(h.manual_value):null;
      if(manual!=null && !isNaN(manual)){ return {h:h, current:manual, manual:true}; }
      try{
        const res=await fetch("/api?q="+encodeURIComponent(h.query)+"&limit=20&sort=date_desc");
        const j=await res.json();
        const sm=summarize(j.data||[]);
        return {h:h, current:sm.median, manual:false};
      }catch(e){ return {h:h, current:0, manual:false}; }
    }));
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
      const glHtml=add>0?('<div style="font-size:12px;color:'+(diff>=0?"var(--up)":"var(--down)")+'">'+(diff>=0?"+":"")+money(diff)+' ('+(dpct>=0?"+":"")+dpct.toFixed(0)+'%)</div>'):'<div style="font-size:12px;color:var(--dim)">\u2014</div>';
      rows+='<div class="hrow">'+
        (img?('<img src="'+img+'" onerror="this.remove()" style="width:34px;height:48px;object-fit:cover;border-radius:4px;background:var(--surface2);flex-shrink:0"/>'):('<div style="width:34px;height:48px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+((h.title||h.query)+"").replace(/</g,"&lt;")+'</div>'+
        '<div style="font-size:11px;color:var(--dim)">'+(h.grade||"")+' · added '+money(add)+'</div></div>'+
        '<div style="text-align:right"><div class="mono" style="font-weight:700">'+money(v.current)+manualTag+'</div>'+glHtml+'</div>'+
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
    Array.prototype.forEach.call(list.querySelectorAll(".ed"),function(b){
      b.onclick=function(){
        const id=b.getAttribute("data-edit");
        const found=valued.filter(function(v){return v.h.id===id;})[0];
        const h=found?found.h:null;
        const cur=(h && h.manual_value!=null && h.manual_value!=="")?Number(h.manual_value):null;
        openValueModal(id,(h&&(h.title||h.query))||"This card",cur);
      };
    });
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
      const stats='<div class="card"><div class="stats">'+
        '<div class="stat"><div class="l">'+(confirmed.length?"Confirmed sales":"Sales found")+'</div><div class="v">'+(confirmed.length||sales.length)+'</div></div>'+
        '<div class="stat"><div class="l">Average</div><div class="v">'+money(avg)+'</div></div>'+
        '<div class="stat hl"><div class="l">Median</div><div class="v">'+money(med)+'</div></div>'+
        '<div class="stat"><div class="l">Low</div><div class="v">'+money(lo)+'</div></div>'+
        '<div class="stat"><div class="l">High</div><div class="v">'+money(hi)+'</div></div>'+
        '</div><div class="insight" style="margin-top:10px">'+basisLabel+' · last 7 days</div>'+notes+'</div>';
      const addHtml = (sb && currentSession) ? '<button class="addbtn" id="addPf">+ Add to my portfolio ('+money(med)+')</button>' : '';
      const renderSale=function(s){
        const g=(s.grader&&s.grade)?(s.grader+" "+s.grade):(s.grade?("Grade "+s.grade):"Raw/Ungraded");
        const img=s.thumbnail_url||s.image_url||"";
        const link=s.listing_url||"#";
        const title=(s.title||"Untitled listing").replace(/</g,"&lt;");
        const pend=isPending(s);
        const pTag=pend?' <span style="font-size:10px;color:var(--gold);border:1px solid var(--gold);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:1px">PENDING</span>':"";
        return '<div class="sale" style="'+(pend?"opacity:.7":"")+'">'+
          (img?('<img src="'+img+'" alt="" loading="lazy"/>'):('<div style="width:38px;height:53px;border-radius:4px;background:var(--surface2);flex-shrink:0"></div>'))+
          '<div class="t"><a href="'+link+'" target="_blank" rel="noopener">'+title+'</a>'+
          '<div class="meta">'+(s.sale_date||"")+' · '+g+' · '+(s.platform||"")+(s.listing_type==="best_offer"?" · Best Offer":"")+'</div></div>'+
          '<div class="p">'+money(s.price)+pTag+'</div></div>';
      };
      const rows=confirmed.concat(pending).map(renderSale).join("");
      out.innerHTML=stats+addHtml+'<div class="card"><label>RECENT SOLD LISTINGS</label>'+rows+'</div>';
      if(sb && currentSession){ var ab=document.getElementById("addPf"); if(ab) ab.onclick=addToPortfolio; }
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
</script>
</body>
</html>`;