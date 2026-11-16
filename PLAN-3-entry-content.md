# Al-Khatib-Glossar — Plan 3: the entry panel (clicks, expand, and how the content looks)

Handoff for the implementing model. Branch `redesign`. `PLAN.md` still governs palette, tone and guard-rails
(no database/ACF/slug changes, no deleted files, sober design, Arabic is first-class).

Three reported problems:
1. The content attached to each glyph looks poor.
2. Things in the right-hand panel cannot be clicked (related entries, etc.).
3. "Expand" does not expand; it shows the same-size panel in the middle of the screen.

Everything in §1 was **measured on the running Local site** (headless Chrome, real mouse events, computed styles,
`document.fonts`, HTTP status codes) and against all 46 language bodies of the 36 posts — not inferred from reading code.
Re-measure with the script in §7 before and after; do not mark anything done without it.

> **Working-tree warning.** While this plan was being written, another session edited `src/styles/{base,panel,about,index-view}.css`,
> `src/ui/{entry-panel,about,index-view}.js`, `src/main.js`, `src/three/view-offset.js` and redeployed (19:39–19:41, uncommitted).
> Run `git status` and `git diff` first. Keep those changes, but replace the `!important` patches with the structural fix in Part A.

---

## 1. Findings

### 1.1 Why the panel could not be clicked (measured)
At 19:36 every control in the entry panel failed a hit test. `document.elementFromPoint()` at the centre of
`Expand`, `Close`, the `AR` chip, the first related chip and `prev/next` returned **`#akg-about-panel.akg-panel.about-panel.is-hidden`**
(or its children). Real clicks on a related chip and on "next" left the URL unchanged. Wheel-scrolling over the panel scrolled nothing visible.

Cause, in `src/styles/base.css`:
```css
#ui-root > * { pointer-events: auto; }          /* specificity 1,0,0 */
.about-panel.is-hidden { pointer-events: none; } /* specificity 0,2,0 — loses */
```
"Hidden" overlays were only `opacity: 0` + a transform, stayed `display: flex`, and the ID-level rule re-enabled their pointer events.
The About panel has the same size, position and `z-index: 50` as the entry panel and comes later in the DOM, so an invisible
About panel lay exactly on top of every entry. The Index overlay (`z-index: 55`, full screen) has the same defect.

The other session's patch (`display: none !important; pointer-events: none !important`) makes the hit tests pass as of 19:41, but it is a
band-aid: the blanket rule is still there, exit animations are now impossible, and nothing prevents a regression.

Second cause of "still can't click after a fix": in `theme/map.php` the stylesheet has a cache-buster (`index.css?v=<filemtime>`) but
**the script does not** (`assets/index.js`). A normal browser can run new CSS with stale JS.

### 1.2 Expand (measured)
`.akg-panel.is-expanded { width: min(760px, 92vw); inset-inline: 0; margin-inline: auto; }` versus the normal
`width: min(720px, 46vw)`. At 1920 px wide: 720 px → **720 px**, just moved to the centre (rect x 1200 → 600). At 1440: 662 → 760.
The map behind is not blurred or dimmed, the camera's view offset is not updated, and the chrome chips float over it.

### 1.3 Fonts: none of the designed typefaces load (measured)
`document.fonts` status: Newsreader 400 / 400 italic, IBM Plex Mono, IBM Plex Sans Arabic 400/500, Noto Naskh Arabic 400, favorit 500 → **`error`**.
The built CSS requests `url(/fonts/….woff2)` (site root) → **HTTP 404**. The files are at `/wp-content/themes/blankslate/fonts/` (HTTP 200).
Only the old `favorit` face from `theme/style.css` loads. Everything you see is fallback: Georgia-class serif, a system mono, a system Arabic face.

Also in `src/styles/panel.css`, four custom properties are used but **never defined** in `tokens.css`:
`--font-read`, `--font-arabic-read`, `--font-arabic-display`, `--dur-mid` (tokens define `--font-reading`, `--font-arabic-reading`).
Those declarations are invalid, so the body text and Arabic rules silently inherit instead of applying.

