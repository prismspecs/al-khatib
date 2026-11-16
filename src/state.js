/**
 * Reactive state store for Al-Khatib Glossar.
 * Subscriptions allow chrome, router, and 3D scene to respond to state changes.
 */

const STORAGE_KEY_READ = 'akg_read_entries';
const STORAGE_KEY_LANG = 'akg_lang';
const STORAGE_KEY_READING_MODE = 'akg_reading_mode';

function getStoredReadEntries() {
    try {
        const item = localStorage.getItem(STORAGE_KEY_READ);
        return item ? new Set(JSON.parse(item)) : new Set();
    } catch {
        return new Set();
    }
}

function getStoredLang(fallback = 'de') {
    try {
        return localStorage.getItem(STORAGE_KEY_LANG) || fallback;
    } catch {
        return fallback;
    }
}

function getStoredReadingMode() {
    try {
        return sessionStorage.getItem(STORAGE_KEY_READING_MODE) === '1';
    } catch {
        return false;
    }
}

export function createStore(initialState = {}) {
    const prefersReducedMotion = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const state = {
        view: 'map', // 'threshold' | 'map' | 'entry' | 'index' | 'about'
        activeSlug: null,
        activeId: null,
        lang: initialState.defaultLang || getStoredLang('de'),
        isReadingMode: getStoredReadingMode(),
        readEntries: getStoredReadEntries(),
        reducedMotion: prefersReducedMotion,
        glossary: [],
        ...initialState
    };

    const listeners = new Set();

    const notify = (key, value) => {
        listeners.forEach(fn => fn(state, key, value));
    };

    return {
        get: () => state,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        setView: (view) => {
            if (state.view !== view) {
                state.view = view;
                notify('view', view);
            }
        },
        setActiveEntry: (id, slug = null) => {
            state.activeId = id;
            state.activeSlug = slug;
            if (id) {
                state.readEntries.add(id);
                try {
                    localStorage.setItem(STORAGE_KEY_READ, JSON.stringify([...state.readEntries]));
                } catch {}
            }
            notify('active', { id, slug });
        },
        setLang: (lang) => {
            if (state.lang !== lang) {
                state.lang = lang;
                try {
                    localStorage.setItem(STORAGE_KEY_LANG, lang);
                } catch {}
                if (typeof document !== 'undefined') {
                    document.documentElement.lang = lang;
                    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
                }
                notify('lang', lang);
            }
        },
        setGlossary: (items) => {
            state.glossary = items;
            // If an activeSlug was waiting for glossary data to arrive, resolve it now
            if (state.activeSlug && !state.activeId) {
                const found = items.find(g => g.slug === state.activeSlug || String(g.id) === state.activeSlug);
                if (found) {
                    state.activeId = found.id;
                    state.readEntries.add(found.id);
                    try {
                        localStorage.setItem(STORAGE_KEY_READ, JSON.stringify([...state.readEntries]));
                    } catch {}
                    notify('active', { id: found.id, slug: found.slug });
                }
            }
            notify('glossary', items);
        },
        isRead: (id) => state.readEntries.has(id),
        getReadCount: () => state.readEntries.size,
        setReadingMode: (isReading) => {
            const val = !!isReading;
            if (state.isReadingMode !== val) {
                state.isReadingMode = val;
                try {
                    sessionStorage.setItem(STORAGE_KEY_READING_MODE, val ? '1' : '0');
                } catch {}
                notify('readingMode', val);
            }
        }
    };
}
