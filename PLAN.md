# Al-Khatib-Glossar — Redesign Plan

Handoff document for the implementing model. Read sections 1–4 fully before touching code.
Work phase by phase (section 6). Each phase ends in a working, committable site.

Reference for the *feel* we want: https://gardenwithoutsoil.com/ (screenshots in
`docs/redesign/reference/ref-*.png`). Current state: `docs/redesign/reference/local-*.png`.

**Project goal in one sentence:** replace the current WordPress-hosted interactive 3D glossary with a visually
distinctive, fast, accessible, bilingual-to-trilingual (DE / EN / AR) experience that keeps the same content, the same
WordPress editing workflow, and the same 35 glyph positions, while making the relief and the traces the centre of the design.

**Status of this document:** the facts in §1 were verified against the repo, the live Local theme, the REST API, the GLB
files and headless screenshots on 2026-11-10. Anything marked *estimate* or *probable* must be verified in Phase 0 or 1.

---

## 1. What exists today (verified facts)

### Two places hold code

| Place | Path | Role |
|---|---|---|
| This repo | `/home/grayson/workbench/al-khatib` | Vite + three.js source (`main.js`, `index.html`, `style.css`). `npm run build` → `dist/` |
| Live theme | `~/Local Sites/al-khatib/app/public/wp-content/themes/blankslate/` | WordPress theme served at `http://al-khatib.local`. **Not in git.** |

**Local vs production (critical, easy to miss):**
- The WordPress database was imported from production and then search-replaced so URLs point at `http://al-khatib.local`.
  Post bodies, ACF fields, and media URLs therefore contain `al-khatib.local`. Production is `https://al-khatib-glossar.com`.
  Any future deploy to production must reverse this replacement (or the content must be re-exported). Do not assume the
  database can simply be copied back. Phase 0 documents the exact search-replace commands in `docs/redesign/deploy-notes.md`.
- The live bundle hard-codes `https://al-khatib-glossar.com/...` in `main.js` (asset and REST URLs). The Local copy in
  `assets/index.js` was hand-patched to `al-khatib.local`. The repo has not been the source of truth for the deployed bundle.
- How the production site is updated (FTP, SiteGround deploy, Duplicator package, or other) is **not known** from the repo.
  Ask Grayson before Phase 9 and do not attempt any production write during this project.

