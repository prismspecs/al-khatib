import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/state.js';
import { t } from '../src/i18n.js';

test('i18n returns correct strings in DE, EN, AR', () => {
    assert.equal(t('de', 'siteTitle'), 'Al-Khatib-Glossar');
    assert.equal(t('en', 'siteTitle'), 'Al-Khatib-Glossar');
    assert.equal(t('ar', 'siteTitle'), 'معجم الخطيب');

    assert.equal(t('de', 'readCounter', 12, 35), '12 / 35 gelesen');
    assert.equal(t('en', 'readCounter', 12, 35), '12 / 35 read');
    assert.equal(t('ar', 'readCounter', 12, 35), '12 / 35 مقروء');
});

test('store manages read state and emits notifications', () => {
    const store = createStore({ defaultLang: 'de' });
    let lastKey = null;

    store.subscribe((state, key, val) => {
        lastKey = key;
    });

    assert.equal(store.get().lang, 'de');
    store.setLang('ar');
    assert.equal(store.get().lang, 'ar');
    assert.equal(lastKey, 'lang');

    assert.equal(store.isRead(224), false);
    store.setActiveEntry(224, 'slug-224');
    assert.equal(store.isRead(224), true);
    assert.equal(store.getReadCount(), 1);
});

test('setGlossary resolves pending deep link slug into activeId', () => {
    const store = createStore();
    let emittedActive = null;

    store.subscribe((state, key, val) => {
        if (key === 'active') emittedActive = val;
    });

    // Deep link arrived before glossary was fetched
    store.setActiveEntry(null, 'weltrechtsprinzip');
    assert.equal(store.get().activeId, null);

    // Glossary finishes loading
    store.setGlossary([
        { id: 224, slug: 'weltrechtsprinzip', title: 'weltrechtsprinzip' },
        { id: 220, slug: 'weltrecht-hinter-der-sonne', title: 'weltrecht' }
    ]);

    assert.equal(store.get().activeId, 224);
    assert.equal(emittedActive?.id, 224);
    assert.equal(store.isRead(224), true);
});

test('store manages isReadingMode state and emits notifications', () => {
    const store = createStore();
    let notifiedKey = null;
    let notifiedVal = null;

    store.subscribe((state, key, val) => {
        notifiedKey = key;
        notifiedVal = val;
    });

    assert.equal(store.get().isReadingMode, false);
    store.setReadingMode(true);
    assert.equal(store.get().isReadingMode, true);
    assert.equal(notifiedKey, 'readingMode');
    assert.equal(notifiedVal, true);

    store.setReadingMode(false);
    assert.equal(store.get().isReadingMode, false);
    assert.equal(notifiedVal, false);
});

