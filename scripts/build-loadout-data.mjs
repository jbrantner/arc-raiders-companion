// Builds js/loadout-data.js for the Loadout planner.
// Inputs: js/game-data.js (ArcTracker snapshot, newest item list incl. Amplified weapons) and a local clone of
// https://github.com/RaidTheory/arcraiders-data (descriptions, effects, mod slots, mod compatibility).
// Usage (from the repo root, Node 18+):
//   git clone --depth 1 https://github.com/RaidTheory/arcraiders-data /tmp/arcraiders-data
//   node scripts/build-loadout-data.mjs /tmp/arcraiders-data
// Augment slot counts and quick-use categories are curated below: check them after each patch.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const RT = process.argv[2] || "/tmp/arcraiders-data";
if (!existsSync(RT + "/items")) { console.error("Pass the path to a RaidTheory/arcraiders-data clone."); process.exit(1); }
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL("../js/game-data.js", import.meta.url), "utf8"), ctx);
const SNAP = ctx.window.ARC_DATA, ITEMS = new Map(SNAP.items.map((x) => [x.id, x]));
const RTI = new Map(readdirSync(RT + "/items").filter((f) => f.endsWith(".json")).map((f) => { const x = JSON.parse(readFileSync(RT + "/items/" + f, "utf8")); return [x.id, x]; }));
const en = (v) => (v && typeof v === "object" ? v.en ?? "" : v ?? "");
const fx = (x) => { const o = []; for (const [k, v] of Object.entries((x && x.effects) || {})) { const val = v && typeof v === "object" ? v.value : v; if (k === "Durability" || val === null || val === undefined) continue; o.push(val === "" ? [k] : [k, String(val)]); } return o; };
const desc = (id) => en(RTI.get(id)?.description).replace(/\s*Compatible with:.*$/i, "").trim();
const base = (x) => ({ id: x.id, n: x.n, r: x.r, w: x.w, v: x.v });

/* ---------- Augments: slot counts from GameBrief (reviewed Nov 3, 2026), cross-checked with ArcRaidersUltimate (Nov 17, 2026).
   No augment changes listed in patch notes 2.4.0 through 2.6.0. bp backpack, q quick use, sp safe pocket, kg weight limit,
   sh shields (L/M/H), x extra slots [type, count], p passive. ---------- */
const AUG = {
  free_loadout_augment: { bp: 14, q: 4, sp: 0, kg: 35, sh: "L", p: "" },
  looting_mk1: { bp: 18, q: 4, sp: 1, kg: 50, sh: "L", p: "" },
  looting_mk2: { bp: 22, q: 4, sp: 2, kg: 60, sh: "L", x: [["trinket", 3]], p: "Throws off attached Ticks." },
  looting_mk3_cautious: { bp: 24, q: 5, sp: 2, kg: 70, sh: "L", p: "Weak Adrenaline Shot when your shield breaks. Integrated binoculars." },
  looting_mk3_safekeeper: { bp: 18, q: 4, sp: 1, kg: 65, sh: "LMH", x: [["trinket", 2]], p: "Safe pocket holds any item." },
  looting_mk3_survivor: { bp: 20, q: 5, sp: 3, kg: 80, sh: "LM", x: [["utility", 1]], p: "Downed and still: heal up to 75% downed health." },
  combat_mk1: { bp: 16, q: 4, sp: 1, kg: 45, sh: "LM", p: "" },
  combat_mk2: { bp: 18, q: 4, sp: 1, kg: 55, sh: "LMH", x: [["grenade", 1]], p: "Heals 1 HP every 5 s (pauses 30 s after damage)." },
  combat_mk3_aggressive: { bp: 18, q: 4, sp: 1, kg: 65, sh: "LMH", x: [["grenade", 2]], p: "Heals 2 HP every 5 s (pauses 30 s after damage)." },
  combat_mk3_flanking: { bp: 20, q: 5, sp: 2, kg: 60, sh: "LM", x: [["utility", 3]], p: "Stowed pistols and hand cannons equip 33% faster." },
  tactical_mk1: { bp: 15, q: 5, sp: 1, kg: 40, sh: "LM", p: "" },
  tactical_mk2: { bp: 17, q: 5, sp: 1, kg: 45, sh: "LM", x: [["utility", 1]], p: "Smoke grenade when your shield breaks." },
  tactical_mk3_defensive: { bp: 20, q: 5, sp: 1, kg: 60, sh: "LMH", p: "Integrated shield recharger, usable while running." },
  tactical_mk3_healing: { bp: 16, q: 4, sp: 3, kg: 55, sh: "LM", x: [["heal", 3]], p: "Being revived releases a 45 HP healing cloud (45 s cooldown)." },
  tactical_mk3_revival: { bp: 16, q: 5, sp: 2, kg: 65, sh: "L", p: "Integrated defibrillator. Heals 1 HP every 5 s." },
  tactical_mk3_smoke: { bp: 19, q: 5, sp: 2, kg: 50, sh: "LM", x: [["utility", 2]], p: "Smoke grenade when your shield breaks." },
};
const augments = SNAP.items.filter((x) => x.t === "Augment").map((x) => {
  const a = AUG[x.id]; if (!a) throw new Error("No slot data for augment " + x.id + ": add it to AUG");
  return { ...base(x), d: desc(x.id), ...a };
});

