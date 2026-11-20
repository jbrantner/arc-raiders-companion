#!/bin/sh
# Run before every push: stamps a new ?v= on the CSS/JS links so phones load fresh files
# instead of cached copies the next time the app is opened.
set -e
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M)
for f in index.html inventory.html; do
  sed -i.bak -E "s/(name=\"app-version\" content=\")[^\"]*/\1$V/; s/\?v=[0-9]+/?v=$V/g" "$f" && rm -f "$f.bak"
done
echo "Version $V"
