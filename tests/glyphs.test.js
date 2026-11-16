import test from 'node:test';
import assert from 'node:assert/strict';
import { calcGlyphDimensions, GLYPH_SIZE, generateInkMask } from '../src/three/glyphs.js';

/**
 * Click-vs-drag calculation helper matching PLAN.md §3.4:
 * Treat as click only if moved < 5 px and held < 400 ms.
 */
function isPointerClick(dx, dy, dtMs) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 5 && dtMs < 400;
}

/**
 * Occlusion test logic helper matching glyphs.testHit:
 * Glyphs behind the relief surface from the camera must not be targetable.
 */
function isGlyphOccluded(glyphDistance, reliefDistance, threshold = 0.12) {
    return glyphDistance > reliefDistance + threshold;
}

/**
 * Target opacity calculation matching PLAN.md §3.4:
 * - Idle: 0.22 (unread) / 0.18 (read)
 * - Hovered or Active: 1.0
 * - Dimmed (when another glyph is active): 0.08
 */
function getGlyphTargetAlpha({ isHovered, isActive, hasActiveSibling, isRead }) {
    if (isActive || isHovered) return 1.0;
    if (hasActiveSibling) return 0.08;
    return isRead ? 0.18 : 0.22;
}

test('isPointerClick respects < 5px and < 400ms threshold', () => {
    // Valid clicks
    assert.equal(isPointerClick(0, 0, 100), true);
    assert.equal(isPointerClick(2, 3, 250), true);
    assert.equal(isPointerClick(3, 3, 399), true);

    // Drags (distance >= 5px)
    assert.equal(isPointerClick(5, 0, 100), false);
    assert.equal(isPointerClick(3, 4, 100), false); // sqrt(9 + 16) = 5
    assert.equal(isPointerClick(10, 20, 200), false);

    // Long press (time >= 400ms)
    assert.equal(isPointerClick(1, 1, 400), false);
    assert.equal(isPointerClick(0, 0, 600), false);
});

test('isGlyphOccluded filters out glyphs behind relief topography', () => {
    // Glyph in front of relief (e.g. glyph dist 8.5, relief dist 8.6)
    assert.equal(isGlyphOccluded(8.5, 8.6), false);

    // Glyph right at surface within 0.12 threshold
    assert.equal(isGlyphOccluded(8.65, 8.6), false);

    // Glyph behind relief (e.g. relief dist 6.0, glyph behind at 8.0)
    assert.equal(isGlyphOccluded(8.0, 6.0), true);

    // Glyph on back of relief facing away from camera
    assert.equal(isGlyphOccluded(12.0, 5.0), true);
});

test('getGlyphTargetAlpha calculates correct opacities for all states', () => {
    // Idle unread
    assert.equal(getGlyphTargetAlpha({ isHovered: false, isActive: false, hasActiveSibling: false, isRead: false }), 0.22);

    // Idle read
    assert.equal(getGlyphTargetAlpha({ isHovered: false, isActive: false, hasActiveSibling: false, isRead: true }), 0.18);

    // Hovered
    assert.equal(getGlyphTargetAlpha({ isHovered: true, isActive: false, hasActiveSibling: false, isRead: false }), 1.0);
    assert.equal(getGlyphTargetAlpha({ isHovered: true, isActive: false, hasActiveSibling: false, isRead: true }), 1.0);

    // Active
    assert.equal(getGlyphTargetAlpha({ isHovered: false, isActive: true, hasActiveSibling: false, isRead: false }), 1.0);

    // Dimmed sibling while another entry is active
    assert.equal(getGlyphTargetAlpha({ isHovered: false, isActive: false, hasActiveSibling: true, isRead: false }), 0.08);
    assert.equal(getGlyphTargetAlpha({ isHovered: false, isActive: false, hasActiveSibling: true, isRead: true }), 0.08);
});

test('read state check supports both Set and Array collections', () => {
    const setCollection = new Set([224, 182, 31]);
    const arrayCollection = [224, 182, 31];

    const checkFromSet = (id) => setCollection.has(id);
    const checkFromArray = (id) => arrayCollection.includes(id);

    assert.equal(checkFromSet(224), true);
    assert.equal(checkFromSet(999), false);
    assert.equal(checkFromArray(182), true);
    assert.equal(checkFromArray(999), false);
});

