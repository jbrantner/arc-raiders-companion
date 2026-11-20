/* Loadout planner: augment, shield, two weapons (tier, Amplified upgrades, mods), quick use, safe pocket, augment extra slots and backpack.
   Saves on this device, makes share codes, and marks what you own using the Stash screen's saved stash. */
"use strict";
const D = window.LOADOUT_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const ICONS = window.ITEM_ICONS || {};
/* bundled picture when we have one (icons/items), otherwise ArcTracker's image server */
const IMG = id => ICONS[id] ? "icons/items/" + ICONS[id] + ".webp?v=1" : "https://cdn.arctracker.io/items/v2/" + encodeURIComponent(id) + ".png";
const img = (id, cls) => `<img loading="lazy" alt=""${cls ? ` class="${cls}"` : ""} src="${IMG(id)}" onerror="this.remove()">`;
const fmt = n => n >= 10000 ? (Math.round(n / 100) / 10) + "k" : String(Math.round(n));
const kg = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

/* ---------- lookups ---------- */
const ITEM = {};
const put = (l, kind) => l.forEach(x => { ITEM[x.id] = Object.assign({ kind }, x); });
put(D.augments, "aug"); put(D.shields, "shield"); put(D.mods, "mod"); put(D.quick, "quick"); put(D.ammo, "ammo"); put(D.trinkets, "trinket");
const WEAP = {}; D.weapons.forEach(w => { WEAP[w.id] = w; w.tiers.forEach(t => ITEM[t[1]] = { id: t[1], n: t[0] === "amp" ? "Amplified " + w.n : t[0] === "one" ? w.n : w.n + " " + t[0].toUpperCase(), r: t[2], w: t[3], v: t[4], kind: "weapon", s: 1 });
  const amp = w.tiers.find(t => t[0] === "amp"); if (amp) w.combos.forEach(c => ITEM[c[0]] = Object.assign({}, ITEM[amp[1]], { id: c[0], n: "Amplified " + w.n, ups: c[1].map(u => w.ups[u]) })); });
const FREE = D.augments.find(a => a.id === "free_loadout_augment") || { bp: 14, q: 4, sp: 0, kg: 35, sh: "L" };
const SHK = { L: "Light", M: "Medium", H: "Heavy" };
const SLOTS = [["muzzle", "Muzzle"], ["grip", "Grip"], ["mag", "Mag"], ["stock", "Stock"], ["tech", "Tech"]];
const TIERN = { i: "I", ii: "II", iii: "III", iv: "IV", one: "—", amp: "Amp" };
const XLAB = { grenade: "Grenade", heal: "Heal", utility: "Utility", trinket: "Trinket" };
const QCATS = [["all", "All"], ["heal", "Heal"], ["grenade", "Grenade"], ["trap", "Trap"], ["gadget", "Gadget"], ["other", "Other"]];
const BCATS = [["all", "All"], ["ammo", "Ammo"], ["heal", "Heal"], ["grenade", "Grenade"], ["trap", "Trap"], ["gadget", "Gadget"], ["mod", "Mods"], ["trinket", "Trinkets"], ["other", "Other"]];
const catOf = it => it.kind === "quick" ? it.c : it.kind;
const CORD = ["ammo", "heal", "grenade", "trap", "gadget", "mod", "other", "trinket"];
/* short labels shown under mod icons and behind item icons (if an image can't load) */
const MODAB = [["compensator", "Comp"], ["extended_barrel", "Barrel"], ["muzzle_brake", "Brake"], ["shotgun_silencer", "Silencer"], ["silencer", "Silencer"], ["shotgun_choke", "Choke"], ["angled", "Angled"], ["vertical", "Vertical"], ["horizontal", "Horiz"], ["_mag", "Ext mag"], ["stable", "Stable"], ["padded", "Padded"], ["lightweight", "Light"], ["kinetic", "Kinetic"], ["splitter", "Splitter"]];
const modAb = m => (MODAB.find(([k]) => m.id.includes(k)) || [, m.n])[1];
const short = it => it.n.replace(/ Grenade$/, " Gren.").replace(/ Shield Recharger$/, " Recharger");

/* ---------- your stash (from the Stash screen, same device) ---------- */
let STASH = {};
function loadStash(){ try { STASH = (JSON.parse(localStorage.getItem("arc-inv-v1")) || {}).stash || {}; } catch(e){ STASH = {}; } }
loadStash();
const hasStash = () => Object.keys(STASH).length > 0;
const have = id => STASH[id] || 0;
const famOwned = f => WEAP[f].tiers.reduce((n, t) => n + have(t[1]), 0) + WEAP[f].combos.reduce((n, c) => n + have(c[0]), 0);

/* ---------- state ---------- */
const KEY = "arc-loadout-v1";
const blank = () => ({ name: "New loadout", aug: "", shield: "", w: [null, null], q: [], sp: [], x: [], bp: [] });
let L = blank(), SAVED = [], firstRun = true;
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) { if (s.cur) L = Object.assign(blank(), s.cur); SAVED = s.saved || []; firstRun = false; } } catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify({ cur: L, saved: SAVED })); } catch(e){} }

