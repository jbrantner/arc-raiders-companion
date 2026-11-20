/* Stash manager: pulls your stash from ArcTracker (or takes it by hand) and says what to keep, sell or recycle
   based on what your workshop upgrades, projects and quests still need. Everything is saved in this browser only. */
(function(){
"use strict";
const D = window.ARC_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- game data ---------- */
const ITEMS = {}; D.items.forEach(i => ITEMS[i.id] = i);
const BY_NAME = {}; D.items.forEach(i => { BY_NAME[norm(i.n)] = i.id; });
function norm(s){ return String(s||"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
const RARITY = ["Common","Uncommon","Rare","Epic","Legendary"];
const MATERIAL = new Set(["Basic Material","Refined Material","Topside Material","Nature","Research"]);
const JUNK = new Set(["Recyclable","Trinket"]);
const IMG = id => "https://cdn.arctracker.io/items/v2/" + encodeURIComponent(id) + ".png";
const nowSec = Date.now()/1000;
const PROJECTS = D.projects.filter(p => p.ph.length && (!p.end || p.end > nowSec) && (!p.start || p.start < nowSec + 86400*14));
const STATIONS = D.hideout.filter(m => m.lv.some(l => l.q.length));
const QUESTS = D.quests;

/* ---------- saved state ---------- */
const KEY = "arc-inv-v1", KEYS = "arc-inv-keys";
let S = { stash:{}, extra:{}, source:"", syncedAt:0, plan:{ hideout:{}, nextOnly:false, projects:{}, quests:{} }, auto:{} };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.stash) S = Object.assign(S, s, { plan: Object.assign(S.plan, s.plan||{}) }); } catch(e){}
let K = { app:"", user:"" }; try { Object.assign(K, JSON.parse(localStorage.getItem(KEYS))||{}); } catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
function saveKeys(){ try { localStorage.setItem(KEYS, JSON.stringify(K)); } catch(e){} }
let filter = "all"; try { filter = localStorage.getItem(KEY+"-f") || "all"; } catch(e){}
let sortBy = "value"; try { sortBy = localStorage.getItem(KEY+"-s") || "value"; } catch(e){}

function info(id){ return ITEMS[id] || { id, n: (S.extra[id]&&S.extra[id].n) || id.replace(/_/g," "), t: (S.extra[id]&&S.extra[id].t) || "Unknown", r: (S.extra[id]&&S.extra[id].r) || "Common", v: (S.extra[id]&&S.extra[id].v) || 0 }; }
const fmt = n => n >= 1e6 ? (n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,"")+"M" : n >= 1e4 ? Math.round(n/1e3)+"k" : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,"")+"k" : String(Math.round(n));

/* ---------- what you still need ---------- */
function needs(){
  const N = {}; // id -> {q, src:[[label,q]]}
  const add = (id, q, label) => { if(!q) return; const n = N[id] || (N[id] = { q:0, src:[] }); n.q += q; n.src.push([label, q]); };
  STATIONS.forEach(m => {
    const cur = +S.plan.hideout[m.id] || 0;
    m.lv.filter(l => l.l > cur && (!S.plan.nextOnly || l.l === cur + 1)).forEach(l => l.q.forEach(([id,q]) => add(id, q, m.n + " " + l.l)));
  });
  PROJECTS.forEach(p => {
    const st = S.plan.projects[p.id] || {}; if (st.off) return;
    const done = +st.done || 0;
    p.ph.filter(f => f.p > done).forEach(f => f.q.forEach(([id,q]) => add(id, q, shortProj(p.n) + " P" + f.p)));
  });
  QUESTS.forEach(qu => { if (!S.plan.quests[qu.id]) qu.q.forEach(([id,q]) => add(id, q, qu.n)); });
  return N;
}
const shortProj = n => n.replace(/^Expedition Project \(Expedition (\d+)\)$/,"Expedition $1").replace(/^Expedition \(Expedition (\d+)\)$/,"Expedition $1");

/* ---------- keep / sell / recycle ---------- */
function recycleValue(it){ let v = 0; for (const k in (it.rc||{})) v += (ITEMS[k]?.v||0) * it.rc[k]; return v; }
function judge(id, have, N, short){
  const it = info(id), need = N[id]?.q || 0, keep = Math.min(have, need), spare = have - keep;
  const rv = recycleValue(it);
  const feeds = Object.keys(it.rc||{}).filter(k => short[k]);
  let v, why;
  if (spare <= 0) { v = "keep"; why = "All " + have + " go to your plan."; }
  else if (JUNK.has(it.t) || (it.rc && !MATERIAL.has(it.t) && !isGear(it))) {
    if (feeds.length) { v = "recycle"; why = "Recycle: it gives " + feeds.map(k => info(k).n).join(", ") + ", which you still need."; }
    else if (rv > (it.v||0)) { v = "recycle"; why = "Recycling is worth more (" + fmt(rv) + " vs " + fmt(it.v||0) + " each)."; }
    else { v = "sell"; why = it.rc ? "Selling is worth more (" + fmt(it.v||0) + " vs " + fmt(rv) + " in parts)." : "Nothing needs it and it doesn't recycle."; }
  }
  else if (!ITEMS[id]) { v = "spare"; why = "This item isn't in the app's item list yet, so there's no advice for it."; }
  else if (MATERIAL.has(it.t)) { v = "spare"; why = "Crafting material your plan doesn't need. Keep some for crafting, sell extras if space is tight."; }
  else { v = "gear"; why = "Gear: use it or sell it, your call."; }
  if (keep > 0 && spare > 0) why = "Keep " + keep + " for your plan. " + why.replace(/^All \d+ go to your plan\. ?/,"") + " (" + spare + " spare)";
  return { v, why, keep, spare, need, rv, feeds };
}
const isGear = it => !MATERIAL.has(it.t) && !JUNK.has(it.t);

/* ---------- render ---------- */
const list = $("#list");
function compute(){
  const N = needs();
  const short = {}; for (const id in N) { const h = S.stash[id]||0; if (h < N[id].q) short[id] = N[id].q - h; }
  const rows = Object.keys(S.stash).filter(id => S.stash[id] > 0).map(id => { const it = info(id), have = S.stash[id]; return { id, it, have, j: judge(id, have, N, short) }; });
  return { N, short, rows };
}
let C;
function render(){
  C = compute();
  const { N, short, rows } = C;
  const counts = { all: rows.length, keep: rows.filter(r => r.j.keep > 0).length, sell: rows.filter(r => r.j.v === "sell").length, recycle: rows.filter(r => r.j.v === "recycle").length, need: Object.keys(short).length };
  document.querySelectorAll("#filters button").forEach(b => { b.setAttribute("aria-selected", b.dataset.f === filter); b.querySelector("span").textContent = counts[b.dataset.f]; });
  $("#statItems").textContent = rows.reduce((a,r) => a + r.have, 0);
  $("#statValue").textContent = fmt(rows.reduce((a,r) => a + r.have * (r.it.v||0), 0));
  $("#linkBtn").textContent = K.app && K.user ? "Sync" : "Link";
  $("#linkBtn").classList.toggle("hot", !(K.app && K.user) || !S.syncedAt);
  const q = norm($("#q").value);
  let html = "";
  if (!rows.length && filter !== "need") {
    html = `<li class="empty"><h3>Stash is empty</h3><p>Link ArcTracker to pull in your real stash, or add items by hand.</p><div class="row"><button class="abtn hot" data-act="link" type="button">Link ArcTracker</button><button class="abtn" data-act="add" type="button">Add by hand</button></div></li>`;
    setNote(""); list.innerHTML = html; return;
  }
  if (filter === "need") {
    let ids = Object.keys(short).filter(id => !q || norm(info(id).n).includes(q));
    ids.sort((a,b) => sortCmp(a, b, short));
    html = ids.map(id => { const it = info(id), have = S.stash[id]||0, need = N[id].q, pct = Math.min(100, have/need*100);
      return `<li class="it" data-id="${esc(id)}" data-r="${esc(it.r)}"><div class="pic"><img loading="lazy" alt="" src="${IMG(id)}" onerror="this.remove()"></div>
      <div class="nm">${esc(it.n)}</div><div class="vd"><span class="tag need">${short[id]} more</span><small>${have}/${need}</small></div>
      <div class="sub">${esc(N[id].src.map(s => s[0]).join(" · "))}</div><div class="bar2"><b style="width:${pct}%"></b></div></li>`; }).join("");
    setNote(ids.length ? `<b>${ids.length}</b> items short for your plan. Tap <b>Plan</b> to set your workshop levels and projects.` : "You have everything your plan needs.");
  } else {
    let rs = rows.filter(r => (filter === "all" || (filter === "keep" ? r.j.keep > 0 : r.j.v === filter)) && (!q || norm(r.it.n).includes(q)));
    rs.sort((a,b) => sortCmp(a.id, b.id));
    html = rs.map(r => { const { it, have, j } = r;
      let tag, small;
      if (filter === "keep" || (j.keep > 0 && j.spare === 0)) { tag = `<span class="tag keep">Keep${j.spare>0?" "+j.keep:""}</span>`; small = j.need > have ? `need ${j.need-have} more` : `for plan`; }
      else { tag = `<span class="tag ${j.v}">${{sell:"Sell",recycle:"Recycle",spare:"Spare",gear:"Gear",keep:"Keep"}[j.v]}${j.keep>0?" "+j.spare:""}</span>`;
        small = j.v === "recycle" ? "→ " + fmt(j.rv*j.spare) : fmt((it.v||0)*j.spare); }
      return `<li class="it" data-id="${esc(r.id)}" data-r="${esc(it.r)}"><div class="pic"><img loading="lazy" alt="" src="${IMG(r.id)}" onerror="this.remove()"><i>${have}</i></div>
      <div class="nm">${esc(it.n)}</div><div class="vd">${tag}<small>${small}</small></div>
      <div class="sub">${esc(it.t)} · ${fmt(it.v||0)} each${j.keep>0&&j.spare>0?" · keep "+j.keep:""}</div></li>`; }).join("");
    if (!rs.length) html = `<li class="empty"><p>${q ? "No match in your stash." : "Nothing here."}</p></li>`;
    const sellV = rows.filter(r => r.j.v === "sell").reduce((a,r) => a + r.j.spare*(r.it.v||0), 0);
    setNote(filter === "sell" ? `Selling all of these brings about <b>${fmt(sellV)}</b>.` :
            filter === "recycle" ? "Recycle these at your workshop instead of selling." :
            filter === "keep" ? "Items your workshop, projects or quests still use." :
            (S.syncedAt ? `Synced from ArcTracker ${ago(S.syncedAt)}.` : S.source === "manual" ? "Entered by hand." : "") + ` <a href="#" data-act="link">Keys &amp; import</a>`);
  }
  list.innerHTML = html;
}
function sortCmp(a, b, short){
  const A = info(a), B = info(b);
  if (sortBy === "name") return A.n.localeCompare(B.n);
  if (sortBy === "qty") return (short ? short[b]-short[a] : S.stash[b]-S.stash[a]) || A.n.localeCompare(B.n);
  if (sortBy === "rarity") return RARITY.indexOf(B.r) - RARITY.indexOf(A.r) || A.n.localeCompare(B.n);
  const va = (A.v||0) * (short ? short[a] : S.stash[a]), vb = (B.v||0) * (short ? short[b] : S.stash[b]);
  return vb - va || A.n.localeCompare(B.n);
}
function setNote(h){ $("#note").innerHTML = h; }
function ago(t){ const m = Math.round((Date.now()-t)/60000); return m < 1 ? "just now" : m < 60 ? m+" min ago" : m < 1440 ? Math.round(m/60)+" h ago" : Math.round(m/1440)+" d ago"; }

/* ---------- item sheet ---------- */
const sheet = $("#itemSheet"), scrim = $("#scrim");
let openId = null;
function openItem(id){
  openId = id; const it = info(id), have = S.stash[id]||0, N = C.N[id], j = judge(id, have, C.N, C.short);
  const parts = o => Object.keys(o||{}).map(k => `<span>${o[k]}× ${esc(info(k).n)}${C.short[k] ? " ★" : ""}</span>`).join("") || "<span>—</span>";
  const short = C.short[id];
  sheet.style.setProperty("--rc", `var(--r-${(it.r||"common").toLowerCase()})`);
  sheet.innerHTML = `<div class="hd"><div class="pic"><img alt="" src="${IMG(id)}" onerror="this.remove()"></div><div><h3>${esc(it.n)}</h3><div class="meta">${esc(it.r||"")} · ${esc(it.t||"")}</div></div></div>
    <p class="why">${short ? `<span class="tag need">Need ${short} more</span>` : `<span class="tag ${j.keep>0&&!j.spare?"keep":j.v}">${j.keep>0&&!j.spare?"Keep":{sell:"Sell",recycle:"Recycle",spare:"Spare",gear:"Gear",keep:"Keep"}[j.v]}</span>`}${have ? esc(j.why) : ""}</p>
    <dl class="kv">
      <dt>Sells for</dt><dd>${fmt(it.v||0)} each${have>1?" · "+fmt((it.v||0)*have)+" all":""}</dd>
      ${it.rc ? `<dt>Recycles</dt><dd>${parts(it.rc)}<span style="color:var(--muted)">worth ${fmt(recycleValue(it))}</span></dd>` : ""}
      ${it.sv ? `<dt>Salvages</dt><dd>${parts(it.sv)}</dd>` : ""}
      ${N ? `<dt>Needed</dt><dd>${N.src.map(s => `<span>${s[1]}× ${esc(s[0])}</span>`).join("")}</dd>` : ""}
      ${it.s ? `<dt>Stack</dt><dd>${it.s}${it.w!=null?" · "+it.w+" kg":""}</dd>` : ""}
    </dl>
    <div class="qty"><button type="button" data-q="-1" aria-label="One less">−</button><input id="qtyIn" type="number" inputmode="numeric" min="0" value="${have}" aria-label="How many you have"><button type="button" data-q="1" aria-label="One more">+</button></div>
    ${C.short && Object.keys(it.rc||{}).some(k => C.short[k]) ? `<p class="fine">★ = something you still need.</p>` : ""}
    <div class="row"><button class="abtn grow" data-act="close" type="button">Close</button></div>`;
  sheet.hidden = false; scrim.hidden = false;
}
function closeItem(){ sheet.hidden = true; scrim.hidden = true; openId = null; }
function setQty(id, n){ n = Math.max(0, Math.min(99999, Math.round(+n||0))); if (n) S.stash[id] = n; else delete S.stash[id]; if (!S.source) S.source = "manual"; save(); render(); }
sheet.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.act === "close") return closeItem();
  if (b.dataset.q) { const inp = $("#qtyIn"); inp.value = Math.max(0, (+inp.value||0) + +b.dataset.q); setQty(openId, inp.value); }
});
sheet.addEventListener("change", e => { if (e.target.id === "qtyIn") setQty(openId, e.target.value); });
scrim.addEventListener("click", closeItem);
list.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (a) { a.dataset.act === "link" ? openPanel("linkPanel") : openPanel("addPanel"); return; }
  const li = e.target.closest(".it"); if (li) openItem(li.dataset.id);
});

