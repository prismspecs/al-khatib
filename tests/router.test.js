import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/state.js';
import { createRouter } from '../src/router.js';

// Setup minimal window.location mock for Node test environment
function setupWindowMock(initialHash = '') {
    const listeners = {};
    global.window = {
        location: {
            hash: initialHash
        },
        matchMedia: () => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        addEventListener(event, fn) {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
        },
        removeEventListener(event, fn) {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(cb => cb !== fn);
            }
        },
        dispatchEvent(event) {
            if (listeners[event]) {
                listeners[event].forEach(fn => fn());
            }
        }
    };
}

test('router defaults to threshold view on cold visit without hash', () => {
    setupWindowMock('');
    const store = createStore();
    const router = createRouter(store);
    router.init();

    assert.equal(store.get().view, 'threshold');
    router.cleanup();
});

test('router parses #/map and switches store view to map', () => {
    setupWindowMock('#/map');
    const store = createStore();
    const router = createRouter(store);
    router.init();

    assert.equal(store.get().view, 'map');
    router.cleanup();
});

test('router parses deep links #/e/<slug> and skips threshold', () => {
    setupWindowMock('#/e/weltrechtsprinzip');
    const store = createStore();
    const router = createRouter(store);
    router.init();

    assert.equal(store.get().view, 'entry');
    assert.equal(store.get().activeSlug, 'weltrechtsprinzip');
    router.cleanup();
});

test('router handles query parameter ?lang=ar and updates store', () => {
    setupWindowMock('#/?lang=ar');
    const store = createStore({ defaultLang: 'de' });
    const router = createRouter(store);
    router.init();

    assert.equal(store.get().lang, 'ar');
    assert.equal(store.get().view, 'threshold');
    router.cleanup();
});