const aug = () => ITEM[L.aug] || FREE;
function caps(){ const a = aug(); return { q: a.q, sp: a.sp, bp: a.bp, x: (a.x || []).flatMap(([t, n]) => Array(n).fill(t)), kg: a.kg, sh: a.sh }; }
/* keep arrays the right size for the augment; returns how many items had to go */
function fit(){
  const c = caps(); let lost = 0;
  const size = (k, n) => { const a = L[k] || []; for (let i = n; i < a.length; i++) if (a[i]) lost++; L[k] = Array.from({ length: n }, (_, i) => a[i] || null); };
  size("q", c.q); size("sp", c.sp); size("bp", c.bp);
  const xs = L.x || []; L.x = c.x.map((t, i) => { const v = xs[i]; if (v && !okFor("x:" + t, ITEM[v.id])) { lost++; return null; } return v || null; });
  for (let i = c.x.length; i < xs.length; i++) if (xs[i]) lost++;
  return lost;
}
function okFor(where, it){
  if (!it) return false;
  if (where === "q") return it.kind === "quick";
  if (where === "sp" || where === "bp") return ["quick", "ammo", "mod", "trinket"].includes(it.kind);
  const t = where.slice(2);
  if (t === "grenade") return it.kind === "quick" && it.c === "grenade";
  if (t === "heal") return it.kind === "quick" && it.c === "heal";
  if (t === "utility") return it.kind === "quick" && (it.c === "trap" || it.c === "gadget");
  if (t === "trinket") return it.kind === "trinket";
  return false;
}

/* weapon helpers */
function wItemId(W){ const f = WEAP[W.f]; if (W.t === "amp" && W.u.length) { const c = f.combos.find(c => same(c[1], W.u)); if (c) return c[0]; } const t = f.tiers.find(t => t[0] === W.t); return t ? t[1] : f.tiers[0][1]; }
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
function blocked(W){ const f = WEAP[W.f], out = {}; if (W.t !== "amp") return out;
  W.u.forEach(i => { const n = f.ups[i]; const s = D.upblock[n] || D.upblock[f.n + ":" + n]; if (s) out[s] = n; }); return out; }

/* ---------- totals ---------- */
function needs(){
  const N = {}; const add = (id, q) => { if (id) N[id] = (N[id] || 0) + q; };
  add(L.aug, 1); add(L.shield, 1);
  L.w.forEach(W => { if (!W) return; add(wItemId(W), 1); Object.values(W.m).forEach(m => add(m, 1)); });
  ["q", "sp", "x", "bp"].forEach(k => L[k].forEach(c => c && add(c.id, c.q)));
  return N;
}
function totals(){ let w = 0, v = 0; const N = needs(); for (const id in N) { const it = ITEM[id]; if (!it) continue; w += (it.w || 0) * N[id]; v += (it.v || 0) * N[id]; } return { w, v, N }; }

/* ---------- render ---------- */
function slotHTML(k, it, sub, bad){
  const r = it ? it.r : "";
  return `<div class="pic">${it ? img(it.id) : ""}${ownMark(it)}</div><div class="tx"><span class="k">${k}</span><span class="nm">${it ? esc(it.n) : "None"}</span><span class="sub">${esc(sub)}</span></div>`;
}
function ownMark(it, q){ if (!it || !hasStash()) return ""; const n = it.kind === "weapon" ? have(it.id) : have(it.id); return `<span class="own${n >= (q || 1) ? "" : " no"}"></span>`; }
function setR(el, it){ if (it && it.r) el.dataset.r = it.r; else delete el.dataset.r; }

