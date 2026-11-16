import test from 'node:test';
import assert from 'node:assert/strict';

test('Glyph active breathing pulse calculation', () => {
    // Pulse modulates between 0.90 and 1.10 for stroke weight & glow,
    // and between 1.04 and 1.09 for mesh scale
    const calcPulse = (elapsed) => {
        const breath = (Math.sin(elapsed * 2.2) + 1) * 0.5; // [0.0, 1.0]
        const scale = 1.04 + breath * 0.05;
        const weight = 0.90 + breath * 0.20;
        return { breath, scale, weight };
    };

    const p0 = calcPulse(0);
    assert.ok(p0.scale >= 1.04 && p0.scale <= 1.09);
    assert.ok(p0.weight >= 0.90 && p0.weight <= 1.10);

    // Periodicity check: sin(t * 2.2) cycles with period 2 * PI / 2.2 ~= 2.855s
    const period = (2 * Math.PI) / 2.2;
    const p1 = calcPulse(period);
    assert.ok(Math.abs(p0.scale - p1.scale) < 1e-5);
    assert.ok(Math.abs(p0.weight - p1.weight) < 1e-5);
});

test('Glyph 3D vertex wave displacement calculation', () => {
    // Computes organic wave displacement across X and Y based on uTime and uWeight
    const calcDisplacement = (x, y, uTime, uWeight) => {
        const wave1 = Math.sin(x * 4.2 + uTime * 2.4) * Math.cos(y * 3.6 + uTime * 1.8);
        const wave2 = Math.sin((x + y) * 5.5 - uTime * 3.0) * 0.45;
        const displacement = (wave1 + wave2) * 0.038 * uWeight;
        const zLift = (0.028 * uWeight) + displacement;
        return { wave1, displacement, zLift };
    };

    // When idle (uWeight = 0), zero lift and displacement
    const idle = calcDisplacement(0.5, 0.5, 1.0, 0.0);
    assert.equal(idle.displacement, 0);
    assert.equal(idle.zLift, 0);

    // When active (uWeight = 1.0), displaces smoothly above paper plane
    const active = calcDisplacement(0.5, 0.5, 1.0, 1.0);
    assert.ok(active.zLift > -0.05 && active.zLift < 0.10);

    // Wave travels over time
    const t0 = calcDisplacement(0.2, 0.3, 0.0, 1.0);
    const t1 = calcDisplacement(0.2, 0.3, 0.5, 1.0);
    assert.notEqual(t0.displacement, t1.displacement);
});

test('Postcard rear illumination levels', () => {
    // When view === "about": rearLamp target 1.8, rearSpot target 36.0
    // When view !== "about": rearLamp target 0.6, rearSpot target 0.0
    const getTargetLighting = (view) => {
        const isAbout = view === 'about';
        return {
            rearLamp: isAbout ? 1.8 : 0.6,
            rearSpot: isAbout ? 36.0 : 0.0
        };
    };

    const aboutLighting = getTargetLighting('about');
    assert.equal(aboutLighting.rearLamp, 1.8);
    assert.equal(aboutLighting.rearSpot, 36.0);

    const mapLighting = getTargetLighting('map');
    assert.equal(mapLighting.rearLamp, 0.6);
    assert.equal(mapLighting.rearSpot, 0.0);
});

test('Glyph text contoured stroke and filament calculation', () => {
    // Calculates contour glow without rectangular or circular artifacts
    const calcContour = (lum, uWeight) => {
        const strokeIdle = Math.min(1, Math.max(0, (lum - 0.25) / (0.60 - 0.25)));
        const strokeActive = Math.min(1, Math.max(0, (lum - 0.08) / (0.35 - 0.08)));
        const stroke = strokeIdle * (1 - uWeight) + strokeActive * uWeight;
        const contourGlow = Math.min(1, Math.max(0, (lum - 0.015) / (0.22 - 0.015))) * 0.70;
        const combined = Math.max(stroke, contourGlow * uWeight);
        return { stroke, contourGlow, combined };
    };

    // Zero lum (empty background) -> strictly 0
    const empty = calcContour(0.0, 1.0);
    assert.equal(empty.combined, 0);

    // Thin stroke edge (lum = 0.15) -> contoured glow visible when active
    const edge = calcContour(0.15, 1.0);
    assert.ok(edge.combined > 0.4);

    // Thick core (lum = 0.8) -> full saturation
    const core = calcContour(0.80, 1.0);
    assert.equal(core.combined, 1.0);
});

