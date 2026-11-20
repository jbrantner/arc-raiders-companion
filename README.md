# ARC Raiders Companion

A fan-made companion for ARC Raiders: a skill tree planner for the 2.0 Frozen Trail tree, and a stash manager.

Live: https://jbrantner.github.io/arc-raiders-companion/

## What's here
- `index.html`: the skill tree planner (48 skills across Conditioning, Mobility and Survival).
- `js/skill-data.js`: skill names, ranks and per-rank values. Update this when a patch changes the tree.
- `js/icons.js`: line-icon glyphs for each skill.
- `js/skill-tree.js`: unlock rules, layout, saves (localStorage) and build codes / share links.
- `inventory.html`, `js/inventory.js`, `css/inventory.css`: the stash manager. Pulls your stash from ArcTracker (your own app key + personal key, stored only in the browser) or takes it by hand / pasted list, then marks each item Keep, Sell, Recycle, Spare or Gear based on your workshop levels, projects and quests, with a Need list of what you're short.
- `js/game-data.js`: item values, recycle/salvage outputs, workshop, project and quest requirements. Snapshot of ArcTracker's public API (built on RaidTheory/arcraiders-data, MIT). Refresh after a patch with `node scripts/update-game-data.mjs` (needs Node 18+ and internet).
- `icons/`: the Cartridge app icon in every size the browser and home screen need.

Static site, no build step. GitHub Pages serves it straight from `main`.

Before each push, run `scripts/bump-version.sh`. It stamps a new version on the CSS and JS links so phones load fresh files the next time the app is opened.

Not affiliated with Embark Studios.
