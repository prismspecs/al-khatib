#!/usr/bin/env bash
set -euo pipefail

# Deploy script for local WordPress theme.
# Builds the Vite bundle and syncs theme + dist assets into Local WP theme folder.
# NEVER touches wp-content/uploads. NEVER passes --delete on map-assets.

DEST="${AKG_THEME_DEST:-$HOME/Local Sites/al-khatib/app/public/wp-content/themes/blankslate}"

if [ ! -d "$DEST" ]; then
    echo "Error: Target theme directory does not exist: $DEST" >&2
    exit 1
fi

echo "==> Building frontend bundle..."
npm run build

echo "==> Syncing theme PHP, CSS, and fonts to Local theme..."
rsync -av --exclude 'assets/' --exclude 'map-assets/' theme/ "$DEST/"

echo "==> Syncing dist assets..."
mkdir -p "$DEST/assets"
rsync -av dist/assets/ "$DEST/assets/"

echo "==> Syncing runtime config..."
if [ -f config.js ]; then
    cp config.js "$DEST/config.js"
fi

if [ -d public/map-assets ]; then
    echo "==> Syncing map assets (no delete)..."
    mkdir -p "$DEST/map-assets"
    rsync -av public/map-assets/ "$DEST/map-assets/"
fi

echo "==> Deployment to $DEST complete!"