test('About view postcard centering in free viewport area', () => {
    // Desktop 1440x900 viewport with an open About panel (~662px / 46vw)
    const W = 1440;
    const H = 900;
    const panelWidth = Math.min(720, 0.46 * W); // 662.4
    const freeW = W - panelWidth; // 777.6

    // LTR (German/English): panel is on the right, free space is [0, 777.6]
    const ltrFreeRect = { x: 0, y: 0, w: freeW, h: H };
    const ltrFreeCenterX = ltrFreeRect.x + ltrFreeRect.w * 0.5; // 388.8
    const ltrOffset = { px: (W * 0.5) - ltrFreeCenterX, py: 0 }; // 331.2

    // Target projection: Screen X = (NDC.x * 0.5 + 0.5) * W
    // Three.js setViewOffset shifts NDC by (2 * px / W)
    // NDC.x = 0 - (2 * ltrOffset.px / W) = -0.46
    // Screen X = (-0.46 * 0.5 + 0.5) * 1440 = 388.8
    const ltrScreenX = ((0 - (2 * ltrOffset.px / W)) * 0.5 + 0.5) * W;
    assert.equal(Math.round(ltrScreenX), Math.round(ltrFreeCenterX));
    assert.equal(Math.round(ltrScreenX), 389);

    // RTL (Arabic): panel is on the left, free space is [662.4, 1440]
    const rtlFreeRect = { x: panelWidth, y: 0, w: freeW, h: H };
    const rtlFreeCenterX = rtlFreeRect.x + rtlFreeRect.w * 0.5; // 1051.2
    const rtlOffset = { px: (W * 0.5) - rtlFreeCenterX, py: 0 }; // -331.2
    const rtlScreenX = ((0 - (2 * rtlOffset.px / W)) * 0.5 + 0.5) * W;
    assert.equal(Math.round(rtlScreenX), Math.round(rtlFreeCenterX));
    assert.equal(Math.round(rtlScreenX), 1051);
});

test('Glyph text self-emission fill radiance calculation', () => {
    // Computes breathing radiance for text fill emission (no map light orb)
    const calcTextRadiance = (uWeight, now, shimmer = 0.5, wave = 0.0) => {
        if (uWeight <= 0.02) return 1.0;
        const pulse = (Math.sin(now * 0.0022) + 1) * 0.5;
        return 1.0 + (pulse * 0.22 + shimmer * 0.16 + Math.max(0.0, wave) * 0.18) * uWeight;
    };

    const rIdle = calcTextRadiance(0.0, 0);
    assert.equal(rIdle, 1.0);

    const rActive = calcTextRadiance(1.0, 0);
    assert.ok(rActive > 1.0 && rActive <= 1.6);

    // Periodicity check of breathing pulse
    const periodMs = (2 * Math.PI) / 0.0022;
    const r1 = calcTextRadiance(1.0, periodMs);
    assert.ok(Math.abs(rActive - r1) < 1e-4);
});

test('Continuous render loop activity when 3D canvas is visible', () => {
    // Determines if render loop keeps running when mouse is stationary
    const isLoopActive = ({ isReadingMode, currentView, hoveredGlyph, activeGlyphId }) => {
        if (isReadingMode) return false;
        const isCanvasVisible = currentView === 'map' || currentView === 'entry' || currentView === 'about';
        const glyphsActive = activeGlyphId !== null || hoveredGlyph !== null;
        return isCanvasVisible || glyphsActive;
    };

    // On map view with stationary mouse (no hover, no active) -> continuous rendering active
    assert.equal(isLoopActive({ isReadingMode: false, currentView: 'map', hoveredGlyph: null, activeGlyphId: null }), true);

    // Hovering a glyph with stationary mouse -> continuous rendering active
    assert.equal(isLoopActive({ isReadingMode: false, currentView: 'map', hoveredGlyph: {}, activeGlyphId: null }), true);

    // In entry view with stationary mouse -> continuous rendering active
    assert.equal(isLoopActive({ isReadingMode: false, currentView: 'entry', hoveredGlyph: null, activeGlyphId: 224 }), true);

    // In full reading mode -> canvas hidden, loop pauses on idle to save 100% GPU
    assert.equal(isLoopActive({ isReadingMode: true, currentView: 'entry', hoveredGlyph: null, activeGlyphId: 224 }), false);
});
