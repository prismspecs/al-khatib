# Redesign Architectural Decisions & Log

## Log

### Phase 0: Baseline & Foundation
- **Postcard Race Condition Fix**: In `main.js`, `postcard.htmlData` assignment previously threw a TypeError whenever post 550 arrived before `postcard.glb` finished asynchronous loading. Added `postcardHtmlData` buffer and assigned `postcard.htmlData` both in post 550 handler and in the GLTF loader callback.
- **Config & Runtime Host Independence**: Introduced `config.js` and `window.AKG` pattern. Dynamic detection in `theme/map.php` passes `home_url('/')` and `get_stylesheet_directory_uri()` directly to avoid hard-coded hosts in the bundle.
- **Functions.php Syntax Fix**: Replaced opening `<?` with `<?php` and corrected shortcode closing tags (`<div class="poem">...</div>`, `<div class="arabic">...</div>`).
- **Archive Strategy**: Stale root assets (`glyphdata_archive.js`, `glyphs_jpg backup/`, `landing-*.png/jpg` duplicates, `._.DS_Store`, legacy `index.html`, legacy `style.css`) moved to `archive/` rather than deleted.
- **Vite Proxy**: Configured Vite dev server to proxy `/wp-json` and `/wp-content` to `http://al-khatib.local` for local development workflow parity.

### Phase 1: Asset Pipeline
- **Planar UV Mapping**: Overhang on the paper relief is only 0.20%, well under the 3% threshold. Planar top-down UV projection gives a single, seamless, distortion-free atlas and eliminates 32 separate draw calls.
- **Perpendicular Back & Rim Extrusion**: Extruding boundary vertices purely along the depth axis (Blender Y / glTF -Z) and mirroring the planar UVs on the back face creates a closed, manifold mesh with exact 0.000000 mm bounding box parity across X and Y.
- **Texture Format**: Utilized WebP textures via `gltf-transform`. KTX2/Basis tools (`toktx`) are not installed on the host; WebP delivers 4.4 MB main asset and 376 KB proxy asset.
- **Handwriting Legibility**: Confirmed in Cycles closeup render (`docs/redesign/progress/phase-1-compare-closeup.png`) that 4096² planar atlas preserves clear, legible pencil handwriting without requiring the 8K atlas.

### Phase 2: Renderer Core
- **Three.js & Architecture Modernization**: Upgraded Three to `r170` with `AgXToneMapping`, `SRGBColorSpace`, and `gsap`. Modularized `main.js` into `src/three/*` and `src/data.js`.
- **On-Demand Invalidate Loop**: Replaced scattered `render()` calls with an on-demand `loop.js` driven by dirty flags and time horizons, automatically pausing when the browser tab is hidden.
- **CameraControls & Named Shots**: Replaced OrbitControls with `camera-controls`, supporting truck/pan, dolly-to-cursor, bounded rotation, and named view shots (`threshold`, `overview`, `glyph`, `about`).
- **Interactive Inspection Lamp**: Implemented warm raking SpotLight (4300 K, low 20° elevation, PCF soft shadows) tracking pointer hits on the relief with Lissajous idle drift.
- **Zero-Pop Model Swap**: Loads `relief_proxy.opt.glb` (376 KB) instantly, then cross-fades `relief.opt.glb` over 600 ms once ready.

### Phase 3: Design System + Chrome
- **Design System Tokens & Self-Hosted Typography**: Implemented CSS custom properties for archival palette (`--ink`, `--paper`, `--prussian`, `--trace`), typography, and glass chips. Self-hosted all fonts in WOFF2 format (`Favorit`, `IBM Plex Sans Arabic`, `IBM Plex Mono`, `Newsreader`, `Noto Naskh Arabic`), completely removing external Google Fonts and external network dependencies.
- **Persistent Chrome & UI Architecture**: Built persistent chrome with archival wordmark, language toggle (`DE`, `EN`, `AR`), view triggers (`[I]` Index, `[A]` About), `{read} / 35` progress counter, and subtle fading hint line.
- **Reactive Store & Hash Router**: Created reactive store (`src/state.js`) with localStorage persistence for visited entries, coupled with hash router (`src/router.js`) handling deep links (`#/e/<slug>`, `#/index`, `#/about`, `?lang=`) and browser back/forward history.
- **RTL Typography Support**: Arabic mode activates `dir="rtl"` with `IBM Plex Sans Arabic` display / `Noto Naskh Arabic` reading styles, tailored line-height (1.9), and disabled letter-spacing.
- **Lerping Inspection Cursor**: Implemented two-tier custom cursor (`src/ui/cursor.js`: 6px paper dot + 28px lerping ring) that shifts to red glyph trace tint on hover and hides on touch/coarse pointers.

