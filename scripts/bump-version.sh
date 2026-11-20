#!/bin/sh
# Run before every push: stamps a new version so phones see the "Update available" button
# and fetch fresh CSS/JS instead of cached copies.
set -e
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M)
printf '{"version":"%s"}\n' "$V" > version.json
sed -i.bak -E "s/(name=\"app-version\" content=\")[^\"]*/\1$V/; s/\?v=[0-9]+/?v=$V/g" index.html && rm -f index.html.bak
echo "Version $V"
