#!/usr/bin/env bash
set -euo pipefail

# tools/assets/02_optimize.sh
# Optimizes glTF models using gltf-transform with WebP textures and lossless geometry bounds.

ASSET_DIR="${1:-public/map-assets}"

echo "==> Optimizing 3D assets in $ASSET_DIR..."

if [ -f "$ASSET_DIR/relief.glb" ]; then
    echo "==> Optimizing relief.glb -> relief.opt.glb..."
    npx -y @gltf-transform/cli optimize "$ASSET_DIR/relief.glb" "$ASSET_DIR/relief.opt.glb" \
        --compress false \
        --texture-compress webp \
        --texture-size 4096
    echo "Relief size before: $(ls -lh "$ASSET_DIR/relief.glb" | awk '{print $5}')"
    echo "Relief size after:  $(ls -lh "$ASSET_DIR/relief.opt.glb" | awk '{print $5}')"
fi

if [ -f "$ASSET_DIR/relief_proxy.glb" ]; then
    echo "==> Optimizing relief_proxy.glb -> relief_proxy.opt.glb..."
    npx -y @gltf-transform/cli optimize "$ASSET_DIR/relief_proxy.glb" "$ASSET_DIR/relief_proxy.opt.glb" \
        --compress false \
        --texture-compress webp \
        --texture-size 1024
    echo "Proxy size before: $(ls -lh "$ASSET_DIR/relief_proxy.glb" | awk '{print $5}')"
    echo "Proxy size after:  $(ls -lh "$ASSET_DIR/relief_proxy.opt.glb" | awk '{print $5}')"
fi

if [ -f "$ASSET_DIR/postcard.glb" ]; then
    echo "==> Optimizing postcard.glb -> postcard.opt.glb..."
    npx -y @gltf-transform/cli optimize "$ASSET_DIR/postcard.glb" "$ASSET_DIR/postcard.opt.glb" \
        --compress meshopt \
        --texture-compress webp
    echo "Postcard size before: $(ls -lh "$ASSET_DIR/postcard.glb" | awk '{print $5}')"
    echo "Postcard size after:  $(ls -lh "$ASSET_DIR/postcard.opt.glb" | awk '{print $5}')"
fi

echo "==> Asset optimization complete!"