### Phase 4: Glyph Traces
- **Custom ShaderMaterial & Ink Wipe**: Created custom shader deriving stroke alpha from texture luminance via `smoothstep(0.12, 0.50, lum)`. Uniform `uReveal` drives a procedural 2D noise ink-wipe (450 ms) on hover and staggered intro, with subtle per-glyph breathing oscillation (0.035 amplitude, randomized phase offset).
- **Archival State Styling**:
  - Unread idle: 22% opacity in `--trace` (`#e26041`).
  - Read idle: 18% opacity in `--paper` (`#f4efe4`), clearly reflecting progress on the 3D relief.
  - Hovered: inking in to 100% opacity in `--trace`, scaled up 1.06x.
  - Active: stays at 100% opacity in `--trace`, while other glyphs dim down to 8% opacity.
- **Hit Testing with Relief Topography Occlusion**: Hit raycasts against dedicated invisible hit planes (1.3x scale) are filtered against relief intersection distance (`dist <= reliefDist + 0.12`). Glyphs hidden behind relief curvature or rear faces are physically non-interactive.
- **Click vs Drag Discrimination**: Pointer gesture tracking strictly distinguishes clicks (< 5 px movement and < 400 ms hold) from camera navigation gestures, eliminating accidental clicks during camera truck/pan.
- **Hover Label Chip**: Created floating glass label chip (`src/ui/hover-chip.js`) displaying entry title, category badge (`TEXT-COLLAGE`, `STIMME`, etc.), and available language flags (`DE · AR`).
- **Surface Normal Alignment**: Glyphs with zero manual rotation sample relief surface normals and align naturally to the topographical slope.
- **Editor Placement Mode**: Added `?place=1` helper that turns cursor into crosshair and logs/copies precise surface position and rotation in ACF format on click.

### Phase 5: Entry Panel
- **Lean REST Endpoints**: Implemented `GET /wp-json/akg/v1/glossary` (returning lightweight manifest of 35 glyphs + Postcard) and `GET /wp-json/akg/v1/entry/<id>` with WordPress transient caching (`HOUR_IN_SECONDS * 12`) and automatic cache busting on `save_post`.
- **HTML Sanitizer & Media Rewriter**: Implemented `src/ui/sanitize.js` stripping all `<script>` tags (including ARVE JSON-LD), stripping inline styles, unwrapping ARVE wrappers to semantic HTML5 `<video controls preload="metadata">`, enforcing `loading="lazy" decoding="async"` on images, securing external links (`rel="noopener noreferrer"`), and dynamically rewriting hardcoded hostnames to the current runtime origin.
- **Micro-App Entry Panel**: Implemented `src/ui/entry-panel.js`:
  - Reading progress hairline dynamically tracking scroll percentage.
  - Meta row with category badge, alphabetical progress counter (e.g. `04 / 35`), and per-entry language chips showing only available translations.
  - Title block with 64px red glyph thumbnail in `--trace` and typography in `Favorit` / `IBM Plex Sans Arabic`.
  - Parsed contributor definition list (`text: ...`, `übersetzung: ...`, `stimme: ...`).
  - Reading typography using self-hosted `Newsreader` (DE/EN) and `Noto Naskh Arabic` (AR) with measure bounded to 38em.
  - Language fallback banner (`Not available in English — showing German`) when global preference is unavailable for a given entry without mutating global user state.
  - Expand mode (`[F]`) widening the panel to a 760px centered reading column over a blurred map for long texts (e.g. 48k char entry 224).
  - Related entries row with hover pulse that illuminates the related glyph trace on the 3D map.
  - Alphabetical Prev/Next navigation with arrow key shortcuts (`←` / `→`).
- **Minimal Custom Audio Player**: Implemented `src/ui/player.js` with mono time readout (`00:00 / 03:42`), 1px interactive hairline scrubber, Spacebar play/pause shortcut, and lifecycle media pausing on navigation.
- **Deep Linking Parity**: Verified deep linking via CDP test suite for test entries: 224 (48k text), 220 (audio), 251 (video), 247 (gif), 31 (Arabic only), 172 (trilingual).

