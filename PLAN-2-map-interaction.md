# Al-Khatib-Glossar — Plan 2: glyph crowding, navigation, click-to-centre, menu clicks

Handoff for the implementing model. Branch: `redesign`. Scope is four reported problems:

1. Glyphs are scrunched together and unreadable.
2. The map is hard to rotate and navigate.
3. Clicking a glyph zooms but does not centre on it.
4. The top-right menu is sometimes unclickable.

All four have identified causes in the current code (§1). Fix them in the order of §6; A must come first because
B, C and D depend on it. `PLAN.md` still governs design language, guard-rails (§5 there) and tone. Do not change ACF data,
the relief model, or the REST endpoints.

Files involved: `src/three/camera.js`, `src/three/glyphs.js`, `src/main.js`, `src/three/lamp.js`, `src/ui/chrome.js`,
`src/ui/entry-panel.js`, `src/styles/base.css`, `src/styles/chips.css`, `src/i18n.js`, plus new `src/three/view-offset.js`,
`src/ui/nav-controls.js`, `tests/camera.test.js`, `tools/test-interaction.mjs`.

---

## 1. Diagnosis (verified by reading the code and measuring the live data)

### 1.1 The camera's up-axis is wrong — root cause of problems 2 and 3
The relief lies in the **XY plane and faces +Z** (ACF positions are x,y ∈ ±5, z is height off the surface).
`camera-controls` assumes **Y-up** unless `camera.up` is changed before the controls are constructed. `camera.js` never sets it.
Consequences:
- "Polar angle" is measured from +Y and "azimuth" turns around Y. So the limits `polar 20°–75°`, `azimuth ±60°` do not mean
  "tilt" and "turn" relative to the map; they describe a different sphere.
- Every named shot places the camera at negative Y (e.g. `overview`: `(0.3, −4.5, 5.5)`), which is polar ≈ 129° in the
  controls' frame. That is outside the 75° limit, so the library **clamps the pose**. The camera never arrives where the shot asks.
  This is why a glyph click "just zooms": the distance changes but the direction is overridden.
- Right-drag rotation orbits around the wrong axis, so the map rolls and swings instead of turning like a table.
- Left-drag `TRUCK` moves in the screen plane, not along the paper, so panning while tilted slides the target off the surface until the boundary box stops it.

### 1.2 Glyph click target is deliberately off-centre
`shots.glyph` adds `panelOffset = ±1.4` world units to the look-at target to make room for the panel. That is a fixed world
offset regardless of zoom, viewport or panel width, so the glyph lands in a different place every time. Combined with 1.1
and `setBoundary`, it is never centred.

### 1.3 Glyphs are 1.5–2.5× larger than on the original site — root cause of problem 1
Original (`main.js` in `archive/` / git history): the **longest side** of each glyph was normalised to 1, then scaled 1.8.
Current `glyphs.js`: `height = 1.8; width = 1.8 * aspect`. Most glyph images are landscape (aspect 1.5–2.5), so they are now up to 4.4 units wide on a 10-unit map.

Measured against the live data (35 glyphs, bounding rectangles, map area ≈ 100 units²):

| Sizing | Total glyph area | Overlapping pairs | Overlap area | X extent |
|---|---|---|---|---|
| Current (height 1.8) | 178.6 | 93 | 100.0 | −6.35 … 6.41 (spills off the map) |
| Original (longest side 1.8) | 73.5 | 37 | 6.7 | −5.03 … 5.40 |
| Longest side 1.5 | 51.0 | 15 | 1.0 | −4.91 … 5.25 |
| Longest side 1.2 | 32.6 | 2 | 0.0 | −4.83 … 5.10 |

Nearest-neighbour distance between glyph centres: min 1.0, median 1.32, max 1.83.

Three more things make it worse:
- The old site hid glyphs until hover (`opacity: 0`), so overlap never showed. Now all 35 are visible at once.
- **Additive blending** (`blendDst: OneFactor`) makes every overlap brighter, turning crowded areas into a red mass.
- `surfaceAlign()` tilts each un-rotated glyph to the normal of **one triangle** of a bumpy photogrammetry mesh. That gives
  near-random tilts, so planes cross each other and foreshorten differently. 16 of 35 glyphs have no ACF rotation and get this treatment.