/* ---------- Shields (Heavy charge 90 since 2.3.0, movement penalty 10% since 2.0) ---------- */
const SH = { light_shield: { k: "L", ch: 40, dr: "40%", ms: "" }, medium_shield: { k: "M", ch: 70, dr: "42.5%", ms: "5%" }, heavy_shield: { k: "H", ch: 90, dr: "52.5%", ms: "10%" } };
const shields = SNAP.items.filter((x) => x.t === "Shield").map((x) => ({ ...base(x), d: desc(x.id), ...SH[x.id] }));

/* ---------- Mods ---------- */
const slotOf = (id) => /grip/.test(id) ? "grip" : /mag/.test(id) ? "mag" : /stock|converter/.test(id) ? "stock" : /splitter/.test(id) ? "tech" : "muzzle";
const mods = SNAP.items.filter((x) => x.t === "Modification").map((x) => { const r = RTI.get(x.id) || {}; return { ...base(x), slot: slotOf(x.id), fx: fx(r).filter((e) => !/^compatible/i.test(e[0])), fits: r.compatibleWith || [] }; });

/* ---------- Weapons, grouped by family ---------- */
const WT = ["Assault Rifle", "SMG", "Pistol", "Shotgun", "Battle Rifle", "Sniper Rifle", "LMG", "Hand Cannon", "Special"];
const TIERS = ["i", "ii", "iii", "iv"];
const fams = new Map();
for (const x of SNAP.items) {
  if (!WT.includes(x.t)) continue;
  let f, k;
  const m = x.id.match(/^(.*)_(i|ii|iii|iv)$/), a = x.id.match(/^(.*)_amplified(?:_(.*))?$/);
  if (a) { f = a[1]; k = "amp"; } else if (m) { f = m[1]; k = m[2]; } else { f = x.id; k = "one"; }
  if (!fams.has(f)) fams.set(f, { id: f, vars: {}, combos: [] });
  const F = fams.get(f);
  if (k === "amp") { if (a[2]) F.combos.push({ id: x.id, u: x.n.split("·")[1].split("+").map((s) => s.trim()) }); else F.vars.amp = x; }
  else F.vars[k] = x;
}
/* Weapons missing from RaidTheory's data: ammo, mode and slots from the ARC Raiders Wiki Weapons page (Nov 19, 2026). */
const GEN = { muzzle: ["compensator", "extended_barrel", "muzzle_brake", "silencer"], grip: ["angled_grip", "vertical_grip", "horizontal_grip"], stock: ["stable_stock", "padded_stock", "lightweight_stock", "kinetic_converter"] };
const OVR = {
  stiletto: { ammo: "Light Ammo", mode: "Semi-Automatic", mag: "10", slots: ["muzzle", "grip", "stock"] },
  bantam: { ammo: "Heavy Ammo", mode: "Double-Action" },
  dolabra: { ammo: "Energy Clip", mode: "Semi-Automatic" },
};
const weapons = [];
for (const F of fams.values()) {
  const head = F.vars.i || F.vars.one || F.vars.amp; const ref = RTI.get(head.id) || RTI.get(F.id + "_iv") || RTI.get(F.id) || {};
  const e = Object.fromEntries(fx(ref)); const name = head.n.replace(/ (I|II|III|IV)$/, "").replace(/^Amplified /, "");
  const slots = {};
  for (const md of mods) if (md.fits.includes(name)) (slots[md.slot] = slots[md.slot] || []).push(md.id);
  for (const [s, l] of Object.entries(ref.modSlots || {})) { const k = slotOf(l[0]); slots[k] = [...new Set([...(slots[k] || []), ...l])]; }
  const o = OVR[F.id] || {};
  for (const k of o.slots || []) slots[k] = mods.filter((md) => md.slot === k && GEN[k].some((g) => md.id.startsWith(g))).map((md) => md.id);
  const tiers = [];
  for (const t of TIERS) if (F.vars[t]) tiers.push([t, F.vars[t].id, F.vars[t].r, F.vars[t].w, F.vars[t].v]);
  if (F.vars.one) tiers.push(["one", F.vars.one.id, F.vars.one.r, F.vars.one.w, F.vars.one.v]);
  if (F.vars.amp) tiers.push(["amp", F.vars.amp.id, F.vars.amp.r, F.vars.amp.w, F.vars.amp.v]);
  const ups = [...new Set(F.combos.flatMap((c) => c.u))];
  weapons.push({ id: F.id, n: name, t: head.t, d: en(ref.description),
    ammo: e["Ammo Type"] || o.ammo || "", mode: e["Firing Mode"] || o.mode || "", mag: e["Magazine Size"] || o.mag || "", pen: e["ARC Armor Penetration"] || "", trait: e["Special Trait"] || "",
    tiers, slots, ups, combos: F.combos.map((c) => [c.id, c.u.map((u) => ups.indexOf(u))]) });
}
weapons.sort((a, b) => WT.indexOf(a.t) - WT.indexOf(b.t) || a.n.localeCompare(b.n));
/* Amplified upgrades that take a mod slot (Amplified Weapons wiki, Nov 13, 2026) */
const UPBLOCK = { "Carbine Conversion": "stock", "Sprint Shooting": "stock", "Ergonomic Bolt": "stock", "Renegade:Scoped": "mag" };