function render(){
  const c = caps(), a = ITEM[L.aug], s = ITEM[L.shield], T = totals();
  $("#loName").textContent = L.name || "Loadout";
  /* augment + shield */
  const sa = $("#sAug"); setR(sa, a); sa.classList.toggle("empty", !a);
  sa.innerHTML = slotHTML("Augment", a, a ? `${c.bp} bag · ${c.q} quick · ${c.kg} kg` : "Tap to pick");
  const ss = $("#sShield"), shBad = s && !c.sh.includes(s.k); setR(ss, s); ss.classList.toggle("empty", !s); ss.classList.toggle("bad", !!shBad);
  ss.innerHTML = slotHTML("Shield", s, s ? (shBad ? `${aug().n} can't use it` : `${s.ch} charge · ${s.dr}`) : `Fits: ${c.sh.split("").map(k => SHK[k]).join(", ")}`);
  /* weapons */
  [0, 1].forEach(i => renderWeapon(i));
  /* cells */
  cells($("#quick"), "q", L.q, c.q);
  $("#qCount").textContent = `${L.q.filter(Boolean).length}/${c.q}`;
  const xc = $("#xcells"), xl = c.sp + c.x.length; $("#grpX").hidden = !xl;
  xc.style.setProperty("--n", Math.max(5, xl));
  xc.innerHTML = L.sp.map((v, i) => cellHTML("sp", i, v, "safe", "Safe")).join("") + L.x.map((v, i) => cellHTML("x", i, v, "x-" + c.x[i], XLAB[c.x[i]])).join("");
  $("#xLab").textContent = [c.sp ? `Safe pocket ${c.sp}` : "", c.x.length ? Object.entries(c.x.reduce((o, t) => (o[t] = (o[t] || 0) + 1, o), {})).map(([t, n]) => `${XLAB[t]} ${n}`).join(" · ") : ""].filter(Boolean).join(" · ");
  cells($("#bp"), "bp", L.bp, c.bp);
  $("#bpCount").textContent = `${L.bp.filter(Boolean).length}/${c.bp}`;
  /* weight + value */
  const pct = c.kg ? T.w / c.kg : 0, wb = $("#wbar");
  wb.querySelector("b").style.width = Math.min(100, pct * 100) + "%"; wb.classList.toggle("warn", pct > .9 && pct <= 1); wb.classList.toggle("over", pct > 1);
  $("#statW").textContent = `${kg(T.w)}/${c.kg}`; $("#statW").style.color = pct > 1 ? "var(--need)" : "";
  $("#statV").textContent = fmt(T.v);
  const note = $("#loNote");
  if (hasStash()) { const miss = Object.keys(T.N).filter(id => have(id) < T.N[id]).length; note.textContent = miss ? `${miss} not in stash` : "All in stash"; note.className = miss ? "over" : ""; }
  else { note.textContent = pct > 1 ? `${kg(T.w - c.kg)} kg over` : `${kg(c.kg - T.w)} kg free`; note.className = pct > 1 ? "over" : ""; }
  save();
}
function cells(el, k, arr, n){ el.style.setProperty("--n", k === "bp" ? 8 : Math.max(5, n)); el.innerHTML = arr.map((v, i) => cellHTML(k, i, v)).join(""); }
function cellHTML(k, i, v, cls, t){
  const it = v && ITEM[v.id];
  if (!it) return `<button type="button" class="cell e ${cls || ""}" data-k="${k}" data-i="${i}"${t ? ` data-t="${t}"` : ""} aria-label="Empty ${t || ""} slot"></button>`;
  return `<button type="button" class="cell ${cls || ""}" data-k="${k}" data-i="${i}" data-r="${esc(it.r)}" aria-label="${esc(it.n)} ×${v.q}"><span class="ab">${esc(short(it))}</span>${img(it.id)}${v.q > 1 ? `<span class="q">${v.q}</span>` : ""}${ownMark(it, v.q)}</button>`;
}
function renderWeapon(i){
  const el = $("#w" + i), W = L.w[i];
  if (!W) { delete el.dataset.r;
    el.innerHTML = `<button type="button" class="slot empty" data-k="weap" data-i="${i}"><div class="pic"></div><div class="tx"><span class="k">Weapon ${i + 1}</span><span class="nm">None</span><span class="sub">Tap to pick a weapon</span></div></button>`; return; }
  const f = WEAP[W.f], id = wItemId(W), it = ITEM[id], bl = blocked(W);
  el.dataset.r = it.r;
  const sub = [W.t === "amp" ? "Amplified" : W.t === "one" ? "" : "Tier " + TIERN[W.t], f.ammo, f.mode].filter(Boolean).join(" · ");
  const amp = W.t === "amp" && W.u.length ? `<div class="amp">${W.u.map(u => `<i>${esc(f.ups[u])}</i>`).join("")}</div>` : "";
  const modBtns = SLOTS.filter(([s]) => f.slots[s]).map(([s, lab]) => {
    const m = ITEM[W.m[s]];
    if (bl[s]) return `<button type="button" class="mod lock" data-k="mod" data-i="${i}" data-s="${s}" aria-label="${lab} taken by ${esc(bl[s])}"><span class="k">${lab}</span><span class="k">✕</span></button>`;
    return `<button type="button" class="mod" data-k="mod" data-i="${i}" data-s="${s}"${m ? ` data-r="${esc(m.r)}"` : ""} aria-label="${lab}: ${m ? esc(m.n) : "empty"}">${m ? img(m.id) + `<span class="k">${esc(modAb(m))}</span><span class="tn">${esc((m.n.match(/ (I{1,3})$/) || [, ""])[1])}</span>` : `<span class="k">${lab}</span><span class="k">+</span>`}${m ? ownMark(m) : ""}</button>`; }).join("");
  el.innerHTML = `<button type="button" class="slot" data-k="weap" data-i="${i}"><div class="pic">${img(id)}${ownMark(it)}</div><div class="tx"><span class="k">Weapon ${i + 1} · ${esc(f.t)}</span><span class="nm">${esc(it.n)}</span><span class="sub">${esc(sub)}</span></div></button>${amp}${modBtns ? `<div class="mods">${modBtns}</div>` : ""}`;
}

/* ---------- sheet ---------- */
const sheet = $("#sheet"), scrim = $("#scrim");
let sheetBack = null;
function openSheet(html, r){ sheet.innerHTML = html; if (r) sheet.dataset.r = r; else delete sheet.dataset.r; sheet.hidden = false; scrim.hidden = false; sheet.scrollTop = 0; }
function closeSheet(){ sheet.hidden = true; scrim.hidden = true; sheet.innerHTML = ""; sheetBack = null; }
scrim.addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!sheet.hidden) closeSheet(); else closePanels(); } });

