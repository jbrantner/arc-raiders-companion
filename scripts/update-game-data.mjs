// Refreshes js/game-data.js from ArcTracker's public game data API (no keys needed).
// Run from the repo root on any computer with Node 18+:  node scripts/update-game-data.mjs
// The browser can't fetch these endpoints directly (no CORS), so the app ships this snapshot.
import { writeFileSync } from "node:fs";

const BASE = "https://arctracker.io";
const get = async (p) => { const r = await fetch(BASE + p); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); };
const en = (o) => (o && typeof o === "object" ? o.en ?? "" : o);
const arr = (v) => (Array.isArray(v) ? v : Object.values(v || {}));
const req = (l) => (l || []).map((r) => [r.itemId, r.quantity]);

const [items, hideout, quests, projects] = await Promise.all(
  ["/api/items", "/api/hideout", "/api/quests", "/api/projects"].map(get)
);

const data = {
  generatedAt: items.generatedAt,
  items: arr(items.items).map((x) => {
    const o = { id: x.id, n: en(x.name), t: x.type, r: x.rarity, v: x.value, w: x.weightKg, s: x.stackSize };
    if (x.recyclesInto && Object.keys(x.recyclesInto).length) o.rc = x.recyclesInto;
    if (x.salvagesInto && Object.keys(x.salvagesInto).length) o.sv = x.salvagesInto;
    return o;
  }),
  hideout: arr(hideout.hideoutModules).map((m) => ({
    id: m.id, n: en(m.name), lv: (m.levels || []).map((l) => ({ l: l.level, q: req(l.requirementItemIds) })),
  })),
  projects: arr(projects.projects).filter((x) => !x.disabled).map((x) => ({
    id: x.id, n: en(x.name),
    ph: (x.phases || []).map((f) => ({ p: f.phase, n: en(f.name), q: req(f.requirementItemIds) })),
    start: x.startDate || null, end: x.endDate || null,
  })),
  quests: arr(quests.quests).map((x) => ({
    id: x.id, n: en(x.name), tr: x.trader,
    q: (x.requiredItemIds || []).filter((r) => !r.questItem).map((r) => [r.itemId, r.quantity]),
    prev: x.previousQuestIds || [],
  })).filter((x) => x.q.length),
  source: "ArcTracker public API (arctracker.io), data by RaidTheory/arcraiders-data (MIT)",
};

const header = `/* ARC Raiders game data snapshot: items (sell value, recycle/salvage outputs), workshop upgrades, projects and quest item turn-ins.
   Source: ArcTracker public API (https://arctracker.io), built on https://github.com/RaidTheory/arcraiders-data (MIT).
   Game content (c) Embark Studios AB. Refresh with: node scripts/update-game-data.mjs */
`;
writeFileSync(new URL("../js/game-data.js", import.meta.url), header + "window.ARC_DATA=" + JSON.stringify(data) + ";\n");
console.log(`Wrote ${data.items.length} items, ${data.hideout.length} workshop stations, ${data.projects.length} projects, ${data.quests.length} quests (data from ${data.generatedAt}).`);