/* ---------- panels ---------- */
function openPanel(id){ closeItem(); document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== id);
  if (id === "linkPanel") fillLink(); if (id === "planPanel") fillPlan(); if (id === "addPanel") { $("#addQ").value = ""; fillAdd(); setTimeout(() => $("#addQ").focus(), 50); } }
function closePanels(){ document.querySelectorAll(".panel").forEach(p => p.hidden = true); render(); }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closePanels));
$("#planBtn").addEventListener("click", () => openPanel("planPanel"));
$("#linkBtn").addEventListener("click", () => { if (K.app && K.user && S.syncedAt && Date.now() - S.syncedAt > 0) sync(); else openPanel("linkPanel"); });
$("#linkBtn").addEventListener("contextmenu", e => { e.preventDefault(); openPanel("linkPanel"); });
$("#addBtn").addEventListener("click", () => openPanel("addPanel"));
$("#note").addEventListener("click", e => { if (e.target.closest("[data-act=link]")) { e.preventDefault(); openPanel("linkPanel"); } });

/* add by hand */
function fillAdd(){
  const q = norm($("#addQ").value);
  const ids = D.items.filter(i => !q || norm(i.n).includes(q)).sort((a,b) => (q && norm(b.n).startsWith(q)) - (q && norm(a.n).startsWith(q)) || a.n.localeCompare(b.n)).slice(0, 80);
  $("#addList").innerHTML = ids.map(it => `<li class="it" data-id="${esc(it.id)}" data-r="${esc(it.r)}"><div class="pic"><img loading="lazy" alt="" src="${IMG(it.id)}" onerror="this.remove()">${S.stash[it.id]?`<i>${S.stash[it.id]}</i>`:""}</div><div class="nm">${esc(it.n)}</div><div class="vd"><small>${fmt(it.v||0)}</small></div><div class="sub">${esc(it.r)} · ${esc(it.t)}</div></li>`).join("") || `<li class="empty"><p>No item by that name.</p></li>`;
}
$("#addQ").addEventListener("input", fillAdd);
$("#addList").addEventListener("click", e => { const li = e.target.closest(".it"); if (!li) return; const id = li.dataset.id;
  document.querySelectorAll(".panel").forEach(p => p.hidden = true);
  if (!S.stash[id]) setQty(id, 1); else render(); openItem(id); });

