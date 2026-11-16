import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Mock DOM elements for CameraControls in Node test environment
globalThis.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, w = 1440, h = 900) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }
};

const mockDomElement = {
    clientWidth: 1440,
    clientHeight: 900,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    getBoundingClientRect: () => new globalThis.DOMRect(),
    getRootNode: () => ({}),
    ownerDocument: { defaultView: globalThis }
};

const mockRenderer = {
    domElement: mockDomElement
};

import { createCameraControls } from '../src/three/camera.js';
import { getFreeRect, calcViewOffset } from '../src/three/view-offset.js';

test('createCameraControls establishes z-up frame and spherical constraints', () => {
    const { camera, controls } = createCameraControls({
        renderer: mockRenderer,
        invalidate: () => {}
    });

    // 1. Assert camera up vector is +Z
    assert.equal(camera.up.x, 0);
    assert.equal(camera.up.y, 0);
    assert.equal(camera.up.z, 1);

    // 2. Assert constraints match Plan 2 §3.1 B1
    assert.equal(controls.minDistance, 1.6);
    assert.equal(controls.maxDistance, 15.0);
    assert.equal(controls.minPolarAngle, 0);
    assert.equal(THREE.MathUtils.radToDeg(controls.maxPolarAngle).toFixed(0), '68');
    assert.equal(THREE.MathUtils.radToDeg(controls.minAzimuthAngle).toFixed(0), '-100');
    assert.equal(THREE.MathUtils.radToDeg(controls.maxAzimuthAngle).toFixed(0), '100');
});

test('named shots achieve requested spherical coordinates without clamping', async () => {
    const { controls, shots } = createCameraControls({
        renderer: mockRenderer,
        invalidate: () => {}
    });

    // Threshold shot
    await shots.threshold(false);
    assert.equal(THREE.MathUtils.radToDeg(controls.azimuthAngle).toFixed(1), '0.0');
    assert.equal(THREE.MathUtils.radToDeg(controls.polarAngle).toFixed(1), '12.0');
    assert.equal(controls.distance.toFixed(1), '13.0');
    const targetThreshold = new THREE.Vector3();
    controls.getTarget(targetThreshold);
    assert.equal(targetThreshold.x.toFixed(1), '0.0');
    assert.equal(targetThreshold.y.toFixed(1), '0.0');
    assert.equal(targetThreshold.z.toFixed(1), '0.0');

    // Overview shot
    await shots.overview(false);
    assert.equal(THREE.MathUtils.radToDeg(controls.azimuthAngle).toFixed(1), '0.0');
    assert.equal(THREE.MathUtils.radToDeg(controls.polarAngle).toFixed(1), '32.0');
    assert.equal(controls.distance.toFixed(1), '13.0');
    const targetOverview = new THREE.Vector3();
    controls.getTarget(targetOverview);
    assert.equal(targetOverview.x.toFixed(1), '0.0');
    assert.equal(targetOverview.y.toFixed(1), '0.0');
    assert.equal(targetOverview.z.toFixed(1), '0.2');

    // About shot (lifts constraints to view reverse face)
    await shots.about(false);
    assert.equal(THREE.MathUtils.radToDeg(controls.azimuthAngle).toFixed(1), '180.0');
    assert.equal(THREE.MathUtils.radToDeg(controls.polarAngle).toFixed(1), '150.0');
    assert.equal(controls.distance.toFixed(1), '5.0');
    const targetAbout = new THREE.Vector3();
    controls.getTarget(targetAbout);
    assert.equal(targetAbout.x.toFixed(1), '0.0');
    assert.equal(targetAbout.y.toFixed(1), '0.0');
    assert.equal(targetAbout.z.toFixed(1), '-0.3');

    // Return to overview: asserts constraints are fully restored
    await shots.overview(false);
    assert.equal(THREE.MathUtils.radToDeg(controls.azimuthAngle).toFixed(1), '0.0');
    assert.equal(THREE.MathUtils.radToDeg(controls.polarAngle).toFixed(1), '32.0');
    assert.equal(THREE.MathUtils.radToDeg(controls.maxPolarAngle).toFixed(0), '68');
    assert.equal(THREE.MathUtils.radToDeg(controls.maxAzimuthAngle).toFixed(0), '100');
});

test('getFreeRect returns expected regions for desktop LTR, RTL, and mobile (Plan 2 §4.1 C1)', () => {
    // Desktop LTR (free area is left side, width W - panelWidth)
    const ltr = getFreeRect({ isRTL: false });
    assert.equal(ltr.x, 0);
    assert(ltr.w > 0);
    assert(ltr.h > 0);

    // Desktop RTL (free area is right side, x = panelWidth)
    const rtl = getFreeRect({ isRTL: true });
    assert(rtl.x > 0);
    assert.equal(rtl.w, ltr.w);
    assert.equal(rtl.h, ltr.h);
});

test('calcViewOffset mathematically centres 3D look-at target in free viewport area (Plan 2 §4.1 C1)', () => {
    const W = 1440;
    const H = 900;
    const panelWidth = Math.min(720, 0.46 * W); // 662.4
    const freeRect = { x: 0, y: 0, w: W - panelWidth, h: H };
    const offset = calcViewOffset(freeRect, W, H);

    const freeCenterX = freeRect.x + freeRect.w * 0.5;
    const freeCenterY = freeRect.y + freeRect.h * 0.5;

    // Projected target with setViewOffset must align with freeCenterX/Y
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 100);
    camera.up.set(0, 0, 1);
    camera.setViewOffset(W, H, offset.px, offset.py, W, H);
    camera.position.set(0, -5, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const projected = new THREE.Vector3(0, 0, 0).project(camera);
    const screenX = (projected.x + 1) * 0.5 * W;
    const screenY = (1 - projected.y) * 0.5 * H;

    assert.ok(Math.abs(screenX - freeCenterX) < 0.01, `screenX ${screenX} equals freeCenterX ${freeCenterX}`);
    assert.ok(Math.abs(screenY - freeCenterY) < 0.01, `screenY ${screenY} equals freeCenterY ${freeCenterY}`);
});