### 1.4 What the sanitiser destroys (measured over all bodies)
Authors' inline styles, by frequency: `font-weight: 400` ×1046 (noise), `text-align: right` ×236 (Arabic; redundant with `dir`),
**`text-decoration: underline` ×116**, **`padding-left: 40/80/120/240/400/480px` ×81**, `width: 100%` ×13 (audio).
`sanitize.js` strips every `style` and unwraps every `<span>`, so:
- **Underlines** — which mark speakers in court transcripts (`Richterin:`, `Dolmetscher:` in 241 "abteilung") and section headings — vanish.
- **Indents** — which carry the layout of the text-collages and poems — vanish.
- `srcset` / `sizes` are not on the allow-list, so every image loads at full size (up to 2560 px wide; entry 158 has six).

### 1.5 What the content actually is (measured)
| Kind | Entries (examples) | Markers in the HTML |
|---|---|---|
| Audio only, no text | 115, 129, 139, 193, 203, 220 (bodies 377–429 chars) | one `<audio>` |
| Audio + text | 152, 178, 189, 210, 233 | `<audio>` then paragraphs |
| Video only / GIF only | 251 / 247 | ARVE `<video>` / one `<img>` |
| Verse | 217 "welten" (100 % short lines), 149, 152, 200; Arabic 217, 152 | often `[poem]` → `<div class="poem">`, one `<p>` per line, `<p>&nbsp;</p>` between stanzas |
| Transcript / dialogue | 241, 230, 210 | paragraph starts with an underlined speaker name + colon |
| Long prose / text-collage | 224 (48 k chars), 126, 136, 182, 207 | bold or underlined one-line paragraphs act as headings; many `<p>&nbsp;</p>` spacers (58 in 136) |
| Image essay | 158 (6 images), 227, 241 | `<img>` in `<p>` |
| Notes / sources | 241, 197, 158, 126, 178, 136 | `<sup>n</sup>` in text; an `<hr>` then numbered notes or "Quellen:" |
| Arabic | 31 (Arabic only), 9 more | `<p style="text-align:right">`, `<ol>/<ul>` |

Empty spacer paragraphs total several hundred. `<p></p>` also appears inside poems.

### 1.6 What is wrong with the look (from the screenshots, with the cause)
- **Poem set as a ladder.** Every line is a `<p>` with `margin-bottom: 1.4em`, inside `.poem { white-space: pre-line }`, which also renders
  the newline between tags. One stanza fills a screen. All of it is forced italic.