*Probable, verify in A4:* the glyph drawings are tracings of pencil drawings that are physically on the relief (visible in
`docs/redesign/reference/local-map.png`). At the original size they should register with those drawings. If they do, the original size is not a taste question but the correct one.

### 1.4 The menu is covered and the canvas steals its clicks — root cause of problem 4
- `#chrome-layer` has no CSS and no `z-index`. Its children are `position: absolute` with `z-index: auto`. The entry panel and
  About panel are `z-index: 50`, 46vw wide, full height, anchored to the same (inline-end) side; the Index overlay is `z-index: 55`, full screen.
  Whenever an entry, About or Index is open, the top-right chips are **underneath** it. That is the "at times".
- `main.js` binds `pointermove / pointerdown / pointerup` on **`window`** and never checks the event target. A click on a chip
  also runs `handleClick`, which raycasts the scene under the chip and may navigate to an entry or to About an instant
  before the chip's own click handler runs. Hover raycasts also run under the UI, so glyphs light up beneath the menu.

---

## 2. Part A — Glyphs: size, legibility, picking

### A1. Restore the original size rule
In `createGlyphMesh`: `const S = GLYPH_SIZE; const width = aspect >= 1 ? S : S * aspect; const height = aspect >= 1 ? S / aspect : S;`
with `GLYPH_SIZE = 1.8` (exported constant). Hit plane: same size ×1.0 (not 1.3).

### A2. Lay glyphs flat on the map plane
Delete the normal-based tilt in `surfaceAlign`. Rotation comes **only** from ACF (`rotation.x/y/z` in degrees), as on the original site.
Keep the height fix but make it robust: sample the relief height at the glyph centre and four corner points (5 down-rays against the
proxy), and set `z = max(acf.z, maxSampledHeight + 0.03)`. Run it once after the proxy loads and once after the full model loads (already wired through `alignToRelief`).

### A3. Stop overlaps from blowing out
- Switch from additive to normal alpha blending (`THREE.NormalBlending`, `transparent: true`, `depthWrite: false`, keep `polygonOffset`).
  Give each glyph a stable `renderOrder` (by id) so overlaps do not flicker.
- Thin the stroke at rest: in the fragment shader use a tighter `smoothstep(0.25, 0.6, lum)` for idle and the current wide one for
  hover/active (mix by a new uniform `uWeight`, 0 → 1).

### A4. Lamp-proximity reveal (the main declutter, and it fits the "inspection lamp" idea)
Glyphs are faint everywhere and become clear only near where the visitor is pointing.
- New shared uniforms `uLampPos` (vec3, world) and `uLampRadius` (float, default 2.2). Pass world position to the fragment shader as a varying.
- `proximity = 1 − smoothstep(uLampRadius * 0.35, uLampRadius, distance(worldPos.xy, uLampPos.xy))`.
- Idle alpha = `mix(0.10, 0.55, proximity)`; read glyphs `mix(0.08, 0.40, proximity)` in paper colour. Hover and active stay at 1.0.
- Feed `uLampPos` from the lamp's eased hit point (`lamp.targetObj.position`) every frame the lamp moves.
- Touch devices and the lamp's idle drift use the same uniform, so the reveal wanders on its own when nobody is pointing.
- Remove the breathing oscillation or cut `uBreathAmp` to 0.015; with the reveal it is noise.

### A5. Zoom-dependent weight
Compute `zoomT = clamp((maxDistance − distance) / (maxDistance − minDistance), 0, 1)` each frame from `controls.distance` and
multiply idle alpha by `mix(0.7, 1.3, zoomT)`. Far away = quieter field; close = full drawings.

### A6. Pick by ink, not by rectangle
Rectangles still overlap in 37 pairs at the original size, so hover must choose the glyph whose **drawing** is under the cursor.
- When each glyph texture loads, draw it into a 96-px-wide offscreen canvas, read the pixels, store a `Uint8Array` luminance mask,
  and dilate it by 3 px (so thin lines are easy to hit).
- `testHit`: collect *all* hit planes under the ray that pass the relief-occlusion check; for each, read the mask at the hit `uv`.
  Return the nearest one whose mask is set. If none has ink under the cursor, return the one whose centre is closest to the hit point
  **only if** the cursor is within 35 % of its half-size; otherwise return `null` (so empty paper is draggable and not "hovering").
- Suppress hover entirely while a drag is in progress (`controls` `controlstart` → `controlend`).

