#!/usr/bin/env bash
set -euo pipefail

# Build a slim, upload-ready theme zip for production.
# Upload it at WP Admin → Appearance → Themes → Add New → Upload Theme → "Replace installed with uploaded".
# Ships only what the site loads: theme PHP/CSS, fonts, images, the Vite bundle, config.js,
# and the three optimized GLBs (the raw bakes in public/map-assets are not needed at runtime).
#
# Usage: ./tools/package-theme.sh [output.zip]

OUT="${1:-blankslate-$(date +%Y-%m-%d).zip}"
case "$OUT" in /*) ;; *) OUT="$(pwd)/$OUT" ;; esac
cd "$(dirname "$0")/.."
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
T="$STAGE/blankslate"

echo "==> Building frontend bundle..."
npm run build

echo "==> Assembling theme..."
mkdir -p "$T/map-assets"
rsync -a --exclude 'map-assets/' --exclude '.DS_Store' --exclude '._*' theme/ "$T/"
rsync -a dist/assets/ "$T/assets/"
cp config.js "$T/config.js"
for f in relief.opt.glb relief_proxy.opt.glb postcard.opt.glb; do
    cp "public/map-assets/$f" "$T/map-assets/$f"
done

rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" blankslate)
echo "==> $OUT ($(du -h "$OUT" | cut -f1))"