/* generic picker. opts: title, items [{it, sub, off, group}], cats, cur, onPick(id), onRemove, back */
let P = null;
function picker(opts){
  P = Object.assign({ cat: "all", q: "", own: false }, opts);
  openSheet(`<div class="hd">${P.back ? `<button class="abtn" type="button" data-act="back">Back</button>` : ""}<h3>${esc(P.title)}</h3>${P.onRemove ? `<button class="abtn danger" type="button" data-act="remove">Remove</button>` : ""}<button class="abtn" type="button" data-act="close">Done</button></div>
    ${P.items.length > 10 ? `<input type="search" id="pq" placeholder="Search" autocomplete="off" spellcheck="false" aria-label="Search">` : ""}
    <div class="chips" id="pcats">${(P.cats || []).map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="${k === P.cat}">${l}</button>`).join("")}${hasStash() ? `<button type="button" data-own="1" aria-pressed="false" style="--c:var(--keep)">Owned</button>` : ""}</div>
    <ul class="plist" id="plist"></ul>`);
  if (!P.cats && !hasStash()) $("#pcats").remove();
  fillPicker();
}
function fillPicker(){
  const q = P.q.trim().toLowerCase(); let last = null, html = "";
  P.items.filter(x => (P.cat === "all" || catOf(x.it) === P.cat) && (!q || x.it.n.toLowerCase().includes(q)) && (!P.own || x.owned > 0)).forEach(x => {
    if (x.group && x.group !== last) { html += `<li class="h">${esc(x.group)}</li>`; last = x.group; }
    const o = hasStash() ? (x.owned > 0 ? `<span class="tag">Have ${x.owned}</span>` : `<span class="tag no">None</span>`) : "";
    html += `<li class="pi${x.off ? " off" : ""}${x.it.id === P.cur ? " sel" : ""}" data-id="${esc(x.it.id)}" data-r="${esc(x.it.r)}"><div class="pic">${img(x.img || x.it.id)}</div><div class="nm">${esc(x.it.n)}</div><div class="vd">${o}<small>${x.right ?? (x.it.w != null ? kg(x.it.w) + " kg" : "")}</small></div><div class="sub">${esc(x.off || x.sub || "")}</div></li>`;
  });
  $("#plist").innerHTML = html || `<li class="h">Nothing matches.</li>`;
}
sheet.addEventListener("input", e => { if (e.target.id === "pq") { P.q = e.target.value; fillPicker(); } if (e.target.id === "qtyIn") setQty(+e.target.value); });
sheet.addEventListener("click", e => {
  const b = e.target.closest("[data-act],[data-cat],[data-own],.pi,[data-tier],[data-up],.mod,[data-q]");
  if (!b) return;
  if (b.dataset.act === "close") return closeSheet();
  if (b.dataset.act === "back") return P && P.back ? P.back() : closeSheet();
  if (b.dataset.act === "remove") return P.onRemove();
  if (b.dataset.cat) { P.cat = b.dataset.cat; sheet.querySelectorAll("[data-cat]").forEach(x => x.setAttribute("aria-pressed", x === b)); return fillPicker(); }
  if (b.dataset.own) { P.own = !P.own; b.setAttribute("aria-pressed", P.own); return fillPicker(); }
  if (b.classList.contains("pi")) { const x = P.items.find(x => x.it.id === b.dataset.id); if (!x) return; if (x.off) return toast(x.off, true); return P.onPick(b.dataset.id); }
  if (b.dataset.act || !CFG) return;
  if (b.dataset.tier) return setTier(b.dataset.tier);
  if (b.dataset.up) return toggleUp(+b.dataset.up);
  if (b.dataset.q) return setQty((CFG.cell ? CFG.cell.q : 1) + +b.dataset.q);
  if (b.classList.contains("mod")) { if (b.classList.contains("lock")) return toast(`${b.getAttribute("aria-label")}.`); return pickMod(CFG.i, b.dataset.s, true); }
});

/* ---------- main screen taps ---------- */
$("#main").addEventListener("click", e => {
  const b = e.target.closest("[data-k]"); if (!b) return;
  const k = b.dataset.k, i = +b.dataset.i;
  if (k === "aug") return pickAug();
  if (k === "shield") return pickShield();
  if (k === "weap") return L.w[i] ? weaponSheet(i) : pickWeapon(i);
  if (k === "mod") { if (b.classList.contains("lock")) return toast(`${b.getAttribute("aria-label")}.`); return pickMod(i, b.dataset.s); }
  if (["q", "sp", "x", "bp"].includes(k)) { const v = L[k][i]; return v ? cellSheet(k, i) : pickCell(k, i); }
});
$("#nameBtn").addEventListener("click", () => openPanel(true));

function pickAug(){
  picker({ title: "Augment", cur: L.aug,
    items: D.augments.slice().sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })).map(a => ({ it: ITEM[a.id], owned: have(a.id), group: a.id.split("_")[0].replace(/^\w/, c => c.toUpperCase()).replace("Free", "Basic"),
      sub: `${a.bp} bag · ${a.q} quick · ${a.sp} safe${(a.x || []).map(([t, n]) => ` · ${n} ${t}`).join("")} · ${a.sh.split("").join("/")} shield`, right: a.kg + " kg max" })),
    onRemove: L.aug ? () => setAug("") : null, onPick: id => setAug(id) });
}
function setAug(id){
  L.aug = id; const lost = fit(); const s = ITEM[L.shield], c = caps();
  closeSheet(); render();
  const msg = [lost ? `${lost} item${lost > 1 ? "s" : ""} didn't fit and came out` : "", s && !c.sh.includes(s.k) ? `${aug().n} can't use a ${SHK[s.k]} Shield` : ""].filter(Boolean).join(". ");
  if (msg) toast(msg + ".", true);
}
function pickShield(){
  const c = caps();
  picker({ title: "Shield", cur: L.shield,
    items: D.shields.map(s => ({ it: ITEM[s.id], owned: have(s.id), sub: `${s.ch} charge · ${s.dr} damage blocked${s.ms ? ` · ${s.ms} slower` : ""}`, off: c.sh.includes(s.k) ? "" : `Your augment can't use a ${SHK[s.k]} Shield` })),
    onRemove: L.shield ? () => { L.shield = ""; closeSheet(); render(); } : null, onPick: id => { L.shield = id; closeSheet(); render(); } });
}

