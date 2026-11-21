"""Bundles item pictures for the Loadout planner so they load fast and work offline.

Source: RaidTheory/arcraiders-data images/items (MIT; item art (c) Embark Studios AB).
Usage, from the repo root (Python 3 with Pillow):
    git clone --depth 1 https://github.com/RaidTheory/arcraiders-data /tmp/arcraiders-data
    python3 scripts/build-item-icons.py /tmp/arcraiders-data
Writes icons/items/<name>.webp (128 px) and js/item-icons.js, a map from item id to picture.
Items with no picture there (new ones, Amplified variants) borrow the closest one, e.g. Amplified Kettle uses Kettle IV.
Anything still missing falls back to ArcTracker's image server in the app.
"""
import json, os, re, sys
from PIL import Image

RT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/arcraiders-data"
SRC = os.path.join(RT, "images", "items")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons", "items")
os.makedirs(OUT, exist_ok=True)

data = open(os.path.join(ROOT, "js", "loadout-data.js"), encoding="utf8").read()
D = json.loads(data[data.index("=") + 1:].rstrip().rstrip(";"))
ids = set()
for k in ("augments", "shields", "mods", "quick", "ammo", "trinkets"):
    ids.update(x["id"] for x in D[k])
ids.update(D.get("names", {}).keys())  # crafting materials for the shopping list
for w in D["weapons"]:
    ids.update(t[1] for t in w["tiers"])
    ids.update(c[0] for c in w["combos"])
have = {f[:-4] for f in os.listdir(SRC) if f.endswith(".png")}

def candidates(i):
    yield i
    m = re.match(r"^(.*)_amplified", i)
    if m:
        f = m.group(1)
        yield from (f + "_iv", f, f + "_iii")
    m = re.match(r"^(.*)_(i|ii|iii|iv|v)$", i)
    if m:
        yield m.group(1)

icons, used = {}, set()
for i in sorted(ids):
    src = next((c for c in candidates(i) if c in have), None)
    if src:
        icons[i] = src
        used.add(src)
for s in sorted(used):
    dst = os.path.join(OUT, s + ".webp")
    if os.path.exists(dst):
        continue
    im = Image.open(os.path.join(SRC, s + ".png")).convert("RGBA")
    im.thumbnail((128, 128), Image.LANCZOS)
    im.save(dst, "WEBP", quality=82, method=6)
with open(os.path.join(ROOT, "js", "item-icons.js"), "w", encoding="utf8") as f:
    f.write("/* Item id -> bundled picture in icons/items (built by scripts/build-item-icons.py from RaidTheory/arcraiders-data). */\n")
    f.write("window.ITEM_ICONS=" + json.dumps(icons, separators=(",", ":")) + ";\n")
missing = sorted(ids - set(icons))
print(f"{len(icons)} of {len(ids)} items have a picture ({len(used)} files). Still missing: {', '.join(missing)}")