/* link + import */
function fillLink(){
  $("#appKey").value = K.app; $("#userKey").value = K.user;
  const st = $("#linkStatus");
  if (S.syncedAt) { st.className = "card ok"; st.innerHTML = `<h3>Linked</h3><p>Last sync ${ago(S.syncedAt)}: ${Object.keys(S.stash).length} kinds of items.${S.auto.who ? " Account: " + esc(S.auto.who) + "." : ""}</p><p class="fine">${S.auto.note ? esc(S.auto.note) : ""}</p><div class="row"><button class="abtn" id="debugBtn" type="button">Copy sync details</button></div>`; }
  else if (S.source === "manual") { st.className = "card"; st.innerHTML = `<h3>Entered by hand</h3><p>${Object.keys(S.stash).length} kinds of items. Link ArcTracker below to pull your real stash instead.</p>`; }
  else { st.className = "card"; st.innerHTML = `<h3>Not linked yet</h3><p>Link ArcTracker to see your real stash here. It needs two keys, both free.</p>`; }
  $("#dataDate").textContent = new Date(D.generatedAt).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}
$("#linkStatus").addEventListener("click", e => { if (e.target.id === "debugBtn") copy(JSON.stringify(lastDebug || S.auto.debug || {}, null, 1), "Copied. Paste it to Claude if something looks off."); });
$("#syncBtn").addEventListener("click", () => {
  K.app = $("#appKey").value.trim(); K.user = $("#userKey").value.trim().replace(/^Bearer\s+/i, "");
  if (!K.app || !K.user) return toast("Paste both keys first.", true);
  saveKeys(); sync();
});
$("#forgetBtn").addEventListener("click", () => { K = { app:"", user:"" }; saveKeys(); fillLink(); toast("Keys removed from this device."); });
$("#exportBtn").addEventListener("click", () => copy(JSON.stringify(S.stash), "Stash copied as JSON."));
$("#clearBtn").addEventListener("click", () => { if (!Object.keys(S.stash).length) return; const old = S.stash; S.stash = {}; S.syncedAt = 0; save(); fillLink(); toast("Stash emptied. Tap to undo.", false, () => { S.stash = old; save(); fillLink(); render(); }); });
$("#importAdd").addEventListener("click", () => doImport(false));
$("#importReplace").addEventListener("click", () => doImport(true));
function doImport(replace){
  const txt = $("#importBox").value.trim(); if (!txt) return toast("Paste a list first.", true);
  const got = {}, miss = [];
  try { const j = JSON.parse(txt); const o = Array.isArray(j) ? Object.fromEntries(j.map(e => [entryId(e), entryQty(e)])) : j;
    for (const k in o) { const id = ITEMS[k] ? k : BY_NAME[norm(k)]; if (id) got[id] = (got[id]||0) + (+o[k]||0); else miss.push(k); } }
  catch(e) {
    txt.split(/\n+/).forEach(line => { line = line.trim(); if (!line) return;
      const m = line.match(/^(.*?)[\s,;:x×*\t]+(\d+)\s*$/i) || line.match(/^(\d+)\s*[x×*]?\s+(.*)$/i);
      let name, n; if (!m) { name = line; n = 1; } else if (/^\d+$/.test(m[1])) { n = +m[1]; name = m[2]; } else { name = m[1]; n = +m[2]; }
      name = name.replace(/[\s,;:x×*]+$/i, "");
      const id = findName(name); if (id) got[id] = (got[id]||0) + n; else miss.push(line); });
  }
  if (!Object.keys(got).length) return toast("Couldn't match any items. Check the names.", true);
  if (replace) S.stash = {};
  for (const id in got) S.stash[id] = (replace ? 0 : (S.stash[id]||0)) + got[id];
  if (replace) { S.syncedAt = 0; } S.source = S.syncedAt ? S.source : "manual"; save(); fillLink();
  $("#importBox").value = miss.join("\n");
  toast(`Added ${Object.keys(got).length} items.` + (miss.length ? ` ${miss.length} not matched (left in the box).` : ""), !!miss.length);
}
function findName(name){
  const n = norm(name); if (BY_NAME[n]) return BY_NAME[n];
  if (BY_NAME[n.replace(/s$/,"")]) return BY_NAME[n.replace(/s$/,"")];
  const hits = D.items.filter(i => norm(i.n).includes(n)); return hits.length === 1 ? hits[0].id : null;
}

