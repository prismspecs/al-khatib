# Handover & Operations Guide

## 1. Project Overview

The Al-Khatib-Glossar redesign transforms the WordPress-hosted interactive glossary into an archival, high-performance WebGL experience centered on the photogrammetry paper relief and 35 glyph traces.

- **Stack**: Three.js r170, `camera-controls`, `postprocessing`, `gsap`, vanilla ES modules with Vite.
- **Backend**: WordPress with Advanced Custom Fields (ACF). Lean REST manifest (`/wp-json/akg/v1/glossary`) and on-demand body endpoint (`/wp-json/akg/v1/entry/<id>`).
- **Typography**: 100% self-hosted WOFF2 (`Favorit`, `IBM Plex Sans Arabic`, `IBM Plex Mono`, `Newsreader`, `Noto Naskh Arabic`). Zero external network dependencies.
- **Git Branch**: `redesign`

---

## 2. Directory Structure

```
├── archive/              # Preserved original files and legacy assets (never deleted)
├── docs/redesign/        # Architecture decisions, benchmarks, deploy notes, screenshots
│   ├── assets-report.md  # Blender planar rebake statistics & compression report
│   ├── decisions.md      # Phase-by-phase architectural log (Phases 0–8)
│   ├── deploy-notes.md   # Local vs production migration & search-replace guide
│   ├── handover.md       # This handover guide
│   └── progress/         # Verification screenshots for desktop & mobile
├── public/
│   ├── fonts/            # Self-hosted WOFF2 font files
│   └── map-assets/       # Optimized 3D assets (relief.opt.glb, relief_proxy.opt.glb, postcard.opt.glb)
├── src/
│   ├── main.js           # Application bootstrapper and view coordination
│   ├── config.js         # Runtime configuration (window.AKG)
│   ├── data.js           # REST manifest parsing, author credit tokenizer, edge case handlers
│   ├── state.js          # Reactive state store with localStorage read state
│   ├── router.js         # Hash router (#/, #/map, #/e/<slug>, #/index, #/about, ?lang=)
│   ├── i18n.js           # Trilingual UI strings (DE, EN, AR)
│   ├── three/            # Three.js modules (stage, relief, postcard, glyphs, lamp, camera, post, loop)
│   └── ui/               # UI components (threshold, chrome, entry-panel, index-view, about, cursor, player, sanitize)
├── theme/                # Version-controlled WordPress theme (blankslate)
│   ├── functions.php     # Custom lean REST API endpoints and asset enqueueing
│   ├── map.php           # Interactive WebGL shell with semantic SEO & noscript fallbacks
│   └── single.php        # Standalone, readable no-JS reading view for individual posts
└── tools/
    ├── deploy.sh         # Build and rsync script to Local WordPress environment
    ├── shot.mjs          # Headless Chrome CDP screenshot helper
    ├── test-phase7.mjs   # Automated smoke test for Index & About views
    └── test-phase8.mjs   # Automated smoke test for Post-processing & Mobile
```

---

## 3. Development Workflow

### Prerequisites
- Node.js ≥ 18
- Local by Flywheel (running `al-khatib.local`)

### Commands
```bash
# Install dependencies
npm install

# Run unit test suite
npm test

# Run Vite dev server with proxy to Local WP
npm run dev

# Build production bundle
npm run build

# Deploy to Local WordPress site
./tools/deploy.sh
```

---

## 4. Testing & Verification

Run the automated CDP test scripts against the running Local site:
```bash
# Smoke test Phase 7 (Index & About views, desktop + mobile)
node tools/test-phase7.mjs

# Smoke test Phase 8 (Post-processing, mobile bottom sheet, fallback)
node tools/test-phase8.mjs
```

---

## 5. Asset Pipeline & Regeneration

The 3D assets have been baked and compressed:
- `relief_proxy.opt.glb`: 376 KB (loads instantly on cold visit)
- `relief.opt.glb`: 4.42 MB (4096² planar atlas, ORM map, extruded pulp rim)
- `postcard.opt.glb`: 64 KB (aged paper postcard model at z = -0.3)

If you ever need to regenerate the assets from raw photogrammetry source files:
```bash
# 1. Blender planar rebake (Blender 5.2 headless)
blender -b -P tools/assets/01_prepare.py -- source.glb public/map-assets/

# 2. gltf-transform optimization & WebP compression
./tools/assets/02_optimize.sh
```

---

## 6. Content Editor Guide

1. **New Glossary Entries**:
   - Create post in category ID `2`.
   - Set Featured Image (the glyph SVG/PNG trace).
   - Fill in ACF fields:
     - `german`, `english`, `arabic`: text blocks.
     - `author`: format `role: name` (e.g. `text: kenan khadaj`, `stimme: carsten jenss`).
     - `related`: select related glossary posts.
     - `position` & `rotation`: 3D coordinates on the relief.
2. **Editor Surface Placement Tool (`?place=1`)**:
   - Open `http://al-khatib.local/?place=1`.
   - The cursor turns into a crosshair.
   - Click any point on the relief: the exact position and surface-aligned rotation are copied to your clipboard in ACF format!

---

## 7. Production Deployment Checklist

When ready to deploy the `redesign` branch to production (`https://al-khatib-glossar.com`):
1. [ ] Back up production database and `wp-content/themes/` directory.
2. [ ] Verify git status is clean on `redesign` branch.
3. [ ] Run `npm run build` to generate production assets in `dist/`.
4. [ ] Sync `theme/`, `dist/assets/`, and `public/map-assets/` to the production server.
5. [ ] **Never** pass `--delete` on `wp-content/uploads/` or `map-assets/`.
6. [ ] Flush WordPress object cache and transients (`wp transient delete --all`).
7. [ ] Run `node tools/shot.mjs https://al-khatib-glossar.com` to verify live site.