### A7. Registration check (decides whether 1.8 stays)
Add a debug flag `?debug=register`: top-down orthographic-like view (polar 0, distance fitted to the map), glyphs at alpha 1, lamp
replaced by flat ambient 1.0. Capture `docs/redesign/progress/plan2-register.png`. If the red tracings sit on the pencil drawings,
keep 1.8. If they are clearly unrelated to anything on the surface, set `GLYPH_SIZE = 1.5` and note it in `docs/redesign/decisions.md`.

**Done when:** at overview no glyph extends past the relief edge; individual titles are readable in the area around the cursor;
moving the pointer across a crowded region changes the hovered glyph in a way that follows the drawing under the cursor;
`tests/glyphs.test.js` asserts the size rule for aspect 0.54, 1.0 and 2.4.

---

## 3. Part B — Navigation

### B1. Fix the frame (do this before anything else in B and C)
In `createCameraControls`, **before** `new CameraControls(...)`: `camera.up.set(0, 0, 1);` After construction call
`controls.updateCameraUp()`. From then on, in this project:
- **polar** = tilt away from straight-down (0° = looking straight down at the paper, 90° = edge-on);
- **azimuth** = turning the map like a table; 0° = camera on the −Y side looking toward +Y (text upright).

New limits for the front of the map: polar `0°–68°`, azimuth `−100°…+100°`, distance `1.6–15`.
Re-derive every named shot in spherical terms and set them with `controls.rotateTo(az, polar)`, `controls.moveTo(x, y, z)`,
`controls.dollyTo(d)` (all with the transition flag) instead of raw `setLookAt` positions:

| Shot | Target | Azimuth | Polar | Distance |
|---|---|---|---|---|
| `threshold` | (0, 0, 0) | 0° | 12° | 13 |
| `overview` | (0, 0, 0.2) | 0° | 32° | fitted so the 10×10 map fills ~85 % of the free viewport height |
| `glyph(id)` | see Part C | keep current | 28° | fitted, see Part C |
| `about` | (0, 0, −0.3) | 180° | 150° (lift limits first, as now) | 5 |

Verify each by logging `controls.azimuthAngle`, `controls.polarAngle`, `controls.distance` after the transition ends and comparing
with the requested values. If any differ, a limit or the boundary is still clamping; fix that rather than adjusting the numbers.

### B2. Input mapping (familiar from map applications)
| Input | Action |
|---|---|
| Left drag | Pan along the paper. `mouseButtons.left = ACTION.TRUCK`, `controls.verticalDragToForward = true`, tune `truckSpeed` so the point under the cursor stays roughly under it |
| Right drag, or `Alt`/`Shift`/`Ctrl` + left drag | Turn and tilt (`ACTION.ROTATE`) |
| Wheel / trackpad pinch | Zoom toward the cursor: `controls.dollyToCursor = true`, `dollySpeed` ≈ 0.6 |
| Double-click on the paper | Zoom in one step toward that point (distance × 0.55, target moves to the hit point) |
| Touch: one finger | Pan (`TOUCH_TRUCK`) |
| Touch: two fingers | Pinch zoom + twist/tilt (`TOUCH_DOLLY_ROTATE`) |
| Touch: three fingers | Pan (`TOUCH_TRUCK`) |
| Arrow keys | Pan; `Shift` + arrows = turn / tilt |
| `+` / `−` | Zoom |
| `Q` / `E` | Turn 30° left / right |
| `R` or `0` | Reset to `overview` |

Use the action constants that exist in the installed `camera-controls` 2.10 (`TOUCH_TRUCK`, `TOUCH_DOLLY_ROTATE`, … confirmed in its
type definitions). Prevent the browser context menu on the canvas. Ignore keyboard shortcuts when focus is in a form field or when a panel has focus and the key is a text-scrolling key.

Feel: `draggingSmoothTime = 0.08`, `smoothTime = 0.45`, `restThreshold = 0.005`. Boundary: `setBoundary(Box3((−5.2, −5.2, 0), (5.2, 5.2, 0.6)))`
so the **target** always stays on the paper; `boundaryEnclosesCamera = false`. The `about` shot must lift the boundary's z-min together with the angle limits, and restore both afterwards.

