# ARC Raiders Companion

A fan-made companion for ARC Raiders, starting with a skill tree planner for the 2.0 Frozen Trail tree.

Live: https://jbrantner.github.io/arc-raiders-companion/

## What's here
- `index.html`: the skill tree planner (48 skills across Conditioning, Mobility and Survival).
- `js/skill-data.js`: skill names, ranks and per-rank values. Update this when a patch changes the tree.
- `js/icons.js`: line-icon glyphs for each skill.
- `js/skill-tree.js`: unlock rules, layout, saves (localStorage) and build codes / share links.
- `icons/`: the Cartridge app icon in every size the browser and home screen need.

Static site, no build step. GitHub Pages serves it straight from `main`.

Before each push, run `scripts/bump-version.sh`. It stamps a new version in `version.json` and the asset links, so open copies of the app show an "Update available" button and load fresh files.

Not affiliated with Embark Studios.