/* weapons */
function pickWeapon(i, back){
  const cur = L.w[i] && L.w[i].f;
  picker({ title: `Weapon ${i + 1}`, cur: cur && WEAP[cur].tiers[0][1], back,
    cats: [["all", "All"]].concat([...new Set(D.weapons.map(w => w.t))].map(t => [t, t.replace("Assault Rifle", "AR").replace("Battle Rifle", "BR").replace("Sniper Rifle", "Sniper").replace("Hand Cannon", "Hand cannon")])),
    items: D.weapons.map(w => { const top = w.tiers.find(t => t[0] === "iv") || w.tiers[0];
      return { it: Object.assign({}, ITEM[w.tiers[0][1]], { id: w.tiers[0][1], n: w.n, kind: w.t, r: top[2] }), img: top[1], group: w.t, owned: famOwned(w.id),
        sub: [w.ammo, w.mode, w.tiers.some(t => t[0] === "amp") ? "Amplifiable" : ""].filter(Boolean).join(" · "), right: kg(top[3]) + " kg", f: w.id }; }),
    onRemove: L.w[i] ? () => { L.w[i] = null; closeSheet(); render(); } : null,
    onPick: id => { const f = D.weapons.find(w => w.tiers[0][1] === id); const old = L.w[i];
      const t = bestTier(f); L.w[i] = { f: f.id, t, u: [], m: {} };
      if (old) for (const s in old.m) if (f.slots[s] && f.slots[s].includes(old.m[s])) L.w[i].m[s] = old.m[s];
      render(); weaponSheet(i); } });
}
function bestTier(f){ const own = f.tiers.slice().reverse().find(t => t[0] !== "amp" && have(t[1])); if (own) return own[0]; return (f.tiers.find(t => t[0] === "iv") || f.tiers.find(t => t[0] === "one") || f.tiers[0])[0]; }
let CFG = null;
function weaponSheet(i){
  const W = L.w[i]; if (!W) return closeSheet(); const f = WEAP[W.f], id = wItemId(W), it = ITEM[id], bl = blocked(W);
  CFG = { i };
  P = { back: null, items: [] };
  const tiers = f.tiers.length > 1 ? `<div class="slab">Version</div><div class="chips">${f.tiers.map(t => `<button type="button" data-tier="${t[0]}" aria-pressed="${t[0] === W.t}">${t[0] === "amp" ? "Amplified" : t[0] === "one" ? "Standard" : "Tier " + TIERN[t[0]]}${hasStash() && have(t[1]) ? " ✓" : ""}</button>`).join("")}</div>` : "";
  const ups = W.t === "amp" && f.ups.length ? `<div class="slab">Amplified upgrades</div><div class="chips amp">${f.ups.map((u, j) => `<button type="button" data-up="${j}" aria-pressed="${W.u.includes(j)}"${upOK(f, W.u, j) ? "" : " disabled"}>${esc(u)}</button>`).join("")}</div><p class="fine" style="margin:0">Upgrades can't be undone in game. Some lock others out, and some need one first.</p>` : "";
  const mods = SLOTS.filter(([s]) => f.slots[s]).map(([s, lab]) => { const m = ITEM[W.m[s]];
    if (bl[s]) return `<button type="button" class="mod lock" data-s="${s}" aria-label="${lab} taken by ${esc(bl[s])}"><span class="k">${lab}</span><span class="k">✕</span></button>`;
    return `<button type="button" class="mod" data-s="${s}"${m ? ` data-r="${esc(m.r)}"` : ""}>${m ? img(m.id) : ""}<span class="k">${m ? esc(m.n.replace(/ (I{1,3})$/, "")).slice(0, 12) : lab}</span>${m ? `<span class="tn">${esc((m.n.match(/ (I{1,3})$/) || [, ""])[1])}</span>` : ""}</button>`; }).join("");
  const kv = [["Class", f.t], ["Ammo", f.ammo], ["Fire", f.mode], ["Mag", f.mag], ["vs ARC", f.pen], ["Trait", f.trait], ["Weight", kg(it.w) + " kg"], ["Value", fmt(it.v)], hasStash() ? ["In stash", String(have(id))] : null].filter(r => r && r[1]);
  openSheet(`<div class="hd"><div class="pic">${img(id)}</div><div style="flex:1 1 auto;min-width:0"><h3>${esc(it.n)}</h3><div class="meta">${esc(it.r)} · ${esc(f.t)}</div></div><button class="abtn" type="button" data-act="close">Done</button></div>
    ${tiers}${ups}
    ${mods ? `<div class="slab">Mods</div><div class="mrow">${mods}</div>` : `<p class="fine" style="margin:0">This weapon takes no mods.</p>`}
    <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${f.d ? `<p class="fine" style="margin:0">${esc(f.d)}</p>` : ""}
    <div class="row"><button class="abtn grow" type="button" id="chgW">Change weapon</button><button class="abtn danger grow" type="button" id="rmW">Remove</button></div>`, it.r);
  $("#chgW").onclick = () => pickWeapon(i, () => weaponSheet(i));
  $("#rmW").onclick = () => { L.w[i] = null; CFG = null; closeSheet(); render(); };
}
function upOK(f, U, j){ if (U.includes(j)) return true; const want = U.concat(j); return f.combos.some(c => want.every(x => c[1].includes(x))); }
function toggleUp(j){
  const W = L.w[CFG.i], f = WEAP[W.f]; let U;
  if (W.u.includes(j)) { const rest = W.u.filter(x => x !== j); const ok = f.combos.filter(c => c[1].every(x => rest.includes(x))).sort((a, b) => b[1].length - a[1].length)[0]; U = rest.length && ok ? ok[1].slice() : []; }
  else { const want = W.u.concat(j); const ok = f.combos.filter(c => want.every(x => c[1].includes(x))).sort((a, b) => a[1].length - b[1].length)[0]; if (!ok) return; U = ok[1].slice();
    const auto = U.filter(x => !want.includes(x)); if (auto.length) toast(`${f.ups[j]} needs ${auto.map(x => f.ups[x]).join(" and ")} first, so that's on too.`); }
  W.u = U.sort((a, b) => a - b); const bl = blocked(W); for (const s in bl) if (W.m[s]) { toast(`${bl[s]} takes the ${s} slot, so that mod came off.`); delete W.m[s]; }
  render(); weaponSheet(CFG.i);
}
function setTier(t){ const W = L.w[CFG.i]; W.t = t; if (t !== "amp") W.u = []; render(); weaponSheet(CFG.i); }
function pickMod(i, s, fromCfg){
  const W = L.w[i], f = WEAP[W.f], lab = SLOTS.find(x => x[0] === s)[1];
  const back = () => weaponSheet(i);
  picker({ title: `${f.n} · ${lab}`, cur: W.m[s], back: fromCfg ? back : null,
    items: f.slots[s].map(id => ITEM[id]).filter(Boolean).map(m => ({ it: m, owned: have(m.id), sub: m.fx.map(e => e[1] ? `${e[1]} ${e[0].replace(/^(Reduced|Increased) /, (x, y) => y === "Reduced" ? "less " : "more ").toLowerCase()}` : e[0]).join(" · ") })),
    onRemove: W.m[s] ? () => { delete W.m[s]; render(); fromCfg ? back() : closeSheet(); } : null,
    onPick: id => { W.m[s] = id; render(); fromCfg ? back() : closeSheet(); } });
}