### B3. Visible controls (rotation must be discoverable without a manual)
New `src/ui/nav-controls.js`: a vertical cluster of chips at bottom-right, above the read counter, using the existing `.akg-chip` style:
`+`, `−`, `⟲` (turn left 30°), `⟳` (turn right 30°), `Tilt` (cycles polar 0° → 32° → 60°), `Reset [R]`.
Plus a mode toggle `Move | Turn` that swaps what left-drag does (for trackpad and one-button users); holding `Space` switches temporarily.
Each chip has an `aria-label` and a `title` with the shortcut. Hide the cluster on the threshold and when the Index is open.
A small compass tick (a 1 px line in a 24 px ring) rotates with azimuth; clicking it returns azimuth to 0.

### B4. Cursor and hint
- Canvas cursor states via the existing custom cursor: `grab` ring at rest, `grabbing` (ring filled) while dragging, rotate glyph while turning.
- Replace the hint string in all three languages (`src/i18n.js`): EN `Drag to move. Right-drag to turn. Scroll to zoom. Click a trace to read.`
  (touch variant: `Drag to move. Two fingers to turn and zoom. Tap a trace to read.`). Fade it after the first drag **and** first zoom, not after the first pointerdown.

### B5. Do not throw the visitor back to the overview
Today every return to the `map` view calls `shots.overview`. Change: store the camera pose (`target`, azimuth, polar, distance) when an
entry opens; on close, return to that pose. Only the first entry into the map and `Reset` go to `overview`.

**Done when:** a first-time user can pan, zoom to a corner, turn the map 90°, tilt to flat-on and reset using only a mouse, only a
trackpad, only the keyboard, and only touch; the paper never leaves the screen; text is upright at azimuth 0.

---

## 4. Part C — Click a glyph: zoom in **and** centre

### C1. Centre in the free area with a view offset, not by moving the target
New `src/three/view-offset.js`:
- `getFreeRect()` returns the part of the viewport not covered by the entry panel: desktop LTR `{x: 0, w: innerWidth − panelWidth}`,
  RTL `{x: panelWidth, w: innerWidth − panelWidth}`, phone bottom sheet `{y: 0, h: innerHeight × (1 − sheetFraction)}`.
  Read `panelWidth` from the panel element's `getBoundingClientRect()` target width (`min(720, 0.46 × innerWidth)`), not from a constant.
- `setOffset(px, py)` calls `camera.setViewOffset(W, H, px, py, W, H)` where `(px, py)` = (viewport centre − free-rect centre). This
  shifts the projection so the look-at target appears at the centre of the free area. `clear()` calls `camera.clearViewOffset()`.
- Tween the offset with gsap over the same 500 ms as the panel slide; call `invalidate` on every tick; recompute on `resize` and on panel expand/collapse (`F`).
- Raycasting keeps working because `Raycaster.setFromCamera` uses the camera's projection matrix; add a test that proves it (C4).

Remove `panelOffset` from `shots.glyph`.

### C2. Fit the glyph
`shots.glyph(mesh)`:
1. `target` = the glyph's world centre (`mesh.getWorldPosition`).
2. Glyph world size `(gw, gh)` from its geometry × scale; fitted distance so it fills ~55 % of the free rect:
   `d = max( gh / (2·tan(fov/2)), gw / (2·tan(fov/2)·freeAspect) ) / 0.55`, clamped to `[minDistance, 6]`.
3. Keep the current azimuth unless |azimuth| > 45°, in which case ease it to 0 so the writing is upright. Polar → 28°.
4. Run `moveTo`, `rotateTo`, `dollyTo` together with transitions and `await Promise.all(...)`.
5. Aim the lamp at the glyph (`lamp.setPointerTarget(target)`) and hold it there while the entry is open (ignore pointer raycasts for the lamp in `entry` view).

Related-entry and prev/next navigation call the same shot, flying glyph to glyph without returning to the overview.

### C3. Closing
On close: tween the view offset back to 0 and restore the stored pose (B5). `Esc`, the close chip, the browser back button and a
click on empty paper (not a drag) all close the entry.

### C4. Objective test for "centred"
`tools/test-interaction.mjs` (headless Chrome, same approach as `tools/shot.mjs`; expose `window.__akg = app` only when `?debug=1`):
for all 35 glyphs × viewports 1440×900, 1920×1080, 390×844 × `lang=de` and `lang=ar`: navigate to `#/e/<slug>`, wait for the camera to rest,
project the glyph's world centre to screen pixels, and assert it is within **24 px** of the free-rect centre and that its projected
bounding box lies entirely inside the free rect. Also assert a synthetic click at that pixel hits that glyph. Write failures with screenshots to `docs/redesign/progress/plan2-centre-fail-*.png`.