### Phase 6: Threshold
- **SVG Self-Drawing Contour Animation**: Extracted the archival relief outline from `landing-simplified.svg` into an animated SVG overlay in `src/ui/threshold.js` using `stroke-dashoffset` driven by GSAP. Staggered stroke drawing animates the relief boundary, rim, and internal contours before typography fades in.
- **Live Relief Download Progress Tracking**: Connected Three.js GLTFLoader `onProgress` callbacks directly to the threshold interface (`threshold.updateProgress(pct, label)`), displaying a mono hairline indicator (`relief 100 %`) and enabling immediate transition once the relief asset is ready.
- **Multilingual Title Block**: Rendered translated title, subtitle, and curator credits (`Favorit` / `IBM Plex Sans Arabic`) reflecting active language toggle without leaving the landing screen.
- **Routing & Cold Visit State Machine**: Hash router (`src/router.js`) defaults cold visits (empty hash) to the threshold view. When navigating to deep links (`#/e/<slug>`, `#/map`, `#/index`, `#/about`), threshold is automatically bypassed. Clicking the persistent wordmark in chrome returns to the threshold.
- **Entry Panel Navigation Guard**: Avoided a circular loop where closing the entry panel programmatically would trigger a router redirect to `#/map` and hide the threshold. Guarded navigation in `entryPanel.close()` to fire only when `view === 'entry'`.
- **Headless SwiftShader Timing Optimization**: Tightened GSAP timeline reveal delays to 0.4s–0.8s, ensuring snappy user interaction on low-end/CPU SwiftShader environments while retaining smooth choreography on desktop.
- **Mobile Responsive Thumb-Bar**: Configured `@media (max-width: 640px)` stacking the Enter button above the language chips and progress readout (`flex-direction: column-reverse; gap: 16px;`) for one-thumb reach without touch target overlap.
- **Legacy Markup Pruning**: Removed obsolete `#landing`, `#overlay-outer`, and unbundled inline scripts from `index.html` and `theme/map.php`.

### Phase 7: Index + About
- **Index Typographic Overlay**: Created full-screen glass overlay (`src/ui/index-view.js`, `src/styles/index-view.css`) presenting all 35 entries as a responsive typographic grid over a blurred map (`backdrop-filter: blur(24px)`). Each row features unread/read bullet indicators, two-digit mono index numbers, 28px red stroke glyph thumbnails, title in `Favorit` / `IBM Plex Sans Arabic`, parsed contributor credits, category badge, and trilingual availability chips.
- **Multi-Dimensional Filters**: Implemented dynamic filter bar supporting type filtering (`text`, `stimme`, `video`, `text-collage`, etc.) and language filtering (`DE`, `EN`, `AR`), extracting available types dynamically from the glossary manifest.
- **3D Relief Hover Link Behind Blur**: Hovering any entry in the Index immediately brightens that glyph trace (`glyphsManager.setHovered`) and points the warm inspection lamp (`lamp.setPointerTarget`) at that glyph on the 3D relief behind the frosted glass.
- **Postcard Alignment & Scale Correction**: Corrected `postcard.opt.glb` scale to unit `1.0` and position to `z = -0.3` in `src/three/postcard.js`, restoring the original 6.0 × 4.5 bounding box and manifold physical relationship with the relief.
- **Reverse-Side Camera Navigation**: Lifted front azimuth constraints (`[-60°, +60°]` to `[-Infinity, +Infinity]`) in `shots.about` (`src/three/camera.js`), smoothly orbiting the camera around the relief edge to the reverse face (`(0.9, -2.6, -4.2)` looking at `(0.7, 0, -0.3)`). The viewport offset places the postcard in the open left half while the About panel slides in on the right.
- **Rear Archival Illumination**: Added a dedicated warm rear archival light (`0xffeedb`, intensity 0.55 at `(0.6, -3.2, -4.2)`) in `src/three/lamp.js`, ensuring the aged paper postcard texture and extruded rim are clearly illuminated under raking light from behind.
- **Full Trilingual Archival Documentation**: Integrated Post 550 intro text with the complete collective statement, contributors list (11 members), guests (4 contributors), project leadership, and Deutscher Übersetzerfonds funding line in DE, EN, and AR with full RTL support.