The theme's front page is `map.php` (template "Map"). It loads `assets/index.js` (the Vite bundle,
copied by hand), `style.css` (theme stylesheet — this is the *real* CSS; the repo's `style.css` is stale),
and contains the real landing text in German / English / Arabic. The repo's `index.html` is an outdated
lorem-ipsum copy of `map.php`.

### Stack
- three `^0.147.0` (old), Vite 4, lil-gui, stats.js, TWEEN from three examples. No framework.
- WordPress: PHP 8.2, table prefix `hcp_`, plugins ACF, ACF-to-REST, Advanced Responsive Video Embedder (ARVE), CPT UI.
- Tools on this machine: Blender 5.2 (`~/.local/bin/blender`), Node 24, google-chrome (headless works with
  `--enable-unsafe-swiftshader --use-angle=swiftshader`). `gltf-transform`/`gltfpack` are **not** installed (use via `npx`).

### 3D assets (`public/map-assets/`, git-ignored `*.glb`)
- `map-2048.glb` — 18.3 MB. Photogrammetry scan of a painted paper-pulp relief (off-white pulp, Prussian-blue ink,
  grey pulp clumps, pencil handwriting). One node `texturedMesh` with **30 primitives, ~46k verts total**, and
  **32 separate 2048² JPEG atlases** (0.3–0.8 MB each). Geometry is tiny; textures are everything.
  Bounds: x,y ∈ [-0.51, 0.51], z ∈ [0, 0.07]. Code scales it ×10. No normal/AO/roughness maps. `doubleSided`.
  → *Estimate:* 32 × 2048² RGBA with mipmaps is on the order of several hundred MB of GPU memory. This is the likely reason
  it is slow and why phones struggle. Measure in Phase 2 (`renderer.info`, browser GPU memory) before relying on the number.
- `postcard.glb` — 0.6 MB, a 6×4.5 plane with one JPEG, placed *behind* the map (z = −0.3). It is the "About" object.

### Content (REST: `/wp-json/wp/v2/posts?categories=2&per_page=100&_embed`, 1.9 MB response)
- 36 posts: 35 glossary entries + post **550 "About"** (`acf.is_postcard: true`, no featured image).
- Per entry `acf`: `position {x,y,z}` and `rotation {x,y,z}` (strings; scene units after ×10 scale, x,y ∈ ±5, z 0.2–0.6;
  rotation in degrees), `author` (free text like `text: kenan | übersetzung: …`, `gespräch: luna, maru, …`,
  `text-collage: sandra`, `video: …`, `gif: …`, `stimme: …`, `collage: …`, `idee: …`), `english` / `german` / `arabic`
  (HTML bodies), `description {english,german,arabic}` (all empty), `related` (array of WP post objects: `ID`, `post_title`, `post_name`).
- Featured image = the **glyph**: a ~1000 px JPEG, white hand-drawn lines on black (see `public/map-assets/glyphs_jpg/`).
  Used as both `map` and `alphaMap`.
- Language coverage is very uneven: every entry has German (one is Arabic-only: 31 "zellen"); ~10 have Arabic;
  only "ereignisse" (172) and About (550) have English. Bodies range from 200 to 48,000 characters.
- Body HTML contains: `p, span (inline font-weight styles), em, i, b, sup, a, ol/ul/li, hr, br, img, <div class="poem">`,
  native `<audio class="wp-audio-shortcode" controls>` and ARVE `<video controls>` wrappers, plus `<script type="application/ld+json">`.

### Current behaviour and its problems
1. Landing: full-screen photo of the relief + red line-drawing SVG (`assets/landing.svg`) + "Al Khatib-Glossar" + a
   scrolling text column set in black Favorit directly over the busy photo → hard to read.
2. Map: OrbitControls around a flat object, flat lighting (0.7 ambient), bloom over un-tonemapped output, a JPEG as
   background. No raking light, so the relief — the whole point of scanning it — is invisible.
3. Glyphs are `opacity: 0` until hovered. Nothing tells the visitor there are 35 things to find.
4. Entry overlay: a white rounded box covering 75 % of the screen; hides the map entirely.
5. Phones get a "use a desktop" wall.
6. **Probable live bug** (`main.js` ~l.652): `postcard.htmlData = []; postcard.htmlData.post.english = …` throws
   (`post` undefined; also `postcard` may still be `null` if the GLB hasn't loaded). Post 550 comes first in the response, so the
   `forEach` aborts and **no glyphs are ever created**. The deployed bundle has the same code. Confirm in Phase 0.
7. Asset/API URLs are hard-coded to `https://al-khatib-glossar.com/…` in `main.js`; the local theme bundle was hand-patched.
8. Render-on-demand via scattered `render()` calls; tween/render coupling is fragile.
9. `functions.php` opens with the short tag `<?`; shortcodes `poem`/`arabic` open a `<div>` and close a `</span>`.

---

## 2. Design direction

**One idea: the relief is an exhibit under an inspection lamp in a dark room.**
The subject is a torture trial and the language around it. The design must be quiet, exact and physical — archival,
forensic, never decorative. "Sexy" here means: darkness, one beautifully lit object, superb typography, slow confident motion.
What we take from the reference: near-black field, a single 3D object that persists across every view, tiny mono
UI chips with keyboard hints, glass panels over a blurred scene, a large display title, long-form text set generously.
What we do **not** copy: its fonts (commercial trials), its pixel-serif title, its copy, its stone.

### 2.1 Palette (sampled from the artwork itself)
```css
:root {
  --ink:        #0b0c10;  /* room. blue-black, never pure #000 */
  --ink-2:      #14161d;  /* panels */
  --ink-3:      #23262f;  /* hairlines, chip borders */
  --paper:      #ece7da;  /* pulp white: all primary text */
  --paper-dim:  #a8a497;  /* secondary text */
  --paper-mute: #6c6a63;  /* tertiary, kbd hints */
  --prussian:   #27348b;  /* the ink on the relief: selection, focus ring, visited */
  --trace:      #ff4a3d;  /* the red line of the glyphs/landing drawing: the ONLY accent */
}
```
Rules: red is reserved for glyph traces, the active language, and the one primary action on screen. Blue only for
focus/visited. No gradients except scene fog and panel-edge fades. No rounded corners above 2 px. No drop shadows on UI.

### 2.2 Typography (all free/OFL, self-hosted woff2 in `theme/fonts/`, no Google Fonts requests)
| Role | Latin | Arabic | Use |
|---|---|---|---|
| Display | **Favorit Medium** (file present in `theme/fonts/`; licence unverified, see §7) | **IBM Plex Sans Arabic** 500 | site title, entry titles |
| Reading | **Newsreader** (variable, opsz) 400/400i/600 | **Noto Naskh Arabic** 400/600 | entry bodies, About |
| UI / meta | **IBM Plex Mono** 400 | IBM Plex Sans Arabic 400 | chips, labels, author line, kbd hints, counters |

- Entry title: `clamp(2.25rem, 4.5vw, 4.5rem)`, line-height 0.95, lowercase as authored (titles are lowercase in WP — keep).
- Body: 19–21 px, line-height 1.55, measure 34–38em max, `hyphens: auto` with `lang="de"`, `text-wrap: pretty`.
- Arabic body: 1.2× the Latin size, line-height 1.9, `dir="rtl"`, never letter-spaced, never uppercase-transformed.
- UI mono: 11–12 px, `letter-spacing: .04em`, uppercase for Latin labels only.
- `.poem`: Newsreader italic, `white-space: pre-line`, zero paragraph margins, hanging indent.
- Use CSS logical properties everywhere (`margin-inline`, `inset-inline-start`) so RTL costs nothing.

### 2.3 UI vocabulary
- **Chip**: 28 px high, 1 px `--ink-3` border, `background: rgb(20 22 29 / .55)`, `backdrop-filter: blur(12px)`, mono label
  left, kbd hint right in `--paper-mute` (`Enter [↵]`, `Index [I]`, `Sound [M]`). Hover: border → `--paper`. Active: paper fill, ink text.
- **Panel**: `--ink-2` at 78 % + `blur(24px)`, 1 px hairline, square. Slides 24 px + fades, 500 ms.
- **Cursor**: default over UI; over the map a 6 px paper dot + a 28 px ring (CSS element following the pointer with lerp);
  ring contracts and turns red over a glyph. Hide on touch devices.
- **Motion**: one easing `cubic-bezier(.2,.7,.1,1)`; durations 200 (UI), 500 (panels), 1400–2200 (camera).
  Honour `prefers-reduced-motion`: camera cuts with a 200 ms cross-fade, no parallax, no grain animation.
- **Grain**: a static 2–3 % noise overlay (CSS, `mix-blend-mode: overlay`) over everything to marry DOM and canvas.

### 2.4 Screens

**A. Threshold (replaces landing).** Black. The relief is already there, far away, lit low, slowly drifting (≤2°/s).
Centre: the red line drawing (`landing.svg`) **draws itself** (stroke-dashoffset, ~3 s) over the relief, then the title
`Al-Khatib-Glossar` / `معجم الخطيب` fades in beneath in Favorit. Bottom centre: chip `Enter [↵]`. Bottom left: language
chips `DE  EN  عربي`. Bottom right: `Sound off [M]` (only if Phase 9 is done). A 1 px progress hairline along the bottom
edge shows model loading, with a mono readout (`relief 43 %`). Enter is available immediately; if the hi-res model
isn't ready the low-res proxy is shown (see 3.1). No body text here — the long statement moves to About.

**B. Map (home).** Enter → 2.2 s camera descent from far/top-down to a 3/4 raking view; drawing and title dissolve;
glyph traces fade up one by one (staggered 40 ms, random order). Persistent chrome, all mono chips:
- top-left: wordmark `Al-Khatib-Glossar` (click → Threshold)
- top-right: `Index [I]` · `About [A]` · language chips
- bottom-left: one-line hint that fades after first interaction: `Drag to move. Scroll to zoom. Click a trace to read.`
- bottom-right: `12 / 35 read` counter (localStorage)
Hover a glyph → trace brightens and "inks in", a label chip appears beside the cursor: title, type (`text-collage`),
and available languages (`DE · AR`). Click → camera flies so the glyph sits in the free half of the screen, Entry panel opens.

**C. Entry panel.** A column on the inline-end side: `width: min(720px, 46vw)`, full height, glass. The map stays visible
and alive in the remaining space with the active glyph lit; everything else dims 40 %. Structure top→bottom:
1. Meta row (mono): type · `04 / 35` · language chips showing only languages that exist for this entry · `Close [Esc]`
2. Title (display) with the entry's glyph image as a small red mark (64 px) next to it
3. Contributors parsed from `author` as a definition list (`text` → kenan, `übersetzung` → …)
4. Body (reading type). Images full column width with 1 px hairline; audio/video restyled (3.6)
5. Related entries as a row of glyph thumbnails + titles; hover one → its trace pulses on the map; click → camera flies, panel content cross-fades
6. Footer: `← prev [←]` / `next → [→]` (alphabetical order)
A thin reading-progress hairline runs down the panel's inner edge. For Arabic the panel flips to the other side (logical properties do this).
If the chosen global language isn't available: show the entry in its first available language with a one-line mono note
(`Not available in English — showing German`). Never silently switch the global language (today's code does).
`Expand [F]` widens the panel to a centred 760 px reading column over a fully blurred map for the 48k-character texts.

**D. Index.** `[I]` or route `#/index`. Full-screen glass over the blurred, dimmed map: all 35 entries as a typographic list —
big Favorit titles in 2–3 columns, mono type and languages, the glyph mark at row start. Hovering a row moves the lamp/camera
to that glyph behind the blur. Filter chips by type (text, gespräch, text-collage, collage, video, gif, stimme) and by language.
This is also the keyboard/screen-reader path and the **phone default**.

**E. About.** `[A]` or `#/about`. Camera travels *around the edge and behind* the relief to the postcard (it lives at z = −0.3):
the reveal that the map has a back. The postcard fills the left; the panel carries post 550's text followed by the long
collective statement currently hard-coded in `map.php` (move it to WP — see §4.2), contributors, funder line.

**F. Phone (< 720 px or coarse pointer).** No wall. Threshold is identical. Map is available with one-finger pan / pinch zoom
(low-res proxy only, no post-processing); a bottom sheet replaces the side panel (drag handle, snaps 55 % / 100 %); `Index` is the
obvious primary chip.

---

## 3. 3D plan

### 3.1 Asset pipeline (Blender headless + gltf-transform). Scripts go in `tools/assets/`, outputs in `public/map-assets/`
Keep `map-2048.glb` untouched as the source. **Never change the model's origin, orientation or scale** — the 35 ACF
positions depend on it. After every export, assert the bounding box equals the source (±1e-4).

1. `tools/assets/01_prepare.py` (run: `blender -b -P … -- in.glb outdir`):
   - Import; join the 30 primitives into one object; merge by distance (1e-5); recalc normals; keep the original UVs/materials as "source".
   - Duplicate → **target** mesh: new UV map via Smart UV Project (island margin 0.003) or, better, a simple planar top-down
     projection (the object is a relief: x,y → u,v gives near-zero distortion and makes one clean, seam-free atlas).
     Use planar projection unless overhang area > ~3 % (print the stat).
   - **Bake** (Cycles, Emit, selected-to-active, cage extrusion 0.002) source colour → target:
     `relief_albedo_4k.png` (4096²) and `relief_albedo_8k.png` (8192²).
   - Bake **AO** (128 samples, distance 0.05) → `relief_ao_2k.png`.
   - Bake a **normal map**: geometry normals plus a Bump node driven by albedo luminance (strength 0.15, high-pass first so
     the blue ink doesn't read as pits) → `relief_normal_4k.png`. This gives paper-fibre micro relief under raking light.
     *Gate:* render a test frame with and without; if it looks embossed/fake, drop it to strength 0.05 or ship without.
   - Give the object a **back and an edge**: Solidify (thickness 0.012, offset −1, rim only) with a plain pulp-coloured rim
     material; planar-project the back with a darkened, desaturated, mirrored albedo. Replaces the yellow "divider plane" hack.
   - Export `relief_proxy.glb` (decimate to ~8k tris, 1024² albedo) and `relief.glb` (full mesh, 4k albedo+normal, 2k AO packed into ORM).
2. `tools/assets/02_optimize.sh`:
   `npx @gltf-transform/cli optimize relief.glb relief.opt.glb --compress meshopt --texture-compress webp --texture-size 4096`
   then try KTX2: `npx @gltf-transform/cli uastc|etc1s …` (needs KTX-Software; if `ktx`/`toktx` is not installable, stay on WebP and say so).
   Targets: proxy ≤ 400 KB, main ≤ 4 MB, optional 8k albedo as separate lazy texture ≤ 6 MB.
3. Loading order at runtime: proxy (instant) → `relief.opt.glb` swap with a 600 ms cross-fade → 8k albedo only on desktop
   with `devicePixelRatio ≥ 1.5` and after idle. `<link rel="preload" as="fetch" crossorigin>` for the proxy in `map.php`.
4. Postcard: same optimize pass (`postcard.opt.glb`, ≤ 200 KB). Add a slight bend and a back side texture if a scan exists (ask Grayson; otherwise plain aged paper).
5. Glyphs stay as WP featured images (editors keep their workflow). The shader derives alpha from luminance, so no conversion.

### 3.2 Renderer & look
- Upgrade `three` to current stable and pin the exact version; fix the breaking changes (`outputColorSpace`, `SRGBColorSpace`
  on colour textures, light intensity units, `TWEEN` no longer bundled → use `gsap`).
- `antialias: false`, DPR capped at `min(devicePixelRatio, 2)`, `outputColorSpace = SRGBColorSpace`,
  `toneMapping = AgXToneMapping` (fallback ACES), exposure ~1.0 tuned by eye.
- Background `--ink`; `scene.fog = FogExp2(ink, …)` so the far edge of the relief falls into the room.
- **Lighting = the design.**
  - Key: a `SpotLight` "inspection lamp", warm white (≈4300 K), low elevation (15–25°) so pulp clumps and creases throw long
    soft shadows. Its target eases toward the pointer's hit point on the relief (lerp 0.06), so the visitor is literally
    holding the lamp. Shadow map 2048, `PCFSoftShadowMap`, radius 4, bias tuned; update only when the lamp moved.
  - Fill: very dim cool `HemisphereLight` (≈0.08) so shadows stay blue-black, not dead.
  - Rim: faint cool directional from behind for the paper edge.
  - Idle (no pointer for 6 s, or touch device): the lamp wanders on a slow Lissajous path.
- Post (use the `postprocessing` npm library, single `EffectPass`): subtle bloom on the red traces only (luminance threshold
  high, or selective via layers), vignette, 35 mm-style noise, and a light **tilt-shift/DoF** focused on the pointer hit depth
  to sell "macro photo of a small physical object". SMAA last. Phone: no post at all.
- Render loop: one `requestAnimationFrame` loop with an `invalidate()` dirty flag + "animating until t" timestamp; pause entirely
  on `visibilitychange`. Delete every scattered `render()` call.

### 3.3 Camera
Replace OrbitControls with `camera-controls` (npm): drag = truck/pan, wheel/pinch = dolly-to-cursor, right-drag or `Shift`+drag
= tilt/rotate within limits (polar 20°–75°, azimuth ±60°), damping, a boundary box matching the relief, min/max distance.
Named shots, all driven by `setLookAt(..., true)`: `threshold`, `overview`, `glyph(id)` (offset so the glyph sits centred in the
viewport area not covered by the panel — use `setFocalOffset` or `setViewOffset`), `about` (two-leg move around the edge to the back).
Remove the `scene.rotation.y = 10°` hack; put orientation in the camera.

### 3.4 Glyph traces
Custom `ShaderMaterial` on a plane per entry (keep `acf.position/rotation`, keep aspect from image, keep base scale 1.8):
- alpha = `smoothstep` on texture luminance; colour `--trace`; additive-ish blending, `depthWrite: false`, slight `polygonOffset`.
- **Idle**: visible at ~22 % with a slow per-glyph breathing offset — discoverable, like chalk marks on the exhibit.
- **Hover**: "inks in" — a noise-thresholded wipe (uniform `uReveal` 0→1, 450 ms) to 100 %, scale 1.0→1.06, bloom picks it up.
- **Active**: stays at 100 %; others drop to 8 %.
- **Read** (id in localStorage): idle colour becomes `--paper` at 18 % instead of red, so progress is legible on the map itself.
- Hit testing: a separate invisible, slightly larger plane per glyph in a dedicated raycast list; raycast against the relief
  too so glyphs behind it can't be hit (replaces the divider). Throttle pointer raycasts to one per frame.
- Click vs drag: record pointerdown position; treat as click only if moved < 5 px and < 400 ms (replaces the `moved` timeout).
- Lay glyphs along the surface: optional helper that samples the relief normal at the ACF position and tilts the plane to it
  when `rotation` is 0/0/0.

### 3.5 Editor helper (small, high value)
`?place=1` shows a crosshair; clicking the relief prints/copies `x, y, z` (z = hit + 0.05) and the surface-aligned rotation in
ACF format, so editors can position new entries without guessing.

### 3.6 Entry media
Bodies are injected with `innerHTML` after sanitising in JS: strip `<script>`, inline `style` attributes, and `font-weight`
spans; rewrite `<img>` with `loading="lazy" decoding="async"`; unwrap ARVE divs to a bare `<video>`.
Replace native audio controls with a minimal custom player (mono time readout, 1 px scrubber, play chip `Play [Space]`) —
several entries are *only* an audio piece ("stimme", "gespräch"), so this player is a first-class object: large, at the top of the body.
Pause all media on close/navigation (already done today — keep).

---

## 4. Architecture

### 4.1 Repo layout (target)
```
theme/                    # the WP theme, now versioned (copied from the Local site in Phase 0)
  map.php  functions.php  style.css (header only + reset)  fonts/  single.php …
src/
  main.js                 # boot, wiring only
  config.js               # reads window.AKG {themeUrl, restUrl, lang}; no hard-coded hosts
  data.js                 # fetch + normalise entries, parse author → {type, credits[]}, language availability
  state.js                # tiny store: view, activeId, lang, read[], reducedMotion (subscribe/emit)
  router.js               # hash routes: #/ , #/map , #/e/<slug> , #/index , #/about ; ?lang=
  i18n.js                 # UI strings de/en/ar
  three/ stage.js  relief.js  lamp.js  glyphs.js  postcard.js  camera.js  post.js  loop.js
  ui/ threshold.js  chrome.js  entry-panel.js  index-view.js  about.js  cursor.js  player.js  sanitize.js
  styles/ tokens.css  base.css  chips.css  panel.css  entry.css  index.css  threshold.css  rtl.css
tools/assets/             # Blender + gltf-transform scripts
tools/deploy.sh           # build → rsync dist assets + theme/ into the Local theme dir
tools/shot.mjs            # headless screenshot helper (start from docs/redesign/tools/shot.mjs)
```
Stay **vanilla JS + Vite**. No React/Astro. Dependencies to add: `three` (current), `camera-controls`, `postprocessing`, `gsap`.
Remove `stats.js`/`lil-gui` from production (dynamic-import behind `?debug=1`).

### 4.2 WordPress side
- `functions.php`: fix `<?` → `<?php`; fix the shortcode closing tags; enqueue the built JS/CSS with `filemtime` versions;
  print `window.AKG = { themeUrl, restUrl, homeUrl }` inline before the bundle.
- Add a lean endpoint `GET /wp-json/akg/v1/glossary` returning only: `id, slug, title, author, position, rotation, glyph {url,w,h},
  langs {de,en,ar: bool}, related [ids], isPostcard`. Bodies come from `GET /wp-json/akg/v1/entry/<id>?lang=` on demand.
  (Today's single call is 1.9 MB.) Cache both in a transient, bust on `save_post`. Send relative URLs or `home_url()`-based ones.
- `map.php`: becomes a thin shell — `<canvas>`, `#ui` root, a `<noscript>` + crawlable `<nav>` listing all entries as links,
  proper `<title>`, description, OG tags, `lang` attribute, font preloads, model preload. Remove es-module-shims and the import map (dead).
- `single.php`: render a readable, styled, no-JS version of an entry (title, credits, three language blocks) with a link
  "Open in the map" → `/#/e/<slug>`. Gives shareable URLs and SEO for free.
- Move the long collective statement out of `map.php` into post 550 / an "About" page's ACF fields (three languages).
- Do not rename ACF fields, the category (id 2), or the featured-image convention.

### 4.3 Build/deploy
`vite.config.js`: `base: './'`, stable filenames (`assets/index.js`, `assets/index.css`) as today, `build.assetsInlineLimit: 0`.
`tools/deploy.sh` rsyncs `dist/assets`, `dist/map-assets`, and `theme/` to
`~/Local Sites/al-khatib/app/public/wp-content/themes/blankslate/` (never `--delete` on `map-assets`; never touch `wp-content/uploads`).
`npm run dev` works against the Local WP API through a Vite proxy for `/wp-json` and `/wp-content` → `http://al-khatib.local`.

---

## 5. Constraints and guard-rails for the implementer
1. Don't modify the database content, ACF field names, or uploads. Schema additions go through `functions.php` only.
2. Don't move/rescale/re-orient the relief model. Assert bounds after every asset export.
3. Keep the source GLBs; write new files beside them. GLBs stay git-ignored — add the generated ones to `.gitignore` too
   and document regeneration in `readme.md`.
4. Production host is `al-khatib-glossar.com`; nothing in the bundle may hard-code any host.
5. Arabic is a first-class language: test every screen in `?lang=ar`.
6. Every phase: `npm run build` clean, deploy to Local, capture screenshots with `tools/shot.mjs` at 1440×900 and 390×844 into
   `docs/redesign/progress/phase-N-*.png`, check the browser console is error-free, commit.
7. The tone is sober. No playful copy, no emoji (remove the 🔗), no bouncy easing, no confetti-style effects.
8. Trial fonts from the reference site must not be used or downloaded.
9. Git: work on branch `redesign`; one commit per phase minimum; never commit `*.glb`, `node_modules/`, `dist/`, database dumps,
   or anything under `docs/redesign/backups/`. Commit messages describe the phase (`phase 2: renderer core`).
10. Do not delete user files. Archive them. Do not run `rsync --delete` against the Local theme or `wp-content/uploads`.
11. No new third-party scripts, trackers or analytics. No Google Fonts requests at runtime (self-host everything).
12. Preserve the existing ACF field names and the category id `2`; preserve the glossary slugs (they are used in deep links).
13. If a decision in this plan conflicts with what the code or the content actually shows, stop, write the conflict into
    `docs/redesign/decisions.md`, and pick the option that is easiest to reverse. Then continue.
14. Keep the existing glossary reachable at every phase boundary (the site must never be left broken on the Local site).

---

## 6. Phases

### Phase 0 — Foundation (no visual change)
- **Before any change:** (a) `wp db export` of the Local database to `docs/redesign/backups/` (keep out of git if large);
  (b) tar the Local theme directory to the same folder; (c) create git branch `redesign` off `main`. Nothing is merged to `main`
  until Grayson approves.
- Copy the Local theme into `theme/`; commit. **Do not delete** stale files. Move them to `archive/` after confirming they are
  unused by grepping the repo and the theme: `index.html` lorem copy → replace with a dev shell mirroring `map.php`;
  `glyphdata_archive.js`, `glyphs_jpg backup/`, `landing-*.png/jpg` duplicates, `._.DS_Store` (macOS metadata; also add `._*` to `.gitignore`).
- Record the current deployed behaviour as a baseline: screenshots of the old site at 1440×900 and 390×844 into
  `docs/redesign/progress/phase-0-baseline-*.png`, and a console log of a cold load.
- Reproduce and fix the postcard crash (1.6); confirm 35 glyphs get created (log count).
- `config.js` + `window.AKG`; remove hard-coded hosts; Vite proxy; `tools/deploy.sh`; move `tools/shot.mjs` and make it take
  a route + viewport + list of actions.
- Fix `functions.php` tag and shortcode bugs.
**Done when:** `npm run dev` and the deployed Local site both show the old site working, glyphs appear on hover, zero console errors.

### Phase 1 — Asset pipeline
Section 3.1. Produce proxy + optimised relief + postcard. Write `docs/redesign/assets-report.md` with before/after sizes,
triangle counts, texture memory estimate, and side-by-side renders (Blender, same camera) of source vs. rebake at overview and close-up.
**Done when:** main model ≤ 4 MB, proxy ≤ 400 KB, bounds identical, close-up render shows handwriting still legible.
If the rebake visibly loses the pencil writing at 4k, ship the 8k albedo as the desktop default and note it.

### Phase 2 — Renderer core
Split `main.js` into `src/three/*`; three upgrade; loop with `invalidate()`; `camera-controls` with bounds and named shots;
colour management + tone mapping; lamp lighting with pointer follow; fog; proxy→full swap; solidified back replaces divider.
No post-processing yet. Old DOM overlay still works.
**Done when:** raking light visibly models the relief (compare with `local-map.png`), 60 fps on desktop at DPR 2, model swap has no pop.

### Phase 3 — Design system + chrome
Tokens, self-hosted fonts, reset, chips, panel, grain, custom cursor, `i18n.js`, `state.js`, `router.js`.
Build persistent chrome (wordmark, Index/About chips, language chips, hint line, read counter). Remove all old CSS and inline `fadeIn/fadeOut`.
**Done when:** chrome renders correctly in de/en/ar, keyboard shortcuts work, focus rings visible, no layout shift on font load.

### Phase 4 — Glyph traces
Section 3.4 complete: shader, idle/hover/active/read states, hit planes, click-vs-drag, label chip, staggered intro.
**Done when:** all 35 traces are findable at overview zoom without hovering; hover feels instant; drag never opens an entry.

### Phase 5 — Entry panel
Section 2.4 C + 3.6: lean REST endpoints, sanitiser, panel layout, language handling with fallback note, contributors parsing,
related entries with map pulse, prev/next, reading progress, expand mode, custom audio player, video styling, camera fly-to with
viewport offset, deep links `#/e/<slug>` (including percent-encoded slugs such as `qi%ca%87…`).
Test entries: 224 (48k chars), 220 (audio only), 251 (video), 247 (gif), 31 (Arabic only), 172 (all three languages), 233 (de+ar).
**Done when:** each test entry reads beautifully at 1440 and 1920 wide, direct-loading a deep link lands on the opened entry, Esc/back button close it.

### Phase 6 — Threshold
Section 2.4 A: SVG self-drawing (prefer `landing-simplified.svg`; compute path lengths in JS), title, loading hairline, Enter
transition into the map, return via wordmark. Skip automatically for deep links.
**Done when:** first meaningful paint < 1.5 s on a cold local load; Enter works before the hi-res model has arrived.

### Phase 7 — Index + About
Section 2.4 D and E, including type/language filters, lamp-follows-hover, the behind-the-relief camera move to the postcard,
and moving the statement text into WP.
**Done when:** the whole glossary is usable with keyboard only via Index; About text matches the current `map.php` copy in all three languages.

### Phase 8 — Post-processing + polish
`postprocessing` pass (selective bloom, vignette, noise, tilt-shift, SMAA), quality tiers (high / low / phone) chosen by a 1 s
frame-time probe, reduced-motion paths, `single.php` no-JS entry pages, meta/OG tags + an OG image rendered from the new scene,
remove the mobile wall, bottom sheet on phones, touch gestures.
**Done when:** Lighthouse performance ≥ 80 desktop, phone (390×844 emulation) is fully usable, total transfer on first load ≤ 2.5 MB before the hi-res swap.

### Phase 9 — Optional
- Sound: `Sound [M]` chip, off by default, a very quiet room tone + soft paper tick on hover. Needs audio from Grayson — ask, don't invent.
- `?place=1` editor helper (3.5) if not already done.
- "Constellation" lines: on entry open, draw faint red lines across the relief to its related entries.
- Guided path: `Space` at overview steps through unread entries in alphabetical order.

---

## 7. Open questions for Grayson (don't block; use the stated default)
1. Is the Favorit web licence still valid for the production domain? *Default: keep Favorit; fallback display face is Newsreader at display optical size.*
2. Is there a scan of the postcard's back? *Default: plain aged-paper back.*
3. Should UI strings exist in all three languages or German/English only with Arabic content? *Default: all three.*
4. Is sound wanted at all? *Default: skip Phase 9 sound.*
5. Are per-entry English translations coming? *Default: design assumes most entries are German-only and shows availability honestly.*
6. Which production deploy path is used (see §1, "Local vs production")? *Default: none attempted; deliver a `dist/` + theme bundle and a deploy checklist.*
7. Is the `glyphs_jpg backup/` folder and `glyphdata_archive.js` needed for any reason? *Default: archive, do not delete.*
8. Are the three-language UI strings provided by Grayson, or should the implementer translate them? *Default: implementer drafts DE/EN/AR, Grayson approves before Phase 3 is marked done.*

---

## 8. Edge cases the implementer must handle

| Case | Where it occurs | Required behaviour |
|---|---|---|
| Post 550 (About) appears in the same list as glyphs | REST response | Never create a glyph from it. Route it to the About data. Use `acf.is_postcard` and id 550, and fail loudly in dev if the two disagree. |
| Glyph with no featured image | any future entry | Skip it on the map, log a warning in dev, still list it in Index with a text-only mark. |
| `related` is `false` (not an array) | e.g. 1 entry (`welten`) | Treat `false` as empty. Never call `.map` on it without a check. |
| `author` empty | e.g. `abteilung` (241) has an empty author | Show no credits block; never render `undefined`. |
| `author` has unparsable formats | `gif: raguel`, `stimme: carsten`, `idee: miriam` | Parse `label: names` by the first colon only. If no colon, show the raw string. Keep the raw string available for editors. |
| Language field empty or only whitespace | most entries have no English | Use the length check that already exists (`< 2`), but trim first. |
| Arabic-only entry | `zellen` (31) | Default the panel to Arabic for that entry only, with the RTL layout, and show the availability note. |
| Mixed-direction text | German with Arabic words; Arabic with Latin names | Use `dir="auto"` on text blocks; keep `dir="rtl"` on Arabic bodies. |
| Percent-encoded slugs | `qi%ca%87%c9%90%c9%a5%ca%9e-l%c9%90` (title `qıʇɐɥʞ lɐ`) | Route on the numeric id as the canonical key; use the slug only for display of the URL and for lookup. Test both. |
| Body HTML with `<script type="application/ld+json">` | many entries (ARVE output) | Strip scripts entirely. Never execute body content. |
| Body HTML with inline styles and `font-weight` spans | many German bodies | Strip inline styles; keep semantic tags (`em`, `i`, `b`, `sup`, `br`, `p`, `ol`, `ul`, `li`, `hr`, `img`, `a`). |
| Links inside bodies (`<a href>`) | present in several bodies (check in Phase 5) | Open external links in a new tab with `rel="noopener noreferrer"`. Internal `al-khatib.local` / production links must be rewritten to the current origin. |
| Media URLs with `al-khatib.local` in content | everywhere | Rewrite to the current origin (see §1). Do this in one function, `sanitize.js`, not in several places. |
| Very long body (48 k chars, entry 224) | Phase 5 test | Virtualise nothing, but lazy-load images and audio; check scroll performance and reading progress. |
| Audio-only entry | `stimme`, `gespräch` entries | Put the player at the top; the body text may be empty. Do not show an empty text column. |
| Video from ARVE | entry 251 | Native `<video controls>` with `preload="metadata"`, poster if available. No YouTube iframe assumptions. |
| Animated GIF | entry 247 | Show as `<img>` with `loading="lazy"`; it will loop. Do not auto-play large media off-screen. |
| Position/rotation strings | all entries | Parse with `parseFloat`; reject `NaN` by falling back to the nearest unused slot and logging it. Accept `.4` and `4.0`. |
| Two glyphs overlapping on screen | likely at overview zoom; check in Phase 4 | Hit testing must prefer the one nearest the camera. Hover label must show the top one only. |
| No WebGL | old devices, some privacy modes | Fall back to Index + text (see §9). Never show a blank page. |
| WebGL context lost | mobile Safari, long sessions | Listen for `webglcontextlost`/`restored`; on loss show a short message and reload the scene, do not crash. |
| Reduced motion | OS setting | No camera fly; cross-fade 200 ms; no parallax; no grain animation. |
| Slow network | 18 MB model on 3G | Proxy first; never block the Threshold on the full model. |
| `localStorage` unavailable | private browsing | Wrap every access in try/catch; "read" state then lasts only the session. |
| JavaScript disabled | crawlers, no-JS | `map.php` contains a crawlable list of all entries linking to `single.php` pages (§4.2). |
| Deep link to a non-existent entry | `#/e/does-not-exist` | Show Index with a one-line note; never a blank panel. |
| Deep link to About | `#/about` | Open the About view directly, with the postcard already in place. |

---

## 9. Fallbacks and degradation

1. **No WebGL:** the site renders the Threshold text, the Index and the entry pages. The map is replaced by a static
   poster image of the relief (produce `relief-poster.jpg` in Phase 1). Show one mono line: `3D view needs WebGL`.
2. **Hi-res model fails to load:** keep the proxy and show a mono line `Full model unavailable — low-resolution view`.
3. **REST endpoint fails:** show a clear error in the panel with a retry chip. Keep the Threshold and the map proxy working
   if the glossary request fails, since the glyph list is needed for the map but the relief is not.
4. **Fonts fail to load:** system serif/sans stack with the same metrics where possible; no layout jump (set `size-adjust`).
5. **Old browsers:** target current Chrome, Firefox, Safari, Edge (last two versions). No IE. Import maps are not needed
   after the Vite build, so remove them.

---

## 10. QA and acceptance

There is no automated test suite in the repo today. Add the following in Phase 2 and extend it each phase.

### 10.1 Automated (cheap, run on every build)
- `npm run build` must pass with no warnings in `vite build`.
- A Node script `tools/check-data.mjs` that fetches the lean REST endpoint and fails if: any glyph lacks an image, any
  `position` is `NaN`, the About post is missing, or any `related` id does not exist in the list.
- A Node script `tools/check-assets.mjs` that reads each GLB header and fails if the bounding box differs from the
  source by more than 1e-4 (§3.1).
- Bundle size budget: `dist/assets/index.js` gzipped ≤ 250 KB (tune after Phase 2; record the actual value).

### 10.2 Headless browser smoke test (run before marking each phase done)
Use `tools/shot.mjs` (or Playwright, if added). For each route at 1440×900 and 390×844:
- `#/` Threshold renders, Enter reaches the map within 3 s (proxy) on a warm cache.
- Map: at least 30 of 35 traces are visible at the overview camera; hover on one trace shows its label chip.
- Click a trace → panel opens with the right title; Esc closes; URL updates to `#/e/<slug>`.
- Deep link `#/e/<slug>` for entries 224, 220, 251, 247, 31, 172, 233 opens the right entry.
- Index: 35 rows, filters work, keyboard `Tab` reaches every row.
- About: postcard visible; statement present in DE, EN, AR.
- Console has zero errors and zero warnings from the app code (third-party warnings must be listed in `docs/redesign/decisions.md`).

### 10.3 Visual review (manual, by Grayson)
- Side-by-side comparison with `docs/redesign/reference/` screenshots after each of Phases 3, 5, 6, 8.
- Arabic screens reviewed by a native reader if one is available; otherwise say so in the phase report.
- Contrast: body text ≥ 7:1 against `--ink` (`--paper` on `--ink` is expected to pass; verify with a tool and record the value).

### 10.4 Accessibility checklist
- Every interactive element reachable by keyboard; visible focus ring (`--prussian` 2 px outline plus offset).
- Chips have text labels, not icons alone. Keyboard shortcuts are shown and also available as buttons.
- The map itself is decorative for screen readers; Index provides the full content. Add an `aria-live` region for panel changes.
- `lang` attribute updates on language switch; `dir` updates on the panel.
- No information conveyed by colour alone: read traces must differ in shape/opacity as well as colour.

---

## 11. Performance budgets

| Asset | Budget | Notes |
|---|---|---|
| First paint (warm cache) | < 1.5 s | Measured on the Local site, desktop |
| Proxy relief | ≤ 400 KB | Phase 1 |
| Main relief (optimised) | ≤ 4 MB | Phase 1 |
| 8 K albedo (optional, desktop) | ≤ 6 MB, lazy | Phase 1 |
| Glossary list JSON | ≤ 60 KB | Lean endpoint, §4.2 |
| Entry body | ≤ 150 KB typical, 48 k chars max | Images lazy |
| Total first load before hi-res swap | ≤ 2.5 MB | Phase 8 |
| Frame rate | ≥ 60 fps desktop DPR 2; ≥ 30 fps phone | Quality tiers, §3.2 |

---

## 12. Risks

1. **Relief rebake loses the handwriting.** Mitigation: 8 K albedo desktop default; keep the source GLB as fallback.
2. **Normal map looks fake.** Mitigation: gate in Phase 1; ship without it.
3. **Favorit licence does not cover the production domain.** Mitigation: Newsreader fallback, decided by Grayson.
4. **Three.js upgrade breaks the look.** Mitigation: change one thing at a time; keep the old `assets/index.js` as `index.legacy.js` until Phase 3 is accepted.
5. **Local content differs from production.** Mitigation: Phase 0 baseline and the search-replace note in §1.
6. **Scope creep (sound, constellation lines, guided path).** Mitigation: Phase 9 is optional and must not start before Phase 8 is accepted.
7. **Arabic layout bugs.** Mitigation: test every screen in `?lang=ar`; logical properties; native review if possible.
8. **Performance on phones.** Mitigation: proxy-only mode; no post-processing on phone; measured budgets (§11).

---

## 13. Rollback

- Every phase ends with a git commit on `redesign`. Rolling back is `git revert` of that phase.
- `assets/index.legacy.js` and the original `style.css` from the Local theme remain in `theme/archive/` until Phase 8 is accepted.
- The database backup from Phase 0 restores the content if a content change goes wrong.
- Production is untouched by this project. Any production change is a separate, explicit decision.

---

## 14. Definition of done (whole project)

1. All phases 0–8 meet their "Done when" line, and §10.2 passes on the final build.
2. The relief is lit by a raking lamp and visibly shows the paper texture; the 35 traces are findable without hovering.
3. Every entry opens, reads and closes in DE, EN (where it exists) and AR (where it exists), with the availability note where it does not.
4. The About view shows the postcard and the three-language statement.
5. The site works without WebGL (Index + entries) and without JavaScript (crawlable list + `single.php`).
6. `docs/redesign/` contains: `decisions.md`, `deploy-notes.md`, `assets-report.md`, `progress/` screenshots for every phase, and a short `handover.md` describing how to rebuild and deploy.
7. No file has been deleted; old files are in `archive/`.
8. The repo `readme.md` is updated with the new build, asset regeneration and deploy steps.