**Done when:** the script passes for all combinations.

---

## 5. Part D — Top-right menu always clickable

1. **Layering.** Give the chrome its own layer above every panel: in `chips.css`, `#chrome-layer { position: absolute; inset: 0; z-index: 65; pointer-events: none; }`
   and `#chrome-layer > * { pointer-events: auto; }`. (Threshold stays at 70 and hides the chrome anyway; hover chip 80, cursor 90, grain 99 are all `pointer-events: none` already — confirm.)
   Check `#ui-root > * { pointer-events: auto }` no longer makes the full-size chrome layer swallow clicks: the more specific `#chrome-layer` rule must win; verify in the browser.
2. **Collision with the panel header.** With the chrome on top, the top-right chips now sit over the entry/About panel's own header
   (language chips, `Close [Esc]`). When an entry or About is open, move the global chips out of the way: hide the global language
   chips (the panel has its own), and shift `Index` / `About` to the top-left next to the wordmark (class `chrome--panel-open` on the layer, toggled from the `view` subscription). On phones keep them in a single top bar above the sheet.
   In the Index view keep the chips visible on top so `Index [I]` can close it.
3. **Stop the canvas handlers from firing on UI.** In `main.js` bind `pointerdown` and `pointerup` to `renderer.domElement`, not `window`
   (keep a `window` `pointerup` only to end a drag state). In `onPointerMove`, if `e.target !== canvas`, clear the hover state, hide the hover chip,
   reset the cursor and return without raycasting. `handleClick` must begin with `if (e.target !== canvas) return;`.
4. **Hit size.** Chips are 28 px high; add an invisible 8 px hit-slop (`::after` with negative inset) so they are easy to hit, and make sure adjacent slops do not overlap.
5. **Test.** In `tools/test-interaction.mjs`: for each view (`map`, `entry`, `index`, `about`) at desktop and phone sizes, for each visible chip,
   assert `document.elementFromPoint(centre)` is the chip or a descendant, click it with real mouse events, and assert the expected state change
   (and that no entry opened as a side effect when a glyph is underneath the chip).

**Done when:** the test passes and clicking any chip never changes the hovered or active glyph.

---

## 6. Order of work and commits

1. **B1** camera frame + re-derived shots (`fix(camera): z-up frame and spherical shots`). Unit-test in `tests/camera.test.js` that each shot ends at its requested azimuth/polar/distance.
2. **D** menu layering and event targets (`fix(ui): chrome layer above panels, canvas-only pointer handlers`).
3. **A1–A3, A7** glyph size, flat placement, blending, registration screenshot (`fix(glyphs): original size rule, flat placement, normal blending`).
4. **C** view offset, fitted glyph shot, pose restore, centring test (`feat(camera): centre active glyph in free viewport`).
5. **B2–B5** input mapping, nav controls, hint, cursor (`feat(nav): map-style controls and on-screen navigation`).
6. **A4–A6** lamp-proximity reveal, zoom weight, ink picking (`feat(glyphs): lamp reveal and per-ink picking`).

After each step: `npm run build`, `npm test`, deploy to Local with `tools/deploy.sh`, capture 1440×900 and 390×844 screenshots of the
overview and of one opened entry into `docs/redesign/progress/plan2-step-N-*.png`, confirm zero console errors.

## 7. Things to leave alone
- ACF positions/rotations, the relief GLBs, REST endpoints, the entry panel's content and typography.
- The About shot's behind-the-relief idea (only re-express it in the new frame).
- Post-processing settings, except if A3's blending change makes the bloom on traces too weak; then lower the bloom threshold slightly and note it.

## 8. Noted but out of scope (ask Grayson before doing)
- In the supplied screenshot most of the relief is nearly black; only the area under the lamp is lit. Raising the fill light
  (`HemisphereLight` 0.12 → ~0.3) would make navigation easier because the paper edges stay visible. One-line change in `lamp.js`.
- `data.js` still loads the 1.9 MB `wp/v2/posts?_embed` response although the lean `akg/v1/glossary` endpoint exists and returns the same glyph data.
