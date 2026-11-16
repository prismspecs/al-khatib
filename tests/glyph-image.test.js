import test from 'node:test';
import assert from 'node:assert/strict';
import { tintLuminanceToAlpha } from '../src/ui/glyph-image.js';

test('tintLuminanceToAlpha converts white on black to tinted color with alpha', () => {
    // 2x2 image: [black, white, mid-grey, dark-grey]
    // RGBA format: 4 bytes per pixel
    const data = new Uint8ClampedArray([
        0, 0, 0, 255,        // black -> alpha 0
        255, 255, 255, 255,  // white -> alpha 255
        128, 128, 128, 255,  // mid-grey -> partial alpha
        10, 10, 10, 255      // dark -> alpha 0
    ]);

    // Tint to red trace: #ff4a3d (255, 74, 61)
    tintLuminanceToAlpha(data, [255, 74, 61]);

    // Pixel 0 (black): transparent
    assert.equal(data[3], 0);

    // Pixel 1 (white): fully opaque and tinted to #ff4a3d
    assert.equal(data[4], 255);
    assert.equal(data[5], 74);
    assert.equal(data[6], 61);
    assert.equal(data[7], 255);

    // Pixel 2 (mid-grey): tinted and partially opaque
    assert.equal(data[8], 255);
    assert.equal(data[9], 74);
    assert.equal(data[10], 61);
    assert.ok(data[11] > 0 && data[11] < 255);

    // Pixel 3 (near black): alpha 0
    assert.equal(data[15], 0);
});