/* ---------- ArcTracker sync ---------- */
const API = "https://arctracker.io/api/v2/user/";
let lastDebug = null, syncing = false;
async function call(path){
  const r = await fetch(API + path, { headers: { "X-App-Key": K.app, "Authorization": "Bearer " + K.user, "Accept": "application/json" } });
  let body = null; try { body = await r.json(); } catch(e){}
  if (!r.ok) { const err = new Error((body && body.error && body.error.message) || ("HTTP " + r.status)); err.status = r.status; throw err; }
  return body;
}
const firstArray = (o, keys) => { if (Array.isArray(o)) return o; if (!o || typeof o !== "object") return null;
  for (const k of keys) if (Array.isArray(o[k])) return o[k];
  for (const k in o) if (Array.isArray(o[k]) && o[k].length && typeof o[k][0] === "object") return o[k];
  for (const k in o) if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) { const a = firstArray(o[k], keys); if (a) return a; }
  return null; };
const pick = (e, ks) => { for (const k of ks) { const v = k.split(".").reduce((o,p) => o == null ? o : o[p], e); if (v != null && v !== "") return v; } return null; };
function entryId(e){
  const raw = pick(e, ["itemId","item_id","gameItemId","item.id","item.itemId","itemSlug","slug","id"]);
  const name = pick(e, ["name","itemName","item.name","name.en","item.name.en"]);
  if (raw && ITEMS[raw]) return raw;
  if (raw && ITEMS[String(raw).replace(/-/g,"_")]) return String(raw).replace(/-/g,"_");
  const byName = name && BY_NAME[norm(typeof name === "object" ? name.en : name)];
  if (byName) return byName;
  return raw ? String(raw) : (name ? norm(typeof name === "object" ? name.en : name).replace(/ /g,"_") : null);
}
function entryQty(e){ const q = pick(e, ["quantity","qty","amount","count","stackCount","stack","total"]); return q == null ? 1 : +q || 0; }
function shape(o, depth=0){ if (Array.isArray(o)) return [o.length + " items", o[0] && shape(o[0], depth+1)]; if (o && typeof o === "object" && depth < 3) { const r = {}; for (const k in o) r[k] = shape(o[k], depth+1); return r; } return typeof o === "string" && /^arc_/.test(o) ? "(key)" : o; }