/* item cells */
function pool(k, i){
  if (k === "q") return D.quick.map(x => ITEM[x.id]);
  if (k === "x") { const t = caps().x[i]; return Object.values(ITEM).filter(it => okFor("x:" + t, it)); }
  return [].concat(D.ammo, D.quick, D.mods, D.trinkets).map(x => ITEM[x.id]);
}
const where = (k, i) => k === "x" ? `${XLAB[caps().x[i]]} slot` : k === "q" ? "Quick use" : k === "sp" ? "Safe pocket" : "Backpack";
function pickCell(k, i, back){
  const list = pool(k, i), cur = L[k][i];
  const cats = k === "q" ? QCATS : k === "x" ? null : BCATS;
  picker({ title: where(k, i), cur: cur && cur.id, back, cats,
    items: list.sort((a, b) => CORD.indexOf(catOf(a)) - CORD.indexOf(catOf(b)) || a.n.replace(/\W/g, "").localeCompare(b.n.replace(/\W/g, ""))).map(it => ({ it, owned: have(it.id), sub: [it.kind === "quick" ? it.c.replace(/^\w/, c => c.toUpperCase()) : it.kind === "mod" ? "Mod" : it.kind === "ammo" ? "Ammo" : it.kind === "trinket" ? "Trinket" : "", it.s > 1 ? `stack ${it.s}` : "", it.d || ""].filter(Boolean).join(" · ") })),
    onRemove: cur ? () => { L[k][i] = null; closeSheet(); render(); } : null,
    onPick: id => { const it = ITEM[id]; const n = hasStash() && have(id) ? Math.min(it.s || 1, have(id)) : (it.s || 1); L[k][i] = { id, q: n }; render(); cellSheet(k, i); } });
}
function cellSheet(k, i){
  const v = L[k][i], it = ITEM[v.id]; CFG = { cell: v, k, i };
  P = { items: [] };
  openSheet(`<div class="hd"><div class="pic">${img(it.id)}</div><div style="flex:1 1 auto;min-width:0"><h3>${esc(it.n)}</h3><div class="meta">${esc(it.r)} · ${esc(where(k, i))}</div></div><button class="abtn" type="button" data-act="close">Done</button></div>
    ${it.d ? `<p>${esc(it.d)}</p>` : ""}
    ${it.fx ? `<p class="fine" style="margin:0">${esc(it.fx.map(e => e.join(" ")).join(" · "))}</p>` : ""}
    ${(it.s || 1) > 1 ? `<div class="qty"><button type="button" data-q="-1" aria-label="One less">−</button><input id="qtyIn" type="number" inputmode="numeric" min="1" max="${it.s}" value="${v.q}" aria-label="How many"><button type="button" data-q="1" aria-label="One more">+</button></div>` : ""}
    <dl class="kv"><dt>Stack</dt><dd>${it.s || 1}</dd><dt>Weight</dt><dd id="cw">${kg((it.w || 0) * v.q)} kg</dd>${hasStash() ? `<dt>In stash</dt><dd>${have(it.id)}</dd>` : ""}</dl>
    <div class="row"><button class="abtn grow" type="button" id="chgC">Swap</button><button class="abtn danger grow" type="button" id="rmC">Remove</button></div>`, it.r);
  $("#chgC").onclick = () => pickCell(k, i, () => cellSheet(k, i));
  $("#rmC").onclick = () => { L[k][i] = null; CFG = null; closeSheet(); render(); };
}
function setQty(n){ const v = CFG && CFG.cell; if (!v) return; const it = ITEM[v.id]; v.q = Math.max(1, Math.min(it.s || 1, Math.round(n) || 1)); const inp = $("#qtyIn"); if (inp && +inp.value !== v.q && document.activeElement !== inp) inp.value = v.q; if (inp && document.activeElement !== inp) inp.value = v.q; $("#cw").textContent = kg((it.w || 0) * v.q) + " kg"; render(); }

