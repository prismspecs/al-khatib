/**
 * Hash router for Al-Khatib Glossar.
 * Handles routes: #/ (Threshold), #/map, #/e/<slug>, #/index, #/about, ?lang=
 */

export function createRouter(store) {
    const parseHash = () => {
        const hash = (typeof window !== 'undefined' ? window.location.hash : '') || '#/threshold';
        const [pathWithQuery] = hash.split('?');
        const queryIdx = hash.indexOf('?');
        const queryStr = queryIdx !== -1 ? hash.substring(queryIdx + 1) : '';
        const params = new URLSearchParams(queryStr);

        const langParam = params.get('lang');
        if (langParam && ['de', 'en', 'ar'].includes(langParam)) {
            store.setLang(langParam);
        }

        const path = pathWithQuery.replace(/^#\/?/, '').trim();

        if (path === '' || path === 'threshold') {
            return { view: 'threshold' };
        } else if (path === 'map') {
            return { view: 'map' };
        } else if (path === 'index') {
            return { view: 'index' };
        } else if (path === 'about') {
            return { view: 'about' };
        } else if (path.startsWith('e/')) {
            const rawSlug = path.substring(2);
            let slug = rawSlug;
            try {
                slug = decodeURIComponent(rawSlug);
            } catch {}
            return { view: 'entry', slug };
        }

        return { view: 'map' };
    };

    const handleRouteChange = () => {
        const route = parseHash();
        store.setView(route.view);

        if (route.view === 'entry') {
            const glossary = store.get().glossary;
            const entry = glossary.find(g => g.slug === route.slug || String(g.id) === route.slug);
            if (entry) {
                store.setActiveEntry(entry.id, entry.slug);
            } else {
                store.setActiveEntry(null, route.slug);
            }
        } else if (route.view !== 'entry') {
            store.setActiveEntry(null, null);
        }
    };

    let isHandlingNavigate = false;

    const onHashChange = () => {
        if (isHandlingNavigate) {
            isHandlingNavigate = false;
            return;
        }
        handleRouteChange();
    };

    window.addEventListener('hashchange', onHashChange);

    const navigate = (path) => {
        const targetHash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
        if (window.location.hash !== targetHash) {
            isHandlingNavigate = true;
            window.location.hash = targetHash;
        }
        handleRouteChange();
    };

    return {
        init: () => handleRouteChange(),
        navigate,
        cleanup: () => window.removeEventListener('hashchange', onHashChange)
    };
}