async function sync(){
  if (syncing) return; syncing = true;
  const btns = [$("#linkBtn"), $("#syncBtn")]; btns.forEach(b => { b.disabled = true; }); $("#linkBtn").textContent = "…";
  lastDebug = { at: new Date().toISOString() };
  try {
    const all = []; let page = 1, first = null;
    while (page <= 10) {
      const body = await call(`stash?locale=en&per_page=500&page=${page}`); if (!first) first = body;
      const arr = firstArray(body.data ?? body, ["items","stash","slots","data"]) || [];
      all.push(...arr);
      const meta = Object.assign({}, body.meta || {}, (body.data && body.data.pagination) || {}, body.pagination || {});
      const pages = meta.totalPages || meta.total_pages || meta.pages || meta.lastPage || meta.last_page;
      if (pages ? page >= pages : arr.length < 500) break; page++;
    }
    lastDebug.stash = shape(first);
    const stash = {}, extra = {};
    all.forEach(e => { const id = entryId(e); if (!id) return; stash[id] = (stash[id]||0) + entryQty(e);
      if (!ITEMS[id]) { const n = pick(e, ["name","itemName","item.name"]); extra[id] = { n: typeof n === "object" && n ? n.en : (n || id), t: pick(e, ["type","item.type","category"]) || "Unknown", r: pick(e, ["rarity","item.rarity"]) || "Common", v: +pick(e, ["value","item.value","sellValue"]) || 0 }; } });
    S.stash = stash; S.extra = extra; S.source = "arctracker"; S.syncedAt = Date.now();
    const notes = [];
    await Promise.all([
      call("profile").then(b => { const d = b.data || b; S.auto.who = pick(d, ["username","displayName","name","user.username"]) || ""; }).catch(() => {}),
      call("hideout?locale=en").then(b => { lastDebug.hideout = shape(b); const arr = firstArray(b.data ?? b, ["modules","hideout","hideoutModules"]) || [];
        let n = 0; arr.forEach(m => { const id = pick(m, ["moduleId","module_id","hideoutModuleId","id","module.id","slug"]); const lv = pick(m, ["currentLevel","current_level","level","unlockedLevel"]);
          const sid = id && (D.hideout.find(h => h.id === id || h.id === String(id).replace(/-/g,"_")) || D.hideout.find(h => norm(h.n) === norm(pick(m,["name","module.name"]) || "")));
          if (sid && lv != null) { S.plan.hideout[sid.id] = +lv; n++; } });
        if (n) notes.push("workshop levels"); }).catch(e => { lastDebug.hideoutErr = e.status || e.message; }),
      call("quests?locale=en&filter=completed").then(b => { lastDebug.quests = shape(b); const arr = firstArray(b.data ?? b, ["quests","completed"]) || [];
        let n = 0; arr.forEach(q => { const id = pick(q, ["questId","quest_id","id","quest.id","slug"]); const done = pick(q, ["completed","isCompleted","status"]);
          if (done === false || (typeof done === "string" && !/complete/i.test(done))) return;
          const qq = QUESTS.find(x => x.id === id || x.id === String(id).replace(/-/g,"_") || x.n === pick(q,["name","quest.name"])); if (qq) { S.plan.quests[qq.id] = true; n++; } });
        if (arr.length) notes.push("finished quests"); }).catch(e => { lastDebug.questsErr = e.status || e.message; }),
      call("projects?locale=en").then(b => { lastDebug.projects = shape(b); const arr = firstArray(b.data ?? b, ["projects"]) || [];
        let n = 0; arr.forEach(p => { const id = pick(p, ["projectId","project_id","id","project.id"]); const pr = PROJECTS.find(x => x.id === id); if (!pr) return;
          let done = pick(p, ["completedPhases","phasesCompleted","completed_phases","currentPhase","phase"]);
          if (Array.isArray(done)) done = done.length; if (done != null) { const st = S.plan.projects[pr.id] || (S.plan.projects[pr.id] = {}); st.done = +done; n++; } });
        if (n) notes.push("project phases"); }).catch(e => { lastDebug.projectsErr = e.status || e.message; }),
    ]);
    S.auto.note = notes.length ? "Also filled in your " + notes.join(", ") + " from ArcTracker." : "Your workshop levels and projects didn't come through, so set them under Plan.";
    S.auto.debug = lastDebug; save();
    toast(`Synced ${all.length ? Object.keys(stash).length + " kinds of items" : "an empty stash"} from ArcTracker.`);
    document.querySelectorAll(".panel").forEach(p => p.hidden = true);
  } catch(e) {
    lastDebug.error = e.status + " " + e.message;
    const m = e.status === 401 ? "ArcTracker didn't accept the keys. Check both are pasted in full." :
              e.status === 403 ? "That key is missing stash:read. Make a new personal key with it ticked." :
              e.status === 404 ? "ArcTracker has no stash for you yet. Link your game account on arctracker.io first." :
              e.status === 429 ? "Too many syncs this hour. Try again later." :
              e.status ? "ArcTracker said: " + e.message : "Couldn't reach ArcTracker. Check your connection.";
    toast(m, true); if (document.querySelector("#linkPanel").hidden) openPanel("linkPanel"); else fillLink();
  } finally { syncing = false; btns.forEach(b => b.disabled = false); render(); }
}