### Phase 8: Post-Processing, Polish & Mobile Handover
- **Selective Post-Processing Pipeline**: Implemented `src/three/post.js` with `postprocessing` `EffectComposer` utilizing `HalfFloatType` framebuffers. Composed subtle trace bloom (`BloomEffect` with mipmap blur), archival 35mm grain (`NoiseEffect` in overlay blend mode), border darkening (`VignetteEffect`), and subpixel anti-aliasing (`SMAAEffect`).
- **Quality Tier Gating & Frame-Time Safeguard**: Mobile viewports and coarse pointers bypass post-processing entirely for native GPU throughput. Implemented a 60-frame runtime probe that detects hardware underperformance (> 33 ms average frame time) and dynamically downgrades to direct rendering.
- **Mobile Wall Removal & Native Bottom Sheet**: Decommissioned legacy `#mobile-popover` and user-agent sniffers from `theme/map.php` and `index.html`. Replaced the side panel on mobile (`@media (max-width: 720px)`) with an archival bottom sheet featuring a tactile drag handle (`.sheet-drag-handle`), 80vh height, rounded corners, and touch swipe-down dismiss gestures.
- **Semantic SEO & No-JS Fallbacks**: Added Open Graph metadata, font preloads, and proxy relief preloads in `theme/map.php`. Injected a crawlable `<nav class="sr-only">` and `<noscript>` listing all 35 glossary posts for search indexers and non-JS clients.
- **Standalone Archival `single.php`**: Replaced standard theme template with a dedicated no-JS reading view for individual posts, complete with red glyph marks, metadata definition list, trilingual body sections (with RTL support for Arabic), and direct "Open in 3D Map" deep links.

### Fix: Glyph Visibility on Map
- **Root Cause**: In `GLYPH_FRAGMENT_SHADER` (`src/three/glyphs.js`), the ink-wipe smoothstep formula (`smoothstep(threshold - 0.20, threshold + 0.05, coord)`) shifted `edge0` to `1.05` when `uReveal = 1.0`. Since normalized coordinates rarely exceeded `1.0`, `wipe` returned `0.0` for 98.6% of surface pixels, which was then discarded by the alpha threshold.
- **Wipe Inversion Resolution**: Restructured the wipe to `smoothstep(0.0, 0.15, threshold - coord)` where `threshold = mix(-0.25, 1.25, uReveal)`, achieving an exact 0.0% hidden to 100.0% revealed progression across the noise field.
- **Additive Luminous Blending**: Configured `THREE.CustomBlending` (`blendSrc: THREE.SrcAlphaFactor`, `blendDst: THREE.OneFactor`) with `--trace` color `0xff4a3d`. This renders vivid, glowing archival red strokes on top of the photogrammetry relief while preserving underlying paper fibers and pencil handwriting.
- **Surface Elevation Safeguard**: Added `alignToRelief(reliefMesh)` ensuring every glyph plane floats cleanly at `Math.max(glyph.z, reliefHit.z + 0.04)` to prevent any portion of a glyph from clipping under topographical peaks.

### Performance & Hardware Acceleration Optimization
- **Decoupled 1-per-frame Raycasting**: Previously, every raw `pointermove` event (up to 1000Hz on gaming mice) synchronously executed raycasting across 350,000 triangles, locking the main thread. Decoupled mouse move events to simple coordinate storage (`pendingPointerX/Y`) and executed raycasting strictly at most once per animation frame inside the render loop's `onUpdate`. Simulated 200 mouse moves completed in 2.50 ms (0.013 ms/event).
- **8k Proxy Mesh as Raycast Target**: Retained `relief_proxy.opt.glb` (8,000 triangles) in the scene with `visible = false` as the permanent hit test target instead of raycasting against `fullMesh` (350,268 triangles). Achieves 44x reduction in triangle tests with sub-millimeter parity.
- **Disabled Redundant Shadow Casting**: Set `child.castShadow = false` on the relief mesh. The photogrammetry paper surface already features 4K baked normal maps and 2K ambient occlusion maps; self-shadowing 350k triangles into a 2048x2048 shadow map was redundant and cost ~10ms per frame. Reduced spot lamp shadow map size from 2048 to 1024.
- **True Idle Sleep for Render Loop**: Bounded the inspection lamp's Lissajous idle drift between 4s and 14s, gently easing to rest at center `(0, 0, 0.1)` thereafter and pausing completely in non-map views (`entry`, `index`, `about`, `threshold`). When the lamp and camera reach rest, `update()` returns `false`, allowing the render loop to stop `requestAnimationFrame` entirely (0% CPU / 0% GPU when idle).
- **Capped DPR to 1.5 & FXAA Effect**: Capped `devicePixelRatio` to `Math.min(window.devicePixelRatio || 1, 1.5)` in `stage.js`, reducing WebGL framebuffer pixel count by 44% on Retina/4K displays. Replaced multi-pass `SMAAEffect` with single-pass `FXAAEffect`, fusing Bloom, Noise, Vignette, and FXAA into a single draw call. Lowered frame-time probe threshold from 33ms to 20ms (< 50fps) for instant low-tier fallback.
- **Sleeping Cursor rAF Loop**: Suspended the custom cursor's `requestAnimationFrame` loop whenever the cursor converges to rest, eliminating continuous style transform updates when the mouse is stationary.

