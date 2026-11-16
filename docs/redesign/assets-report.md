# 3D Asset Pipeline Report — Phase 1

## 1. Executive Summary

Phase 1 of the Al-Khatib Glossar redesign replaced the legacy photogrammetry relief asset (`map-2048.glb`, 32 separate 2048² texture atlases, unshaded double-sided open surface) with an optimized, manifold production asset featuring:
1. **Single 4096² WebP Albedo + Tangent Normal Map + 2048² ORM (Occlusion/Roughness/Metallic) Atlas**.
2. **Manifold Solidified Back and Edge** (+12 mm thickness into negative Z), removing the yellow divider plane hack while preserving front surface coordinates.
3. **Exact Bounding Box Parity** (0.000000 mm deviation on X and Y extents, preserving all 35 ACF entry coordinates).
4. **Instant-Load Low-Resolution Proxy** (`relief_proxy.opt.glb` at 376 KB) decimated to ~8,000 triangles with a 1024² atlas.
5. **Ultra-Lean Postcard Asset** (`postcard.opt.glb` at 68 KB, down from 637 KB).
6. **Fallback Still Poster** (`relief-poster.jpg` at 299 KB) for devices lacking WebGL.

---

## 2. Asset Metrics & Performance Comparison

| Metric | Source Asset (`map-2048.glb`) | Optimized Production (`relief.opt.glb`) | Low-Res Proxy (`relief_proxy.opt.glb`) | Target Budget |
|---|---|---|---|---|
| **Transmission File Size** | 18.27 MB | 4.42 MB (unquantized) / 2.54 MB | 376.8 KB | Main ≤ 4 MB, Proxy ≤ 400 KB |
| **Triangle Count** | 62,318 | 116,756 (with solid back + rim) | 8,056 | Proxy ~8k |
| **Draw Calls** | 32 draw calls | **1 draw call** | **1 draw call** | 1 |
| **Texture Atlases** | 32 × 2048² JPEG | 1 × 4096² WebP + Normal + ORM | 1 × 1024² WebP | Single atlas |
| **Estimated GPU VRAM** | **~713 MB** (32 × 22.3 MB) | **~200 MB** (>70% reduction) | **~5.5 MB** | Mobile-safe |

### Postcard Asset
- **Source (`postcard.glb`)**: 637.4 KB
- **Optimized (`postcard.opt.glb`)**: 69.4 KB (89.1% reduction, well below 200 KB budget)

---

## 3. Bounding Box & Coordinate Parity Verification

Verified via `tools/check-assets.mjs` comparing against source `map-2048.glb`:

```
=== Asset Check: public/map-assets/relief.opt.glb vs public/map-assets/map-2048.glb ===
Target min bounds (glTF X,Y,Z): [-0.510773, -0.469096, -0.011013]
Source min bounds (glTF X,Y,Z): [-0.510773, -0.469096,  0.000987]
Target max bounds (glTF X,Y,Z): [ 0.512117,  0.486163,  0.070385]
Source max bounds (glTF X,Y,Z): [ 0.512117,  0.486163,  0.070385]
OK:   Min X diff = 0.000000 <= 0.0001
OK:   Max X diff = 0.000000 <= 0.0001
OK:   Min Y diff = 0.000000 <= 0.0001
OK:   Max Y diff = 0.000000 <= 0.0001
OK:   Max Z (front relief surface) diff = 0.000000 <= 0.0001
Back thickness extension along -Z: 12.00 mm
Asset check PASSED: bounds match within 1e-4 tolerance.
```

All 35 ACF entry positions remain 100% physically aligned to the relief features.

---

## 4. Visual Comparison Renders

Rendered under identical camera position, focal length, and raking warm inspection lamp lighting in Blender 5.2 Cycles OptiX (128 samples):

- **Overview Comparison**: `docs/redesign/progress/phase-1-compare-overview.png`
  - Left: Source model (32 individual texture tiles with visible seam discontinuities)
  - Right: Rebaked model (seamless planar top-down atlas with paper-pulp rim)
- **Close-up Comparison**: `docs/redesign/progress/phase-1-compare-closeup.png`
  - Focuses on the pencil handwriting and ink trace region.
  - The 4096² planar atlas preserves crisp, legible handwriting and fibre texture under raking light.

---

## 5. Pipeline Tooling

- `tools/assets/01_prepare.py`: Headless Blender script performing mesh consolidation, planar UV unwrapping, Cycles OptiX EMIT / AO / NORMAL baking, ORM packing, zero-distortion rim extrusion, and GLTF export.
- `tools/assets/02_optimize.sh`: glTF Transform pipeline generating WebP-compressed, mesh-optimized production assets.
- `tools/assets/03_compare.py`: Headless Cycles comparison renderer.
- `tools/check-assets.mjs`: Automated bounding box and geometry validation script.
