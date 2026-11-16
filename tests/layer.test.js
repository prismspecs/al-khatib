import test from 'node:test';
import assert from 'node:assert/strict';
import { showLayer, hideLayer, isLayerOpen } from '../src/ui/layer.js';

function createMockElement() {
    const classes = new Set();
    const attrs = new Map();
    const listeners = {};

    return {
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c)
        },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        removeAttribute: (k) => attrs.delete(k),
        getAttribute: (k) => attrs.get(k),
        hasAttribute: (k) => attrs.has(k),
        addEventListener: (event, fn) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
        },
        removeEventListener: (event, fn) => {
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter(cb => cb !== fn);
        },
        dispatchMockEvent: (event, data = {}) => {
            if (!listeners[event]) return;
            const ev = { ...data, target: null };
            listeners[event].forEach(fn => fn(ev));
        },
        offsetWidth: 100
    };
}

test('showLayer removes hidden & inert, adds is-open', () => {
    const el = createMockElement();
    el.setAttribute('hidden', '');
    el.setAttribute('inert', '');

    showLayer(el);

    assert.equal(el.hasAttribute('hidden'), false);
    assert.equal(el.hasAttribute('inert'), false);
    assert.equal(el.classList.contains('is-open'), true);
    assert.equal(isLayerOpen(el), true);
});

test('hideLayer immediate removes is-open, sets inert & hidden', () => {
    const el = createMockElement();
    showLayer(el);
    assert.equal(isLayerOpen(el), true);

    hideLayer(el, { immediate: true });

    assert.equal(el.classList.contains('is-open'), false);
    assert.equal(el.hasAttribute('inert'), true);
    assert.equal(el.hasAttribute('hidden'), true);
    assert.equal(isLayerOpen(el), false);
});

test('hideLayer on transitionend sets hidden', () => {
    const el = createMockElement();
    showLayer(el);

    hideLayer(el);

    assert.equal(el.classList.contains('is-open'), false);
    assert.equal(el.hasAttribute('inert'), true);
    assert.equal(el.hasAttribute('hidden'), false); // Animating out

    // Simulate transitionend
    if (el._onTransitionEnd) {
        el._onTransitionEnd({ target: el });
    }

    assert.equal(el.hasAttribute('hidden'), true);
    assert.equal(isLayerOpen(el), false);
});

test('showLayer cancels pending hide transition', () => {
    const el = createMockElement();
    showLayer(el);
    hideLayer(el);
    assert.equal(el.hasAttribute('inert'), true);

    // Re-open before transition ends
    showLayer(el);
    assert.equal(el.hasAttribute('inert'), false);
    assert.equal(el.hasAttribute('hidden'), false);
    assert.equal(el.classList.contains('is-open'), true);
    assert.equal(isLayerOpen(el), true);
});