/* ---------- Quick use, ammo, trinkets ---------- */
const CAT = {
  heal: "bandage herbal_bandage sterilized_bandage vita_shot vita_spray defibrillator fruit_mix adrenaline_shot agave_juice shield_recharger surge_shield_recharger",
  grenade: "blaze_grenade gas_grenade heavy_fuze_grenade light_impact_grenade lil_smoke_grenade lure_grenade seeker_grenade showstopper shrapnel_grenade smoke_grenade snap_blast_grenade tagging_grenade trailblazer trigger_nade wolfpack yank_grenade snowball",
  trap: "blaze_grenade_trap gas_grenade_trap lure_grenade_trap smoke_grenade_trap explosive_mine gas_mine jolt_mine pulse_mine deadline barricade_kit door_blocker noisemaker remote_raider_flare surge_coil zipline white_flag",
  gadget: "snap_hook grappling_hook tether_launcher powered_descender photoelectric_cloak binoculars crash_mat flame_spray basic_camera advanced_camera dockmasters_detector mountaineers_detector",
};
const catOf = {}; for (const [c, l] of Object.entries(CAT)) for (const id of l.split(" ")) catOf[id] = c;
const quick = SNAP.items.filter((x) => x.t === "Quick Use").map((x) => ({ ...base(x), s: x.s, c: catOf[x.id] || "other", d: desc(x.id) }));
const ammo = SNAP.items.filter((x) => x.t === "Ammunition").map((x) => ({ ...base(x), s: x.s }));
const trinkets = SNAP.items.filter((x) => x.t === "Trinket").map((x) => ({ ...base(x), s: x.s }));

const out = { generatedAt: SNAP.generatedAt, rtCommitDate: "", augments, shields, weapons, mods: mods.map(({ fits, ...m }) => m), quick, ammo, trinkets, upblock: UPBLOCK };
const header = `/* ARC Raiders loadout data: augments, shields, weapons (tiers, Amplified upgrades, mod slots), mods, quick use, ammo, trinkets.
   Built by scripts/build-loadout-data.mjs from the ArcTracker snapshot in js/game-data.js and RaidTheory/arcraiders-data (MIT),
   plus augment slot counts from community guides. Game content (c) Embark Studios AB. */
`;
writeFileSync(new URL("../js/loadout-data.js", import.meta.url), header + "window.LOADOUT_DATA=" + JSON.stringify(out) + ";\n");
console.log(`${augments.length} augments, ${shields.length} shields, ${weapons.length} weapons, ${mods.length} mods, ${quick.length} quick use, ${ammo.length} ammo, ${trinkets.length} trinkets`);
for (const w of weapons) console.log(w.n.padEnd(12), w.t.padEnd(13), w.tiers.map((t) => t[0]).join(","), Object.keys(w.slots).join("/"), w.ups.join(", "), w.ammo);