### Plan 3: Entry Panel Redesign, Content Normalization & Reading Mode
- **Structural Layering & Pointer Event Fix (Part A)**:
  - Eliminated the blanket `#ui-root > * { pointer-events: auto }` rule that previously caused hidden `opacity: 0` panels (`#akg-about-panel`, `.akg-index-overlay`) to intercept pointer events over entry controls.
  - Implemented `src/ui/layer.js` (`showLayer`, `hideLayer`, `isLayerOpen`) managing global `[hidden]` attributes and `inert` state, ensuring closed layers are physically removed from the browser hit-test tree while preserving exit transitions.
  - Added cache-busting `assets/index.js?v=<filemtime>` in `theme/map.php` to prevent stale script execution.
- **Font Fingerprinting & Custom Tokens (Part C0)**:
  - Relocated WOFF2 webfonts to `src/assets/fonts/` with relative `base: './'` paths in Vite, eliminating font 404s.
  - Defined missing CSS variables (`--font-read`, `--font-arabic-read`, `--font-arabic-display`, `--dur-mid`) in `tokens.css` and added automated CI verification (`tools/check-css-vars.mjs`).
  - Added complete i18n dictionary in `src/i18n.js` covering all UI strings across German, English, and Arabic.
- **Panel Structure & Archival Tinting (Part C1–C3, C7)**:
  - Replaced raw JPEG glyph boxes with luminance-to-alpha converted drawings (`src/ui/glyph-image.js`) tinted to `--trace` (`#e26041`) or `--paper` (`#f0ede6`), removing artificial drop-shadows and box containers.
  - Restructured panel with sticky 56px glass header, 1px hairline `.reading-progress`, and inner scroll container (`.panel-scroll`) with `min-height: 0` and `overscroll-behavior: contain`.
  - Added 56px drawing emblems for related entries and footer Prev/Next navigation in alphabetical sequence.
- **Body Content Normalizer (Part C4)**:
  - Implemented `src/ui/normalize.js` executing 12 semantic rules before stripping inline styles:
    - Rule 1: Underlines preserved as semantic `<u class="mark">`.
    - Rule 2: Inline padding converted to `data-indent="k"` with responsive rem margins.
    - Rule 3: Image `srcset` and `sizes` preserved with lazy loading.
    - Rule 4: Redundant spans unwrapped; inline styles sanitized.
    - Rule 5: Runs of empty paragraphs consolidated into `<div class="gap" data-size="1|2|3">`.
    - Rule 6: Heuristic and class-based verse detection generating semantic `<div class="verse"><p class="stanza"><span class="line">...</span></p></div>` without forcing italic or ladder margins (verified on 217, 149, 152 vs 172, 224, 175, 120).
    - Rule 7: Speaker turn detection (`<p class="turn"><span class="speaker">...</span></p>`), rendered with hanging start indent in reading mode.
    - Rule 8: Sub-heading conversion (`<h3 class="subhead">`).
    - Rule 9: Footnotes and sources extracted to dedicated `.entry-notes` with bidirectional smooth-scrolling links (`<sup>n</sup>` <-> `#note-n`).
    - Rule 10: Figures wrapped in `<figure class="fig">` with GIF centering.
    - Rules 11 & 12: RTL-aware lists and external link marks (`↗`).
  - Added per-entry manual overrides table in `src/entry-overrides.js` per §8.
- **Media-Led Layouts & Waveform Player (Part C5–C6)**:
  - Created Web Audio API waveform player in `src/ui/player.js` with peak decoding, `sessionStorage` caching, 160-point `<canvas>` waveform rendering, and keyboard seeking (`Space` toggle, `←/→` 5s seek only while focused).
  - Built media-led layout for audio-only pieces (centered 60% glyph drawing emblem, title, 56px round play button, full-width waveform scrubber, hidden empty body).
  - Implemented compact sticky player for text+audio entries that remains anchored under the header during playback.
  - Implemented 200ms cross-fade with scroll reset on in-panel language switching.