- **Body is 16 px in `--paper-dim` (#a8a497)** — small and grey on near-black.
- **Glyph mark** is the raw JPEG: a white drawing in a black box with a red glow. Related chips show the same as 22 px black squares.
- **Audio-only entries are an empty black column** (title, a thin player, nothing else).
- **Title is 28 px**; the design called for a display title.
- **Header is not sticky** — the panel itself is the scroller, so `Close` and the language chips scroll away on long texts.
- **The read counter chip sits on top of the panel's footer** (measured: `#chip-counter` over `.entry-footer-nav`).
- UI strings in the panel are hard-coded English (`Expand`, `Close`, `Related`, `Play`, `Not available in …`) regardless of language.
- The URL for "dolmetschen (vergessen)" is `#/e/post-2-title` and for "zellen" `#/e/pin-1` (WordPress slugs). Not changed here; see §8.

---

## 2. Part A — Make clicks reliable (do first)

A1. **Remove the blanket rule.** Delete `#ui-root > * { pointer-events: auto; }` and the `#ui-root > *.is-hidden` patch. Each layer
   declares its own pointer behaviour: `#ui-root` stays `pointer-events: none`; `.akg-panel`, `.akg-index-overlay`, `#threshold`,
   `.akg-nav-cluster` get `pointer-events: auto` in their own rule; `#chrome-layer` stays `none` with `auto` on its interactive children.

A2. **One visibility helper**, `src/ui/layer.js`: `showLayer(el)` removes `hidden` and `inert`, forces a reflow, adds `.is-open`;
   `hideLayer(el)` removes `.is-open`, sets `inert`, and on `transitionend` (with a 600 ms timeout fallback) sets the `hidden` attribute.
   CSS: `[hidden] { display: none !important; }` once, globally. Entry panel, About panel, Index overlay and threshold all use it; remove the
   per-component `is-hidden` + inline `style.pointerEvents` + `style.opacity` juggling (`entry-panel.js`, `about.js` lines ~179–210, `index-view.js`).
   Result: a closed layer is not in the hit-test tree, not focusable, and still animates out.

A3. **Only one side panel exists at a time.** Opening an entry calls `hideLayer(about)` and vice-versa, in the `view` subscription in `main.js`.

A4. **Cache-bust the script** in `theme/map.php`: `assets/index.js?v=<filemtime>` exactly like the CSS line above it.

A5. **Scrolling.** Make `.panel-scroll` (new inner element, see C1) the scroll container with `overscroll-behavior: contain`.
   Confirm with a real wheel event over a long entry that `scrollTop` increases and the camera does not zoom.

A6. **Move chrome out from under/over the panel.** When an entry or About is open, set `--panel-w` on `#ui-root` to the panel's width and
   position `.chrome-bottom-right` and `.akg-nav-cluster` at `inset-inline-end: calc(var(--panel-w) + 24px)`. In reading mode (Part B) hide both.

**Done when** §7's hit-test, click, scroll and "no invisible interceptor" checks pass at 1440×900, 1920×1080 and 390×844, in `de` and `ar`.

---

## 3. Part B — Expand becomes a real reading mode

`F` / `Expand` switches the entry from *side panel* to *reading mode*; `F` / `Esc` goes back (first `Esc` leaves reading mode, second closes).

- **Geometry:** the layer covers the whole viewport (`inset: 0; width: 100vw`), background `rgb(11 12 16 / .96)`. No margin-auto trick.
- **Layout ≥ 1100 px:** CSS grid `minmax(220px, 1fr) minmax(0, 42rem) minmax(220px, 1fr)`.
  - Inline-start rail (sticky, top 96 px): the glyph drawing large (see C3), type label, credits, language chips, `n / 35`.
  - Centre: title and body, reading size up one step (§4 C2 "reading").
  - Inline-end rail (sticky): related entries as a vertical list with drawings; on entries with notes, the notes list (C6) instead of at the bottom.
- **Layout < 1100 px:** single centred column `min(42rem, 100vw − 48px)`; rails collapse above/below the text.
- **Header** stays sticky across the full width: wordmark left, `Collapse [F]` and `Close [Esc]` right, progress hairline beneath.
- **Scene:** stop feeding pointer raycasts and pause the render loop while in reading mode (the canvas is covered); resume on collapse.
  Tween the camera view offset to 0 on expand and back to the side-panel offset on collapse (`src/three/view-offset.js`).
- **Transition:** 500 ms, panel background widens from the inline-end edge; content cross-fades (no layout animation of text).
- **Persistence:** remember the mode in the store for the session, so prev/next and related links stay in reading mode.
- **Phone:** the bottom sheet's 100 % snap *is* reading mode; the `Expand` chip is hidden under 720 px.

**Done when:** panel rect in reading mode equals the viewport at all three sizes; the text column is 40–44 rem wide at ≥1100 px;
every control in both rails passes the §7 hit test; `Esc` order works; collapsing restores the exact previous scroll position.

---

## 4. Part C — The look of the content

### C0. Fix the foundations first
- **Fonts.** Move the woff2 files to `src/assets/fonts/` and reference them from `tokens.css` with relative URLs
  (`url("../assets/fonts/newsreader-….woff2")`) so Vite fingerprints them into `dist/assets/` and emits relative URLs. Remove `public/fonts`
  from the build path (archive, don't delete). Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `map.php` for
  Newsreader 400 and Plex Mono 400. Add missing faces: Newsreader 500 and 600 italic are not needed; **do** add Newsreader `latin-ext`
  (needed for `ı`, and typographic marks) and check coverage of the title `qıʇɐɥʞ lɐ` (IPA letters: expect fallback; make the fallback
  explicit — `"Noto Sans", "DejaVu Sans", sans-serif` after the display face — and verify it does not look broken).
  Acceptance: every face in `document.fonts` that the page uses is `loaded`; zero 404s in the network log.
- **Tokens.** Define, in `tokens.css`: `--font-read: var(--font-reading)`, `--font-arabic-read: var(--font-arabic-reading)`,
  `--font-arabic-display: "IBM Plex Sans Arabic", sans-serif`, `--dur-mid: 320ms`. Add a build check (`tools/check-css-vars.mjs`) that fails
  when any `var(--x)` used in `src/styles` is not defined in `tokens.css`; run it in `npm test`.
- **i18n.** Move every panel string into `src/i18n.js` (de / en / ar): expand, collapse, close, related, play, pause, notes, sources,
  "not available in X — showing Y", image n of m, previous, next.

### C1. Panel structure
```
.akg-panel
  header.panel-header      (sticky, glass, 56 px)   type · nn/35 · language chips ……… Expand · Close
  .reading-progress        (1 px hairline under the header)
  .panel-scroll            (the only scroller)
     .entry-head           drawing · title · credits
     .entry-media          audio / video hero when the entry is media-led
     .entry-body           the text
     .entry-notes          footnotes / sources (if any)
     .entry-related
     .entry-footer-nav
```
Side-panel padding: 40 px inline, 48 px top. Body measure capped at 34 rem inside the 720 px panel.

### C2. Type scale
| Element | Side panel | Reading mode | Notes |
|---|---|---|---|
| Title | `clamp(2.25rem, 3.4vw, 3.25rem)`, lh 1.02, Favorit | `clamp(3rem, 5vw, 4.5rem)` | lowercase as authored; `text-wrap: balance` |
| Body (Latin) | 19 px / 1.6, Newsreader 400, colour `--paper` at 92 % | 21 px / 1.62 | `hyphens: auto` (`lang="de"`), `text-wrap: pretty`, `font-kerning: normal`, oldstyle numerals |
| Body (Arabic) | 22 px / 1.95, Noto Naskh | 24 px / 2.0 | `dir="rtl"`, no italics, no letter-spacing |
| Verse | body size, lh 1.5 | same | upright, not italic |
| Meta / labels | 11 px Plex Mono, tracking .06em, uppercase | 11 px | Arabic labels in Plex Sans Arabic, not uppercased |
| Notes | 15 px / 1.5, `--paper-dim` | 14 px in the rail | |
Paragraph rhythm: `margin-block: 0 1.05em`; no first-line indent. Italic stays only where the author used `<i>/<em>`.
Contrast: body text ≥ 11:1 on the panel background (measure, record).

### C3. The drawing as the entry's emblem
New util `src/ui/glyph-image.js`: load the glyph JPEG once, draw to a canvas, convert luminance → alpha, tint (`--trace`, or `--paper`
for read entries), cache a data-URL per (id, colour). Use it for:
- the head of each entry: the drawing at up to 220 px wide (side panel) / the whole start rail (reading mode), **no box, no glow**;
- related entries: 56 px drawings beside the title, as a list (one per row, title in display face 18 px, type in mono) — not tiny chips;
- prev / next at the foot: drawing + title, each half the width, with the keyboard hint.
The existing `.entry-glyph-thumb` box and the drop-shadow filter go.

### C4. Normalising the body (extend `src/ui/sanitize.js` → `normalizeEntryHtml`, pure function, unit-tested)
Run on the parsed DOM, in this order, **before** inline styles are stripped:
1. `span[style*="text-decoration: underline"]` → `<u class="mark">` (kept by the allow-list).
2. `[style*="padding-left: Npx"]` → `data-indent="k"` with `k = round(N / 40)`, capped at 12; CSS maps `k` to `margin-inline-start: calc(k * 1.5rem)`
   and, for `k ≥ 6`, to a percentage of the column (`k/12 * 60%`) so wide indents survive on narrow panels.
3. Keep `srcset`, `sizes`, `width`, `height` on images; add `sizes="(min-width: 1100px) 42rem, 90vw"` when missing.
4. Unwrap `font-weight` spans, drop `text-align`, then strip remaining `style` attributes (as now). Remove `<script>` (as now).
5. **Spacers:** a run of one or more empty paragraphs (`<p>` containing only whitespace, `&nbsp;` or `<br>`) becomes a single
   `<div class="gap" data-size="1|2|3">` (1 = one empty paragraph, 2 = two, 3 = three or more). Leading and trailing spacers are dropped.
6. **Verse.** A block is verse when it is inside `.poem`, **or** when it is a run of ≥ 6 consecutive paragraphs of which ≥ 80 % are under 70
   characters and none ends a sentence-long prose line (> 140 chars). Convert the run to
   `<div class="verse"><p class="stanza"><span class="line">…</span>…</p>…</div>`, splitting stanzas at `.gap`. Lines get `display: block`,
   hanging indent 1.5 rem for wrapped lines, stanza gap 1.1 em. Do **not** use `white-space: pre-line`.
   Entries that must come out as verse: 217 (de, ar), 149, 152 (de, ar). Entries that must **not**: 172, 224, 175, 120. Encode both lists as tests.
7. **Speaker turns.** A paragraph whose first child is `u.mark` followed by text starting with `:` becomes `<p class="turn">` with the name in
   `<span class="speaker">`. Style: speaker in Plex Mono 11 px uppercase `--trace`; in reading mode the name hangs in the start margin
   (grid `8rem 1fr`), in the side panel it is a run-in on its own line above the speech. Must trigger on 241.
8. **Sub-headings.** A paragraph under 120 characters whose entire text is inside `<b>`/`<strong>` and/or `u.mark` becomes `<h3 class="subhead">`
   (Favorit 20 px, `margin-block: 2.2em 0.6em`). Must trigger on the first paragraph of 224.
9. **Notes.** If the body contains an `<hr>` followed only by short numbered paragraphs, or a paragraph beginning "Quelle"/"Quellen", move
   everything after the last such `<hr>` into `.entry-notes` with a mono label (`Notes` / `Sources`). Each `<sup>n</sup>` becomes a link to
   `#note-n` and each note gets a back-link. In reading mode the notes sit in the end rail aligned to the top; clicking a `sup` scrolls/highlights.
   Other `<hr>` become a centred 48 px hairline with 2.5 em margins.
10. **Figures.** `<p>` containing only an `<img>` → `<figure class="fig">`. Width = column in the side panel; in reading mode figures may
    break out to `min(64rem, 92vw)`. Click (or Enter) opens a lightbox: full-viewport, `object-fit: contain`, arrow keys step through the
    entry's images, `Esc` closes, caption `n / m`. GIF (247) plays inline at natural size, centred.
11. **Lists** (`ol/ul`, e.g. the checkpoint list in 233 ar): hanging numerals in mono, 0.4 em between items, RTL-aware.
12. **Links:** `--paper` with a 1 px `--trace` underline; external links keep `target="_blank" rel="noopener noreferrer"` and get a small `↗`.

The function returns `{ html, notesHtml, media: {audio[], video[], images[]}, kind }` where `kind` ∈
`audio-only | video-only | image-only | verse | transcript | prose`, so the panel can pick a layout without regexes on strings
(replace the `sanitized.match(/<source…mp3/)` logic in `entry-panel.js`).

### C5. Media-led entries (the seven audio pieces, the video, the GIF)
These are complete works, not attachments; today they render as an empty column.
- **Audio-only layout:** the entry's drawing fills the upper part of the panel (up to 60 % of its width, centred), title beneath, then a
  large player: a 56 px round play control, a full-width scrubber drawn as a **waveform** (decode once with `AudioContext.decodeAudioData`,
  reduce to ~160 peaks, cache in `sessionStorage`; if decoding fails or the file is > 25 MB, draw a plain 1 px line), elapsed / total in mono.
  Played portion in `--trace`, the rest in `--ink-3`. `Space` toggles, `←/→` seek 5 s **only while the player has focus**
  (otherwise they stay prev/next entry). Credits below. No empty body block.
- **Audio + text:** the same player in compact form (40 px), sticky under the header while playing so it stays reachable in long texts.
- **Video (251):** 16:9 block at column width, custom poster frame = first frame, native controls kept, `preload="metadata"`. In reading mode it may take the wide figure width.
- Leaving an entry or switching language pauses all media (already implemented — keep, and cover with a test).

### C6. Language switch inside an entry
Switching language cross-fades the body only (200 ms), keeps the header, resets scroll to top, and flips `dir` and the panel side per `PLAN.md`.
The availability note becomes a single mono line under the header (no dashed box), translated.

### C7. Small things
- Selection colour `--prussian` background, `--paper` text. Custom thin scrollbar in `--ink-3`, `--paper-mute` on hover.
- Focus rings visible on every control (2 px `--paper`, offset 2 px) — the current `--prussian` ring is nearly invisible on `--ink`.
- First open of an entry: head and body rise 12 px and fade in, staggered 60 ms; nothing else moves. Respect `prefers-reduced-motion`.
- Reading progress = 1 px hairline under the header, not a separate sticky element.

---

## 5. Order of work and commits
1. **A1–A6** layering, helper, cache-bust, chrome offset → `fix(ui): hidden layers leave the hit-test tree; panel always clickable`
2. **C0** fonts, tokens, CSS-variable check, i18n → `fix(type): fonts load, tokens defined, panel strings translated`
3. **C1–C3, C7** panel structure, type scale, drawing emblem → `feat(entry): panel structure, type scale, glyph emblems`
4. **C4** normaliser with tests → `feat(entry): body normaliser (verse, turns, subheads, notes, figures, indents)`
5. **C5–C6** media layouts, language switch → `feat(entry): media-led layouts and waveform player`
6. **B** reading mode → `feat(entry): reading mode`
After each: `npm run build`, `npm test`, `tools/deploy.sh`, run §7, save screenshots to `docs/redesign/progress/plan3-step-N-*.png`.

## 6. Entries to review by eye after each step (side panel and reading mode, 1440 and 1920 wide)
217 de + ar (verse) · 149 (verse) · 241 (transcript, footnotes, image, 30 k chars) · 224 (48 k chars, sub-headings) · 136 (58 spacers, indents)
· 158 (six images, notes) · 233 de + ar (audio + text, lists) · 115 (audio only) · 251 (video) · 247 (GIF) · 31 (Arabic only) · 172 de/en/ar.

## 7. Verification script (`tools/test-entry.mjs`, same CDP approach as `tools/test-interaction.mjs`; `?debug=1`)
For each viewport × `lang` ∈ {de, ar} × each entry in §6:
1. **Hit test:** for every visible `button`, `a`, `[role=slider]` inside the entry layer, scroll it into view and assert
   `elementFromPoint(centre)` is the element or its descendant. Report the intercepting element's id/class on failure.
2. **No invisible interceptors:** sample a 12×8 grid over the viewport; fail if the top element (or any ancestor) has computed `opacity: 0`,
   the `hidden` attribute, or `inert`.
3. **Real clicks:** first related entry → hash changes to that entry; `next` → hash changes; language chip → body `dir`/text changes; `Close` → view is `map`.
4. **Scroll:** dispatch a wheel event over the panel on a long entry; `scrollTop` > 0; camera distance unchanged.
5. **Reading mode:** press `F`; layer rect equals the viewport; text column width within 40–44 rem (≥1100 px); `Esc` returns to the side panel, second `Esc` closes.
6. **Fonts:** every `FontFace` whose family is used by a visible element has `status === "loaded"`; no request returned ≥ 400.
7. **Structure assertions:** 217 has `.verse .stanza` and no paragraph margin larger than the stanza gap; 241 has ≥ 10 `.turn .speaker`;
   224 has ≥ 1 `.subhead`; 241 has `.entry-notes` with back-links; 136 has `[data-indent]`; 115 has kind `audio-only` and no empty `.entry-body`.
8. **Console:** zero errors.
Unit tests (`tests/sanitize.test.js`, new `tests/normalize.test.js`) cover C4 rules 1–12 with fixtures cut from the real bodies of
217, 241, 224, 136, 158, 233; include the negative cases from C4.6.

## 8. Not in scope — ask Grayson
- WordPress slugs `post-2-title` (dolmetschen) and `pin-1` (zellen) appear in URLs. Renaming them is a content change and breaks existing links.
- Two of the three verse heuristics and the sub-heading rule are inferences about authors' intent. If an entry is mis-classified, prefer adding
  an explicit per-entry override map (`src/entry-overrides.js`, keyed by post id) over loosening the rule; list every override in `docs/redesign/decisions.md`.
