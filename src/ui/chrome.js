import { t } from '../i18n.js';

/**
 * Builds and binds persistent chrome:
 * - Wordmark (top-left)
 * - Index / About chips and Language selector (top-right)
 * - Navigation hint (bottom-left, fades after interaction)
 * - Read counter chip (bottom-right)
 */

export function createChrome({ container, store, router, onThresholdClick }) {
    const root = document.createElement('div');
    root.id = 'chrome-layer';

    root.innerHTML = `
        <div class="chrome-top-left">
            <a href="#/" class="site-wordmark" id="chrome-wordmark" data-t="siteTitle"></a>
        </div>

        <div class="chrome-top-right">
            <button class="akg-chip" id="chip-index" title="Toggle Index (I)">
                <span data-t="index"></span>
                <span class="kbd-hint">[I]</span>
            </button>
            <button class="akg-chip" id="chip-about" title="Toggle About (A)">
                <span data-t="about"></span>
                <span class="kbd-hint">[A]</span>
            </button>
            <div class="akg-chip-group" style="display:flex;gap:4px;">
                <button class="akg-chip lang-chip" data-lang="de">DE</button>
                <button class="akg-chip lang-chip" data-lang="en">EN</button>
                <button class="akg-chip lang-chip" data-lang="ar">عربي</button>
            </div>
        </div>

        <div class="chrome-bottom-left" id="chrome-hint">
            <span data-t="hint"></span>
        </div>

        <div class="chrome-bottom-right">
            <div class="akg-chip" id="chip-counter">
                <span id="counter-text"></span>
            </div>
        </div>
    `;

    container.appendChild(root);

    const updateTexts = () => {
        const lang = store.get().lang;
        root.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            el.textContent = t(lang, key);
        });

        // Highlight active lang chip
        root.querySelectorAll('.lang-chip').forEach(el => {
            el.classList.toggle('is-active', el.getAttribute('data-lang') === lang);
        });

        // Update read counter
        const total = store.get().glossary.length || 35;
        const read = store.getReadCount();
        const counterText = document.getElementById('counter-text');
        if (counterText) {
            counterText.textContent = t(lang, 'readCounter', read, total);
        }
    };

    // Subscriptions
    store.subscribe((state, key) => {
        if (key === 'lang' || key === 'glossary' || key === 'active') {
            updateTexts();
        }
        if (key === 'view') {
            const isThreshold = state.view === 'threshold';
            root.style.display = isThreshold ? 'none' : 'block';
            root.classList.toggle('chrome--panel-open', state.view === 'entry' || state.view === 'about');
            document.getElementById('chip-index')?.classList.toggle('is-active', state.view === 'index');
            document.getElementById('chip-about')?.classList.toggle('is-active', state.view === 'about');
        }
    });

    // Wire clicks
    document.getElementById('chrome-wordmark')?.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate('#/');
    });

    document.getElementById('chip-index')?.addEventListener('click', () => {
        const cur = store.get().view;
        router.navigate(cur === 'index' ? '#/map' : '#/index');
    });

    document.getElementById('chip-about')?.addEventListener('click', () => {
        const cur = store.get().view;
        router.navigate(cur === 'about' ? '#/map' : '#/about');
    });

    root.querySelectorAll('.lang-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            store.setLang(btn.getAttribute('data-lang'));
        });
    });

    // Fade out hint line after user interaction
    let hintFaded = false;
    const fadeHint = () => {
        if (!hintFaded) {
            hintFaded = true;
            const hint = document.getElementById('chrome-hint');
            if (hint) hint.style.opacity = '0';
        }
    };

    window.addEventListener('pointerdown', fadeHint, { once: true });
    window.addEventListener('wheel', fadeHint, { once: true });

    // Keyboard Shortcuts (I = Index, A = About, Esc = Close)
    const onKeyDown = (e) => {
        if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        if (e.key === 'i' || e.key === 'I') {
            const cur = store.get().view;
            router.navigate(cur === 'index' ? '#/map' : '#/index');
        } else if (e.key === 'a' || e.key === 'A') {
            const cur = store.get().view;
            router.navigate(cur === 'about' ? '#/map' : '#/about');
        }
    };
    window.addEventListener('keydown', onKeyDown);

    updateTexts();

    return {
        root,
        updateTexts,
        cleanup: () => {
            window.removeEventListener('keydown', onKeyDown);
            if (root.parentElement) root.parentElement.removeChild(root);
        }
    };
}