- **Full Reading Mode (Part B)**:
  - Geometry: Full viewport coverage (`inset-block: 0; inset-inline-end: 0; width: 100vw; height: 100vh; background: rgba(11, 12, 16, 0.96);`), smoothly widening 500ms from the inline-end edge.
  - Desktop Grid (≥ 1100px): 3-column CSS Grid `minmax(220px, 1fr) minmax(0, 42rem) minmax(220px, 1fr)` with 48px gap:
    - Start rail (sticky, top 96px): large glyph drawing emblem (up to 260px), entry type, index counter, language toggle chips, and contributor credits.
    - Center column: display title (`clamp(3rem, 5vw, 4.5rem)`), media hero, reading typography (21px Latin / 24px Arabic, measure bounded to 42rem), breakout figures, and Prev/Next footer nav.
    - End rail (sticky, top 96px): footnotes/sources list and related entries list with 56px drawing emblems.
  - Header: Sticky full-width header with archival wordmark on the left, Collapse `[F]` and Close `[Esc]` on the right, and 1px reading progress hairline beneath.
  - Scene Integration: In reading mode, pointer raycasts are silenced, camera view offset tweens to 0, and the render loop pauses completely while covered.
  - Navigation & Keyboard: Pressing `F` toggles reading mode. Two-step `Escape`: first `Esc` exits reading mode and restores exact previous scroll position; second `Esc` closes entry panel to map.
  - Responsive Behavior: Single column under 1100px; mobile (< 720px) bottom sheet snap acts as reading mode with expand chip hidden.
  - Verification: 124/124 automated CDP assertions passing across `desktop-1440`, `desktop-1920`, and `mobile-390` in both German and Arabic.


### Plan 2: Map Interaction, Glyph Density & Free-Viewport Centring
- **Z-Up Coordinate Frame Correction**: The relief lies in the XY plane facing +Z. Reconfigured `camera-controls` with `camera.up.set(0, 0, 1)`, aligning polar angles (20°–75° from +Z) and azimuth angles (-60° to +60° around +Z) directly with natural tilt and turn relative to the relief table. Eliminated spherical pose clamping.
- **Original Glyph Sizing & Manifold Flat Placement**: Restored the archival longest-edge normalization (`GLYPH_SIZE = 1.8`, `width = aspect >= 1 ? S : S * aspect`, `height = aspect >= 1 ? S / aspect : S`). Eliminated arbitrary triangle normal tilting in favor of pure ACF rotations (`rotation.x/y/z`), sampling 5 relief points (center + 4 corners) to sit flush at `max(acf.z, sampledHeight + 0.03)`.
- **Normal Blending & Proximity Reveal**: Replaced additive glow with `THREE.NormalBlending` (`depthWrite: false`, stable `renderOrder` by id). Added `uLampPos` and `uLampRadius` (2.2) proximity falloff so idle glyphs reveal gently under the inspection lamp (`mix(0.10, 0.55, proximity)`), with dynamic `zoomT` stroke weight scaling and per-ink canvas picking mask dilation.
- **Mathematical Free-Viewport Centring**: Replaced hardcoded world target offsets (`panelOffset = ±1.4`) with exact viewport projection alignment using Three.js `camera.setViewOffset`. For desktop LTR (panel right), desktop RTL (panel left), and mobile bottom sheet (bottom 55%), `calcViewOffset` places the 3D look-at target precisely at the geometric center of the unoccupied screen area. Transition distance is mathematically calculated to ensure glyph bounding boxes occupy ~55% of the free viewport. On panel dismissal, previous overview camera pose and view offset are smoothly restored.
- **Layering & Canvas Pointer Exclusivity**: Placed `#chrome-layer` at `z-index: 65` (above entry panel `z-index: 50` and index overlay `z-index: 55`). Scope pointer listeners (`pointerdown`, `pointermove`, `pointerup`) to `renderer.domElement` instead of `window`, preventing UI clicks from stealing canvas focus. Added `.chrome--panel-open` translation to evade panel boundary overlap.
- **Interactive Map Controls**: Introduced on-screen compass needle (with North reset click), zoom +/- chips, tilt cycle, mode toggle (move vs rotate), dual-touch gestures (two-finger pan/truck, pinch zoom, twist rotate), and keyboard navigation (`W/A/S/D`, `+ / -`, `R`, `N`).
- **Comprehensive CDP Verification Suite**: Validated across all 35 glyphs × 2 languages (`de`, `ar`) × 3 viewports (`1440x900`, `1920x1080`, `390x844`), confirming 100% pass rate (centring distance < 3.2px, bounding box containment, raycast hit consistency, and menu chip clickability with zero console errors).