/* ---------- plan ---------- */
function fillPlan(){
  $("#planSrc").textContent = S.syncedAt && S.auto.note ? S.auto.note : "Set where you are so the app knows what to keep.";
  $("#nextOnly").checked = !!S.plan.nextOnly;
  $("#hideoutList").innerHTML = STATIONS.map(m => { const cur = +S.plan.hideout[m.id]||0, max = Math.max(...m.lv.map(l => l.l));
    return `<li data-h="${m.id}"><div class="nm">${esc(m.n)}<small>${cur >= max ? "Maxed" : "Next: level " + (cur+1)}</small></div><div class="st"><button type="button" data-d="-1" aria-label="Lower">−</button><b>${cur}/${max}</b><button type="button" data-d="1" aria-label="Raise">+</button></div></li>`; }).join("");
  $("#projectList").innerHTML = PROJECTS.map(p => { const st = S.plan.projects[p.id] || {}, done = +st.done||0, max = p.ph.length;
    const ends = p.end && p.end < 2e9 ? " · ends " + new Date(p.end*1000).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "";
    return `<li data-p="${p.id}" class="${st.off?"off":""}"><input type="checkbox" ${st.off?"":"checked"} aria-label="Track ${esc(p.n)}"><div class="nm">${esc(shortProj(p.n))}<small>${done >= max ? "Done" : "Phases done"}${ends}</small></div><div class="st"><button type="button" data-d="-1" aria-label="Fewer">−</button><b>${done}/${max}</b><button type="button" data-d="1" aria-label="More">+</button></div></li>`; }).join("") || `<li><div class="nm">No active projects.</div></li>`;
  $("#questList").innerHTML = QUESTS.slice().sort((a,b) => (!!S.plan.quests[a.id]) - (!!S.plan.quests[b.id]) || a.n.localeCompare(b.n)).map(q =>
    `<li><label><input type="checkbox" data-q="${q.id}" ${S.plan.quests[q.id]?"checked":""}><span>${esc(q.n)}<small>${esc(q.tr||"")} · ${q.q.map(([id,n]) => n + "× " + esc(info(id).n)).join(", ")}</small></span></label></li>`).join("");
}
$("#nextOnly").addEventListener("change", e => { S.plan.nextOnly = e.target.checked; save(); });
$("#hideoutList").addEventListener("click", e => { const b = e.target.closest("button[data-d]"); if (!b) return; const id = b.closest("li").dataset.h, m = STATIONS.find(x => x.id === id), max = Math.max(...m.lv.map(l => l.l));
  S.plan.hideout[id] = Math.max(0, Math.min(max, (+S.plan.hideout[id]||0) + +b.dataset.d)); save(); fillPlan(); });