/* ---------- codes ---------- */
function encode(l){
  const cell = c => c ? c.id + (c.q > 1 ? "*" + c.q : "") : "";
  const list = a => { const s = a.map(cell); while (s.length && !s[s.length - 1]) s.pop(); return s.join(","); };
  const w = W => W ? [W.f, W.t, W.u.join("+"), Object.entries(W.m).map(([s, id]) => s + ":" + id).join(";")].join(".") : "";
  return ["L1", l.aug, l.shield, w(l.w[0]), w(l.w[1]), list(l.q), list(l.sp), list(l.x), list(l.bp), encodeURIComponent(l.name || "")].join("~");
}
function decode(code){
  const p = String(code).trim().replace(/^.*#l=/, "").split("~"); if (p[0] !== "L1" || p.length < 9) return null;
  const l = blank(); l.aug = ITEM[p[1]] && ITEM[p[1]].kind === "aug" ? p[1] : ""; l.shield = ITEM[p[2]] && ITEM[p[2]].kind === "shield" ? p[2] : "";
  l.w = [p[3], p[4]].map(s => { if (!s) return null; const [f, t, u, m] = s.split("."); const F = WEAP[f]; if (!F) return null;
    const W = { f, t: F.tiers.some(x => x[0] === t) ? t : bestTier(F), u: (u || "").split("+").filter(Boolean).map(Number).filter(x => F.ups[x]), m: {} };
    (m || "").split(";").filter(Boolean).forEach(x => { const [s2, id] = x.split(":"); if (F.slots[s2] && F.slots[s2].includes(id)) W.m[s2] = id; }); return W; });
  const list = s => (s || "").split(",").map(x => { if (!x) return null; const [id, q] = x.split("*"); const it = ITEM[id]; return it ? { id, q: Math.max(1, Math.min(it.s || 1, +q || 1)) } : null; });
  l.q = list(p[5]); l.sp = list(p[6]); l.x = list(p[7]); l.bp = list(p[8]);
  try { l.name = decodeURIComponent(p[9] || "") || "Shared loadout"; } catch(e){ l.name = "Shared loadout"; }
  return l;
}
function useLoadout(l){ L = l; const lost = fit(); render(); return lost; }

/* ---------- saved panel ---------- */
const panel = $("#savedPanel");
function openPanel(focusName){
  loadStash(); $("#nameIn").value = L.name || ""; $("#codeBox").value = encode(L);
  $("#dataDate").textContent = new Date(D.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  fillSaved(); fillHave(); panel.hidden = false; if (focusName) setTimeout(() => $("#nameIn").focus(), 50);
}
function closePanels(){ panel.hidden = true; render(); }
panel.addEventListener("click", e => { if (e.target.closest("[data-close]")) closePanels(); });
$("#savedBtn").addEventListener("click", () => openPanel());
$("#nameIn").addEventListener("input", e => { L.name = e.target.value.slice(0, 40); $("#codeBox").value = encode(L); save(); });
function fillSaved(){
  const ul = $("#savedList");
  if (!SAVED.length) { ul.innerHTML = `<li><span class="nm"><small>Nothing saved yet. Name this loadout and tap Save.</small></span></li>`; return; }
  ul.innerHTML = SAVED.map((s, i) => { const l = decode(s.code); const a = l && ITEM[l.aug]; const ws = l ? l.w.filter(Boolean).map(W => WEAP[W.f].n).join(" + ") : "";
    return `<li class="${s.name === L.name ? "cur" : ""}"><span class="nm" data-load="${i}"><b>${esc(s.name)}</b><small>${esc([a ? a.n : "", ws].filter(Boolean).join(" · ") || "Empty")}</small></span><button class="abtn" type="button" data-load="${i}">Load</button><button class="abtn danger" type="button" data-del="${i}" aria-label="Delete ${esc(s.name)}">✕</button></li>`; }).join("");
}
$("#savedList").addEventListener("click", e => {
  const ld = e.target.closest("[data-load]"), dl = e.target.closest("[data-del]");
  if (ld) { const s = SAVED[+ld.dataset.load], l = decode(s.code); if (!l) return toast("That save couldn't be read.", true); l.name = s.name; useLoadout(l); closePanels(); toast(`Loaded ${s.name}.`); }
  if (dl) { const i = +dl.dataset.del, s = SAVED[i]; SAVED.splice(i, 1); save(); fillSaved(); toast(`Deleted ${s.name}. Tap to undo.`, false, () => { SAVED.splice(i, 0, s); save(); fillSaved(); }); }
});
$("#saveBtn").addEventListener("click", () => {
  const name = ($("#nameIn").value.trim() || "Loadout").slice(0, 40); L.name = name;
  const rec = { name, code: encode(L), at: Date.now() }, i = SAVED.findIndex(s => s.name === name);
  if (i >= 0) SAVED[i] = rec; else SAVED.unshift(rec); save(); fillSaved(); toast(i >= 0 ? `Updated ${name}.` : `Saved ${name}.`);
});
$("#newBtn").addEventListener("click", () => { const old = L; L = blank(); fit(); $("#nameIn").value = L.name; $("#codeBox").value = encode(L); fillHave(); fillSaved(); save(); toast("Started a new loadout. Tap to undo.", false, () => { L = old; openPanel(); }); });
$("#clearLo").addEventListener("click", () => { const old = L; L = Object.assign(blank(), { name: L.name, aug: L.aug }); fit(); $("#codeBox").value = encode(L); fillHave(); save(); toast("Emptied every slot except the augment. Tap to undo.", false, () => { L = old; openPanel(); }); });
function fillHave(){
  const card = $("#haveCard"), N = totals().N, ids = Object.keys(N);
  if (!ids.length) { card.hidden = true; return; } card.hidden = false;
  if (!hasStash()) { card.innerHTML = `<h3>What you need</h3><p class="fine" style="margin:0">Link or fill in your stash on the <a href="inventory.html">Stash</a> screen and this shows what you have and what's missing.</p>`; return; }
  const rows = ids.map(id => ({ id, n: N[id], h: have(id), it: ITEM[id] })).sort((a, b) => (a.h >= a.n) - (b.h >= b.n) || a.it.n.localeCompare(b.it.n));
  const miss = rows.filter(r => r.h < r.n).length;
  card.className = "card " + (miss ? "bad" : "ok");
  card.innerHTML = `<h3>${miss ? `Missing ${miss} from your stash` : "You have everything"}</h3><ul class="havel">${rows.map(r => `<li class="${r.h >= r.n ? "ok" : "miss"}"><span>${esc(r.it.n)}</span><b>${r.h}/${r.n}</b></li>`).join("")}</ul>`;
}
$("#copyCode").addEventListener("click", () => copy($("#codeBox").value = encode(L), "Code copied."));
$("#copyLink").addEventListener("click", () => {
  const url = location.origin + location.pathname + "#l=" + encode(L);
  if (navigator.share) navigator.share({ title: L.name, url }).catch(() => {}); else copy(url, "Link copied.");
});
$("#loadCode").addEventListener("click", () => {
  const l = decode($("#codeBox").value); if (!l) return toast("That doesn't look like a loadout code.", true);
  const old = L, lost = useLoadout(l); closePanels(); toast(`Loaded ${L.name}.${lost ? ` ${lost} item${lost > 1 ? "s" : ""} didn't fit.` : ""} Tap to undo.`, false, () => { L = old; render(); });
});
function copy(t, msg){ (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(msg), () => { const b = $("#codeBox"); b.value = t; b.select(); toast("Select and copy the text.", true); }); }

/* ---------- toast ---------- */
let tT = 0, tUndo = null;
function toast(msg, bad, undo){ const t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); tUndo = undo || null; clearTimeout(tT); tT = setTimeout(() => { t.textContent = ""; tUndo = null; }, undo ? 6000 : 3200); }
$("#toast").addEventListener("click", () => { const u = tUndo; $("#toast").textContent = ""; tUndo = null; if (u) u(); });

/* ---------- start ---------- */
function example(){
  const l = blank(); l.name = "Agile Tempest"; l.aug = "combat_mk3_flanking"; l.shield = "medium_shield";
  l.w = [{ f: "tempest", t: "iv", u: [], m: { muzzle: "muzzle_brake_iii", grip: "vertical_grip_iii", mag: "extended_medium_mag_iii" } },
         { f: "venator", t: "iv", u: [], m: { grip: "angled_grip_ii", mag: "extended_medium_mag_ii" } }];
  l.q = [{ id: "bandage", q: 5 }, { id: "shield_recharger", q: 5 }, { id: "adrenaline_shot", q: 5 }, { id: "light_impact_grenade", q: 5 }, { id: "smoke_grenade", q: 5 }];
  l.x = [{ id: "zipline", q: 3 }, { id: "jolt_mine", q: 3 }, null];
  l.bp = [{ id: "medium_ammo", q: 80 }, { id: "medium_ammo", q: 80 }, { id: "medium_ammo", q: 80 }];
  return l;
}
(function start(){
  const h = location.hash.match(/#l=(.+)$/);
  if (h) { let l = decode(h[1]); if (!l) try { l = decode(decodeURIComponent(h[1])); } catch(e){} history.replaceState(null, "", location.pathname); if (l) { const old = L; useLoadout(l); toast(`Opened ${L.name} from a link. Tap to go back to yours.`, false, () => { L = old; render(); }); return; } }
  if (firstRun) { L = example(); fit(); render(); toast("Example loadout loaded. Tap any slot to change it, or Saved › New to start empty."); return; }
  fit(); render();
})();
window.addEventListener("pageshow", e => { if (e.persisted) { loadStash(); render(); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadStash(); render(); } });
