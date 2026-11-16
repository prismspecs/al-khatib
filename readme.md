# Al-Khatib Glossar

An archival, trilingual (DE / EN / AR) interactive 3D WebGL experience centering the photogrammetry relief and 35 glyph traces of the Al-Khatib trial proceedings, produced by the literary collective Wiese (Wie es ist) / مرج.

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Local by Flywheel (serving WordPress at `http://al-khatib.local`)

### Commands
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Build production bundle
npm run build

# Deploy to Local WordPress site
./tools/deploy.sh
```

---

## Architecture & Features

- **Photogrammetry Relief**: Blender 5.2 headless planar UV rebake (0.20% overhang), manifold perpendicular extruded rim, 4K albedo, ORM, and AO maps packed via WebP (`relief.opt.glb` 4.42 MB, instant low-res proxy `relief_proxy.opt.glb` 376 KB).
- **Inspection Lamp**: Warm raking SpotLight (4300 K, 20° elevation, PCF soft shadows) tracking pointer hits on the relief with Lissajous idle drift.
- **Glyph Traces Shader**: Custom Three.js `ShaderMaterial` with luminance-derived alpha, procedural 2D noise ink-wipe, relief topography occlusion filtering, and archival state styling (unread idle 22%, read idle 18%, active 100%, inactive 8%).
- **Entry Panel**: Slide-out glass reading panel with reading-progress hairline, custom audio player for spoken entries, trilingual fallback banners, and expand reading mode (`[F]`).
- **Threshold View**: Vector SVG self-drawing relief contour animation, live model download progress hairline, and language switcher.
- **Index View**: Full-screen glass overlay (`#/index`) listing all 35 entries in a responsive typographic grid with real-time type/language filters and 3D relief hover synchronization.
- **About View**: Camera orbits behind the relief to the archival postcard (`postcard.opt.glb` at z = -0.3), presenting Post 550 and the full collective statement in German, English, and Arabic.
- **Post-Processing Pass**: Selective bloom on glyph traces, archival 35mm grain, vignette, and SMAA anti-aliasing with mobile bypass and 60-frame hardware performance probe.
- **Mobile First**: Touch bottom sheet with tactile drag handle and swipe dismiss, and removal of legacy mobile barriers.
- **Fallbacks & SEO**: Standalone readable `single.php` no-JS view, crawlable `<nav>` listing all entries, and Open Graph metadata.

---

## Documentation

Full architectural documentation is available in `docs/redesign/`:
- [decisions.md](docs/redesign/decisions.md) — Comprehensive architectural log for Phases 0–8.
- [handover.md](docs/redesign/handover.md) — Full operational handover guide and production deployment checklist.
- [deploy-notes.md](docs/redesign/deploy-notes.md) — Local vs production database migration & URL search-replace notes.
- [assets-report.md](docs/redesign/assets-report.md) — 3D asset bake report and compression metrics.
- [progress/](docs/redesign/progress/) — Desktop and mobile verification screenshots for each phase.