$("#projectList").addEventListener("click", e => { const li = e.target.closest("li[data-p]"); if (!li) return; const st = S.plan.projects[li.dataset.p] || (S.plan.projects[li.dataset.p] = {});
  if (e.target.matches("input")) { st.off = !e.target.checked; save(); fillPlan(); return; }
  const b = e.target.closest("button[data-d]"); if (!b) return; const max = PROJECTS.find(p => p.id === li.dataset.p).ph.length;
  st.done = Math.max(0, Math.min(max, (+st.done||0) + +b.dataset.d)); save(); fillPlan(); });
$("#questList").addEventListener("change", e => { const id = e.target.dataset.q; if (!id) return; if (e.target.checked) S.plan.quests[id] = true; else delete S.plan.quests[id]; save(); });

/* ---------- filters, search, toast ---------- */
$("#filters").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; try { localStorage.setItem(KEY+"-f", filter); } catch(e){} list.scrollTop = 0; render(); });
$("#q").addEventListener("input", render);
$("#sort").value = sortBy; $("#sort").addEventListener("change", e => { sortBy = e.target.value; try { localStorage.setItem(KEY+"-s", sortBy); } catch(e){} render(); });
let toastT, toastFn;
function toast(m, bad, onTap){ const t = $("#toast"); t.textContent = m; t.classList.toggle("bad", !!bad); toastFn = onTap || null; clearTimeout(toastT); toastT = setTimeout(() => { t.textContent = ""; }, bad ? 6000 : 3500); }
$("#toast").addEventListener("click", () => { const f = toastFn; $("#toast").textContent = ""; toastFn = null; if (f) f(); });
function copy(txt, msg){ (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(msg), () => { $("#importBox").value = txt; openPanel("linkPanel"); toast("Couldn't copy, so it's in the box below. Select and copy it there."); }); }
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!sheet.hidden) closeItem(); else closePanels(); } });

render();
// Pull a fresh stash when the app is opened, at most every 10 minutes.
if (K.app && K.user && S.syncedAt && Date.now() - S.syncedAt > 10*60*1000) sync();
})();
