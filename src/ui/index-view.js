import gsap from 'gsap';
import { t } from '../i18n.js';
import { showLayer, hideLayer, isLayerOpen } from './layer.js';

/**
 * Index View (PLAN.md §2.4 D & §6).
 * Full-screen glass overlay presenting all 35 entries as a typographic list/grid.
 * Filterable by type and language.
 * Hovering an entry moves the inspection lamp and brightens the glyph trace on the 3D relief behind the blur.
 * Keyboard accessible: Tab reaches every row, Enter opens entry, Esc closes index.
 */

export function createIndexView({ container, router, store, glyphsManager, lamp }) {
    const root = document.createElement('div');
    root.id = 'akg-index-overlay';
    root.className = 'akg-index-overlay';
    root.setAttribute('hidden', '');
    root.setAttribute('inert', '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Glossary Index');

    root.innerHTML = `
        <div class="index-inner">
            <header class="index-header">
                <div class="index-header-main">
                    <div class="index-title-group">
                        <h1 class="index-title" data-t="index">Index</h1>
                        <span class="index-count-badge" id="index-counter-readout">35 entries</span>
                    </div>
                    <button class="akg-chip close-btn" id="index-close-btn" title="Close Index (Esc)">
                        <span data-t="close"></span>
                        <span class="kbd-hint">[Esc]</span>
                    </button>
                </div>

                <div class="index-filters-bar">
                    <div class="filter-group type-filters" id="type-filters">
                        <!-- Type filter chips dynamically injected -->
                    </div>
                    <div class="filter-divider"></div>
                    <div class="filter-group lang-filters" id="lang-filters">
                        <button class="akg-chip filter-chip is-active" data-lang-filter="all" data-t="filterAll">All</button>
                        <button class="akg-chip filter-chip" data-lang-filter="de">DE</button>
                        <button class="akg-chip filter-chip" data-lang-filter="en">EN</button>
                        <button class="akg-chip filter-chip" data-lang-filter="ar">عربي</button>
                    </div>
                </div>
            </header>

            <main class="index-body" id="index-list" role="region" aria-label="Entries List">
                <!-- Entries rows dynamically rendered -->
            </main>
        </div>
    `;

    container.appendChild(root);

    const closeBtn = root.querySelector('#index-close-btn');
    const typeFiltersContainer = root.querySelector('#type-filters');
    const langFiltersContainer = root.querySelector('#lang-filters');
    const listContainer = root.querySelector('#index-list');
    const counterReadout = root.querySelector('#index-counter-readout');

    let activeTypeFilter = 'all';
    let activeLangFilter = 'all';
    let isOpen = false;
    let hoveredGlyphId = null;

    const getAvailableTypes = (glossary) => {
        const types = new Set();
        glossary.forEach(g => {
            if (g.type) {
                // Normalize e.g. "text-collage", "stimme", "video"
                types.add(g.type.toLowerCase().trim());
            }
        });
        return Array.from(types).sort();
    };

    const renderFilters = () => {
        const lang = store.get().lang;
        const glossary = store.get().glossary;
        const types = getAvailableTypes(glossary);

        typeFiltersContainer.innerHTML = '';

        // "All" chip
        const allBtn = document.createElement('button');
        allBtn.className = `akg-chip filter-chip ${activeTypeFilter === 'all' ? 'is-active' : ''}`;
        allBtn.textContent = t(lang, 'filterAll');
        allBtn.setAttribute('data-type-filter', 'all');
        allBtn.addEventListener('click', () => {
            activeTypeFilter = 'all';
            updateFilterSelection();
            renderList();
        });
        typeFiltersContainer.appendChild(allBtn);

        types.forEach(type => {
            const btn = document.createElement('button');
            btn.className = `akg-chip filter-chip ${activeTypeFilter === type ? 'is-active' : ''}`;
            btn.textContent = type;
            btn.setAttribute('data-type-filter', type);
            btn.addEventListener('click', () => {
                activeTypeFilter = type;
                updateFilterSelection();
                renderList();
            });
            typeFiltersContainer.appendChild(btn);
        });
    };

    const updateFilterSelection = () => {
        typeFiltersContainer.querySelectorAll('.filter-chip').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-type-filter') === activeTypeFilter);
        });
        langFiltersContainer.querySelectorAll('.filter-chip').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-lang-filter') === activeLangFilter);
        });
    };

    langFiltersContainer.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeLangFilter = btn.getAttribute('data-lang-filter');
            updateFilterSelection();
            renderList();
        });
    });

    const renderList = () => {
        const lang = store.get().lang;
        const glossary = store.get().glossary || [];
        const isRTL = lang === 'ar';

        root.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

        // Apply filters
        let filtered = glossary.filter(item => {
            // Type filter
            if (activeTypeFilter !== 'all') {
                const itemType = (item.type || '').toLowerCase().trim();
                if (itemType !== activeTypeFilter) return false;
            }
            // Language filter
            if (activeLangFilter !== 'all') {
                if (activeLangFilter === 'de' && !item.langs?.de) return false;
                if (activeLangFilter === 'en' && !item.langs?.en) return false;
                if (activeLangFilter === 'ar' && !item.langs?.ar) return false;
            }
            return true;
        });

        // Update read counter readout
        const total = glossary.length;
        const readCount = store.getReadCount();
        counterReadout.textContent = `${filtered.length} / ${total} — ${readCount} read`;

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="index-empty-state">
                    <p class="index-empty-text">${t(lang, 'emptyFilter')}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';

        filtered.forEach((item, index) => {
            const isRead = store.isRead(item.id);
            const numStr = String(index + 1).padStart(2, '0');

            const row = document.createElement('button');
            row.className = `index-row ${isRead ? 'is-read' : 'is-unread'}`;
            row.setAttribute('data-id', item.id);
            row.setAttribute('tabindex', '0');
            row.setAttribute('role', 'button');
            row.setAttribute('aria-label', `${item.title}, ${item.type}, ${isRead ? 'read' : 'unread'}`);

            // Image thumbnail
            const thumbSrc = item.imageURL || '';
            const thumbHtml = thumbSrc
                ? `<div class="index-row-thumb"><img src="${thumbSrc}" alt="" loading="lazy" decoding="async" /></div>`
                : `<div class="index-row-thumb placeholder-thumb">●</div>`;

            // Author credit
            const authorText = item.credits?.name || item.author || '';

            // Language badges
            const deBadge = `<span class="lang-dot ${item.langs?.de ? 'has-lang' : ''}">DE</span>`;
            const enBadge = `<span class="lang-dot ${item.langs?.en ? 'has-lang' : ''}">EN</span>`;
            const arBadge = `<span class="lang-dot ${item.langs?.ar ? 'has-lang' : ''}">AR</span>`;

            row.innerHTML = `
                <div class="index-row-meta">
                    <span class="index-read-bullet" title="${isRead ? 'read' : 'unread'}">
                        ${isRead ? '●' : '○'}
                    </span>
                    <span class="index-num">${numStr}</span>
                </div>

                ${thumbHtml}

                <div class="index-row-info">
                    <div class="index-row-title">${item.title}</div>
                    ${authorText ? `<div class="index-row-author">${authorText}</div>` : ''}
                </div>

                <div class="index-row-tags">
                    <span class="akg-badge index-type-badge">${item.type || 'text'}</span>
                    <div class="index-lang-dots">
                        ${deBadge}
                        ${enBadge}
                        ${arBadge}
                    </div>
                </div>
            `;

            // Row click -> navigate to entry
            row.addEventListener('click', () => {
                clearHover();
                hide(false);
                router.navigate(`#/e/${encodeURIComponent(item.slug || item.id)}`);
            });

            // Row hover -> aim inspection lamp and highlight glyph trace on 3D relief behind blur
            row.addEventListener('pointerenter', () => {
                setRowHover(item);
            });

            row.addEventListener('pointerleave', () => {
                clearHover();
            });

            listContainer.appendChild(row);
        });
    };

    const setRowHover = (item) => {
        hoveredGlyphId = item.id;
        if (glyphsManager) {
            const targetGlyph = glyphsManager.glyphs?.find(g => g.glyphData && g.glyphData.id === item.id);
            if (targetGlyph) {
                glyphsManager.setHovered(targetGlyph);
            }
        }
        if (lamp && item.position) {
            lamp.setPointerTarget(item.position);
        }
    };

    const clearHover = () => {
        hoveredGlyphId = null;
        if (glyphsManager) {
            glyphsManager.setHovered(null);
        }
    };

    const show = () => {
        isOpen = true;
        renderFilters();
        renderList();
        root.scrollTop = 0;
        showLayer(root);
    };

    const hide = (navigate = false, immediate = false) => {
        if (!isOpen && root.hasAttribute('hidden')) return;
        isOpen = false;
        clearHover();
        hideLayer(root, { immediate });

        if (navigate && router && store.get().view === 'index') {
            router.navigate('#/map');
        }
    };

    closeBtn.addEventListener('click', () => hide(true));

    // Keyboard shortcuts
    const onKeyDown = (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            hide(true);
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // State subscriptions
    store.subscribe((state, key) => {
        if (isOpen && (key === 'lang' || key === 'read' || key === 'glossary')) {
            renderFilters();
            renderList();
        }
    });

    return {
        root,
        show,
        hide,
        isOpen: () => isLayerOpen(root),
        cleanup: () => {
            window.removeEventListener('keydown', onKeyDown);
            if (root.parentElement) root.parentElement.removeChild(root);
        }
    };
}
