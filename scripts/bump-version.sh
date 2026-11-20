#!/bin/sh
# Run before every push: stamps a new ?v= on the CSS/JS links so phones load fresh files
# instead of cached copies the next time the app is opened.
set -e
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M)
sed -i.bak -E "s/(name=\"app-version\" content=\")[^\"]*/\1$V/; s/\?v=[0-9]+/?v=$V/g" index.html && rm -f index.html.bak
echo "Version $V"