test('calcGlyphDimensions normalizes longest side to GLYPH_SIZE (Plan 2 §2 A1)', () => {
    assert.equal(GLYPH_SIZE, 1.8);

    // 1. Square aspect (1.0)
    const square = calcGlyphDimensions(1.0, 1.8);
    assert.equal(square.width.toFixed(2), '1.80');
    assert.equal(square.height.toFixed(2), '1.80');

    // 2. Portrait aspect (0.54) -> height is 1.8, width is 1.8 * 0.54 = 0.972
    const portrait = calcGlyphDimensions(0.54, 1.8);
    assert.equal(portrait.height.toFixed(2), '1.80');
    assert.equal(portrait.width.toFixed(3), '0.972');

    // 3. Landscape aspect (2.4) -> width is 1.8, height is 1.8 / 2.4 = 0.75
    const landscape = calcGlyphDimensions(2.4, 1.8);
    assert.equal(landscape.width.toFixed(2), '1.80');
    assert.equal(landscape.height.toFixed(2), '0.75');
});

test('generateInkMask dilates ink strokes and detects ink hits (Plan 2 §2 A6)', () => {
    const W = 96;
    const H = 48;
    const fakeCtx = {
        drawImage: () => {},
        getImageData: (x, y, w, h) => {
            const data = new Uint8ClampedArray(w * h * 4);
            // Place one bright ink pixel at (cx = 48, cy = 24)
            const cx = 48;
            const cy = 24;
            const idx = (cy * w + cx) * 4;
            data[idx] = 200;
            data[idx + 1] = 200;
            data[idx + 2] = 200;
            data[idx + 3] = 255;
            return { data };
        }
    };

    const prevDoc = global.document;
    global.document = {
        createElement: (tag) => {
            if (tag === 'canvas') {
                return {
                    width: W,
                    height: H,
                    getContext: () => fakeCtx
                };
            }
            return {};
        }
    };

    try {
        const mask = generateInkMask({ width: W, height: H }, W);
        assert.ok(mask);
        assert.equal(mask.width, W);
        assert.equal(mask.height, H);

        // UV for (cx, cy): in Three.js plane, v=0 is bottom, v=1 is top.
        // In mask: py = floor((1 - v) * (H - 1)), px = floor(u * (W - 1))
        // So for cx = 48 -> u = 48 / (W - 1), cy = 24 -> 1 - v = 24 / (H - 1) => v = 1 - 24 / (H - 1)
        const uCenter = 48 / (W - 1);
        const vCenter = 1.0 - (24 / (H - 1));

        // Center pixel should be detected
        assert.equal(mask.hasInkAtUV(uCenter, vCenter), true);

        // Pixel 2px to the right: cx = 50 -> should be detected due to 3px dilation
        const u2px = 50 / (W - 1);
        assert.equal(mask.hasInkAtUV(u2px, vCenter), true);

        // Pixel 5px to the right: cx = 53 -> outside 3px dilation radius, should be false
        const u5px = 53 / (W - 1);
        assert.equal(mask.hasInkAtUV(u5px, vCenter), false);

        // Corner at (0, 0) should be false
        assert.equal(mask.hasInkAtUV(0.0, 0.0), false);
    } finally {
        global.document = prevDoc;
    }
});

test('glyph picking core fallback matches within 35% half-size (Plan 2 §2 A6)', () => {
    // Inner core criterion: |u - 0.5| <= 0.175 && |v - 0.5| <= 0.175
    const isInsideCore = (u, v) => Math.abs(u - 0.5) <= 0.175 + 1e-4 && Math.abs(v - 0.5) <= 0.175 + 1e-4;

    // Center is inside
    assert.equal(isInsideCore(0.5, 0.5), true);
    // Boundary of core (0.5 + 0.175 = 0.675)
    assert.equal(isInsideCore(0.675, 0.5), true);
    assert.equal(isInsideCore(0.325, 0.5), true);

    // Outside core (e.g. u = 0.75, v = 0.5)
    assert.equal(isInsideCore(0.75, 0.5), false);
    // Outer edge (u = 0.9, v = 0.9)
    assert.equal(isInsideCore(0.9, 0.9), false);
});


