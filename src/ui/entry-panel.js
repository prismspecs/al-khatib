import { sanitizeEntryHtml } from './sanitize.js';
import { normalizeEntryHtml } from './normalize.js';
import { createAudioPlayer } from './player.js';
import { showLayer, hideLayer, isLayerOpen } from './layer.js';
import { getTintedGlyphUrl } from './glyph-image.js';
import { t } from '../i18n.js';

/**
 * Entry Panel UI Component
 * PLAN-3-entry-content.md §4 C1, C2, C3, C7
 */

export function createEntryPanel({ container = document.getElementById('ui-root'), router, store, glyphsManager }) {
    if (!container) return null;

    let panel = document.getElementById('entry-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'entry-panel';
        panel.className = 'akg-panel';
        panel.setAttribute('hidden', '');
        panel.setAttribute('inert', '');
        panel.innerHTML = `
            <div class="sheet-drag-handle" aria-hidden="true"></div>
            <header class="panel-header">
                <div class="panel-header-left">
                    <a href="#/map" class="panel-wordmark" data-t="siteTitle">al-khatib</a>
                    <div class="entry-meta-left">
                        <span class="entry-type"></span>
                        <span class="entry-index-counter"></span>
                        <div class="entry-meta-langs"></div>
                    </div>
                </div>
                <div class="entry-meta-right">
                    <button type="button" class="akg-chip entry-expand-btn" aria-label="Expand view">
                        <span class="expand-label">Expand</span>
                        <span class="kbd-hint">[F]</span>
                    </button>
                    <button type="button" class="akg-chip entry-close-btn" aria-label="Close entry">
                        <span class="close-label">Close</span>
                        <span class="kbd-hint">[Esc]</span>
                    </button>
                </div>
            </header>
            <div class="reading-progress">
                <div class="reading-progress-fill"></div>
            </div>
            <div class="entry-availability-note" style="display: none;"></div>
            <div class="panel-scroll">
                <div class="reading-grid">
                    <aside class="rail rail-start">
                        <div class="rail-drawing-wrap">
                            <img class="rail-drawing" src="" alt="Glyph trace" style="display: none;" />
                        </div>
                        <div class="rail-meta">
                            <span class="rail-type"></span>
                            <span class="rail-counter"></span>
                        </div>
                        <div class="rail-langs"></div>
                        <div class="rail-credits"></div>
                    </aside>
                    <main class="reading-center">
                        <div class="entry-head">
                            <div class="entry-emblem">
                                <img class="entry-drawing" src="" alt="Glyph trace" style="display: none;" />
                            </div>
                            <h1 class="entry-title"></h1>
                            <div class="entry-credits"></div>
                        </div>
                        <div class="entry-media">
                            <div class="entry-player-slot"></div>
                        </div>
                        <div class="entry-body">
                            <div class="entry-body-content"></div>
                        </div>
                        <div class="entry-notes" style="display: none;"></div>
                        <div class="entry-related" style="display: none;">
                            <div class="entry-related-title">Related</div>
                            <div class="entry-related-list"></div>
                        </div>
                        <nav class="entry-footer-nav">
                            <a href="javascript:void(0);" class="nav-link nav-prev">
                                <img class="nav-drawing" src="" alt="" style="display: none;" />
                                <div class="nav-text">
                                    <span class="nav-meta"><span class="nav-arrow">←</span> <span class="nav-label">prev</span> <span class="kbd-hint">[←]</span></span>
                                    <span class="nav-title"></span>
                                </div>
                            </a>
                            <a href="javascript:void(0);" class="nav-link nav-next">
                                <div class="nav-text">
                                    <span class="nav-meta"><span class="nav-label">next</span> <span class="nav-arrow">→</span> <span class="kbd-hint">[→]</span></span>
                                    <span class="nav-title"></span>
                                </div>
                                <img class="nav-drawing" src="" alt="" style="display: none;" />
                            </a>
                        </nav>
                    </main>
                    <aside class="rail rail-end">
                        <div class="rail-notes" style="display: none;"></div>
                        <div class="rail-related" style="display: none;">
                            <div class="rail-related-title">Related</div>
                            <div class="rail-related-list"></div>
                        </div>
                    </aside>
                </div>
            </div>
        `;
        container.appendChild(panel);
    }

    const panelScroll = panel.querySelector('.panel-scroll');
    const progressFill = panel.querySelector('.reading-progress-fill');
    const wordmarkEl = panel.querySelector('.panel-wordmark');
    const typeEl = panel.querySelector('.entry-type');
    const counterEl = panel.querySelector('.entry-index-counter');
    const langsEl = panel.querySelector('.entry-meta-langs');
    const expandBtn = panel.querySelector('.entry-expand-btn');
    const expandLabel = panel.querySelector('.expand-label');
    const closeBtn = panel.querySelector('.entry-close-btn');
    const closeLabel = panel.querySelector('.close-label');
    const noteEl = panel.querySelector('.entry-availability-note');
    const drawingEl = panel.querySelector('.entry-drawing');
    const titleEl = panel.querySelector('.entry-title');
    const creditsEl = panel.querySelector('.entry-credits');
    const playerSlot = panel.querySelector('.entry-player-slot');
    const bodyContent = panel.querySelector('.entry-body-content');
    const notesSection = panel.querySelector('.reading-center .entry-notes');
    const relatedSection = panel.querySelector('.reading-center .entry-related');
    const relatedTitleEl = panel.querySelector('.reading-center .entry-related-title');
    const relatedList = panel.querySelector('.reading-center .entry-related-list');
    const prevLink = panel.querySelector('.nav-prev');
    const nextLink = panel.querySelector('.nav-next');
    const prevLabel = prevLink.querySelector('.nav-label');
    const nextLabel = nextLink.querySelector('.nav-label');
    const prevDrawing = prevLink.querySelector('.nav-drawing');
    const nextDrawing = nextLink.querySelector('.nav-drawing');

    // Rail elements for reading mode (Plan 3 Part B §3, §4 C1, C3)
    const railDrawing = panel.querySelector('.rail-drawing');
    const railType = panel.querySelector('.rail-type');
    const railCounter = panel.querySelector('.rail-counter');
    const railLangs = panel.querySelector('.rail-langs');
    const railCredits = panel.querySelector('.rail-credits');
    const railNotesSection = panel.querySelector('.rail-end .rail-notes');
    const railRelatedSection = panel.querySelector('.rail-end .rail-related');
    const railRelatedTitle = panel.querySelector('.rail-end .rail-related-title');
    const railRelatedList = panel.querySelector('.rail-end .rail-related-list');

    let currentEntry = null;
    let currentPlayer = null;
    let isExpanded = false;
    let savedSideScrollTop = 0;
    let currentDisplayedLang = 'de';

    // Reading progress tracking on panel-scroll (Plan 3 §4 C1, C7)
    panelScroll.addEventListener('scroll', () => {
        const total = panelScroll.scrollHeight - panelScroll.clientHeight;
        const pct = total > 0 ? (panelScroll.scrollTop / total) * 100 : 0;
        progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }, { passive: true });

    // Expand toggle [F]
    const toggleExpand = (targetState) => {
        const nextState = typeof targetState === 'boolean' ? targetState : !isExpanded;
        if (nextState === isExpanded) return;

        if (nextState) {
            // Entering reading mode: save scroll position in side panel
            savedSideScrollTop = panelScroll.scrollTop;
        }

        isExpanded = nextState;
        store?.setReadingMode(isExpanded);

        // Content cross-fade without layout animation of text (Plan 3 §3)
        panel.classList.add('is-morphing');
        panel.classList.toggle('is-expanded', isExpanded);
        document.body.classList.toggle('is-reading-mode', isExpanded);
        expandBtn.classList.toggle('is-active', isExpanded);
        expandLabel.textContent = isExpanded ? t(currentDisplayedLang, 'collapse') : t(currentDisplayedLang, 'expand');

        if (!isExpanded) {
            // Collapsing back to side panel: restore exact previous scroll position (Plan 3 §3)
            panelScroll.scrollTop = savedSideScrollTop;
        }

        setTimeout(() => {
            panel.classList.remove('is-morphing');
        }, 320);
    };
    expandBtn.addEventListener('click', () => toggleExpand());

    if (wordmarkEl) {
        wordmarkEl.addEventListener('click', (e) => {
            e.preventDefault();
            close(true);
        });
    }

    // Close button [Esc]
    const close = (navigate = true, immediate = false) => {
        if (currentPlayer) {
            currentPlayer.pause();
        }
        pauseAllMedia();
        hideLayer(panel, { immediate });
        document.body.classList.remove('is-reading-mode');
        if (router && navigate && store.get().view === 'entry') {
            router.navigate('#/map');
        }
    };
    closeBtn.addEventListener('click', () => close(true));

    const pauseAllMedia = () => {
        panel.querySelectorAll('audio, video').forEach(media => {
            try {
                media.pause();
            } catch {}
        });
    };

    // Keyboard handlers (Plan 3 §3: first Esc leaves reading mode, second closes)
    const onKeyDown = (e) => {
        if (panel.classList.contains('is-hidden') || panel.hasAttribute('hidden')) return;
        if (e.target.matches('input, textarea')) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (isExpanded) {
                // First Esc: leaves reading mode, restores side panel
                toggleExpand(false);
                return;
            }
            // Second Esc: closes entry panel
            close(true);
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleExpand();
        } else if (e.key === 'ArrowLeft') {
            if (prevLink && prevLink.style.display !== 'none' && prevLink.entrySlug) {
                e.preventDefault();
                router.navigate(`#/e/${encodeURIComponent(prevLink.entrySlug)}`);
            }
        } else if (e.key === 'ArrowRight') {
            if (nextLink && nextLink.style.display !== 'none' && nextLink.entrySlug) {
                e.preventDefault();
                router.navigate(`#/e/${encodeURIComponent(nextLink.entrySlug)}`);
            }
        }
    };
    window.addEventListener('keydown', onKeyDown);

    /**
     * Updates translated strings for panel chrome.
     */
    function updateI18nLabels(lang) {
        expandLabel.textContent = isExpanded ? t(lang, 'collapse') : t(lang, 'expand');
        closeLabel.textContent = t(lang, 'close');
        relatedTitleEl.textContent = t(lang, 'related');
        if (railRelatedTitle) railRelatedTitle.textContent = t(lang, 'related');
        if (wordmarkEl) wordmarkEl.textContent = t(lang, 'siteTitle');
        if (prevLabel) prevLabel.textContent = t(lang, 'prev');
        if (nextLabel) nextLabel.textContent = t(lang, 'next');
    }

    /**
     * Opens and renders the entry data.
     */
    const open = (entryData, allEntries = []) => {
        if (!entryData) return;
        currentEntry = entryData;

        // Cleanup previous audio player if any
        if (currentPlayer) {
            currentPlayer.cleanup();
            currentPlayer = null;
        }
        playerSlot.innerHTML = '';
        pauseAllMedia();

        panelScroll.scrollTop = 0;
        progressFill.style.width = '0%';

        // Check session persistence for reading mode
        const isReadingPersisted = store?.get().isReadingMode || false;
        isExpanded = isReadingPersisted;
        panel.classList.toggle('is-expanded', isExpanded);
        document.body.classList.toggle('is-reading-mode', isExpanded);
        expandBtn.classList.toggle('is-active', isExpanded);
        expandLabel.textContent = isExpanded ? t(currentDisplayedLang, 'collapse') : t(currentDisplayedLang, 'expand');

        // 1. Meta row: Type & Index counter
        const typeText = entryData.type ? entryData.type.toUpperCase() : 'TEXT';
        typeEl.textContent = typeText;
        if (railType) railType.textContent = typeText;

        // Alphabetical index counter (e.g. 04 / 35)
        const sorted = [...allEntries].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        const entryIdx = sorted.findIndex(e => e.id === entryData.id);
        if (entryIdx !== -1) {
            const num = (entryIdx + 1).toString().padStart(2, '0');
            const total = sorted.length.toString().padStart(2, '0');
            counterEl.textContent = `${num} / ${total}`;
            if (railCounter) railCounter.textContent = `${num} / ${total}`;
        } else {
            counterEl.textContent = '';
            if (railCounter) railCounter.textContent = '';
        }

        // 2. Language selection with availability fallback (PLAN.md §2.4 C)
        const globalLang = store.get().lang;
        const availableLangs = [];
        if (entryData.langs?.de) availableLangs.push('de');
        if (entryData.langs?.en) availableLangs.push('en');
        if (entryData.langs?.ar) availableLangs.push('ar');

        // Edge case: Entry 31 (Arabic only) or missing global lang
        let targetLang = globalLang;
        if (!availableLangs.includes(targetLang)) {
            targetLang = availableLangs.length > 0 ? availableLangs[0] : 'de';
        }
        currentDisplayedLang = targetLang;
        updateI18nLabels(currentDisplayedLang);

        // Render Language chips
        langsEl.innerHTML = '';
        if (railLangs) railLangs.innerHTML = '';
        availableLangs.forEach(langCode => {
            const createLangChip = () => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `akg-chip akg-chip-lang ${langCode === currentDisplayedLang ? 'is-active' : ''}`;
                btn.style.height = '22px';
                btn.style.paddingInline = '6px';
                btn.style.fontSize = '10px';
                btn.textContent = langCode.toUpperCase();
                btn.addEventListener('click', () => {
                    if (langCode === currentDisplayedLang) return;
                    pauseAllMedia();
                    bodyContent.classList.add('is-switching');
                    setTimeout(() => {
                        currentDisplayedLang = langCode;
                        updateI18nLabels(currentDisplayedLang);
                        renderContent(entryData, currentDisplayedLang, globalLang);
                        panelScroll.scrollTop = 0;
                        bodyContent.classList.remove('is-switching');
                        panel.querySelectorAll('.akg-chip-lang').forEach(c => {
                            c.classList.toggle('is-active', c.textContent.trim().toLowerCase() === langCode);
                        });
                    }, 200);
                });
                return btn;
            };
            langsEl.appendChild(createLangChip());
            if (railLangs) railLangs.appendChild(createLangChip());
        });

        // 3. Title & Tinted Glyph Emblem (Plan 3 §4 C3)
        const tmp = document.createElement('div');
        tmp.innerHTML = entryData.title || '';
        titleEl.textContent = (tmp.textContent || tmp.innerText || '').toLowerCase();

        if (entryData.imageURL) {
            drawingEl.style.display = 'block';
            if (railDrawing) railDrawing.style.display = 'block';
            getTintedGlyphUrl(entryData.imageURL, '#e26041', entryData.id).then(tinted => {
                if (drawingEl && currentEntry?.id === entryData.id) {
                    drawingEl.src = tinted;
                }
                if (railDrawing && currentEntry?.id === entryData.id) {
                    railDrawing.src = tinted;
                }
            });
        } else {
            drawingEl.style.display = 'none';
            if (railDrawing) railDrawing.style.display = 'none';
        }

        // 4. Contributors / Author credits definition list
        creditsEl.innerHTML = '';
        const credits = entryData.credits?.items || [];
        if (credits.length > 0) {
            credits.forEach(cr => {
                const item = document.createElement('div');
                item.className = 'entry-credit-item';
                item.innerHTML = `
                    <span class="credit-role">${escapeHtml(cr.role)}:</span>
                    <span class="credit-names">${escapeHtml(cr.names)}</span>
                `;
                creditsEl.appendChild(item);
            });
            creditsEl.style.display = 'flex';
        } else {
            creditsEl.style.display = 'none';
        }
        if (railCredits) {
            railCredits.innerHTML = creditsEl.innerHTML;
            railCredits.style.display = creditsEl.style.display;
        }

        // 5. Render body content & audio/video
        renderContent(entryData, currentDisplayedLang, globalLang);

        // 6. Related entries (56px drawings beside title, Plan 3 §4 C3)
        renderRelated(entryData, allEntries);

        // 7. Prev / Next Navigation in alphabetical order with drawings
        renderPrevNext(entryIdx, sorted);

        // Set direction & styling on bodyContent
        const isRTL = currentDisplayedLang === 'ar';
        bodyContent.dir = isRTL ? 'rtl' : 'ltr';
        bodyContent.classList.toggle('arabic', isRTL);

        // Show panel
        showLayer(panel);
    };

    /**
     * Renders entry body content, availability note, and audio player.
     */
    function renderContent(entryData, displayLang, globalLang) {
        // Show availability note if displaying language differs from global user choice
        if (displayLang !== globalLang) {
            const langNames = {
                de: t(displayLang, 'langDe'),
                en: t(displayLang, 'langEn'),
                ar: t(displayLang, 'langAr')
            };
            const requested = langNames[globalLang] || globalLang;
            const showing = langNames[displayLang] || displayLang;
            noteEl.textContent = t(displayLang, 'notAvailable', requested, showing);
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }

        const rawContent = entryData.content?.[displayLang === 'ar' ? 'arabic' : (displayLang === 'en' ? 'english' : 'german')] || '';
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const normalized = normalizeEntryHtml(rawContent, {
            origin: currentOrigin,
            lang: displayLang,
            id: entryData.id
        });

        const isAudioOnly = normalized.kind === 'audio-only';
        panel.classList.toggle('is-kind-audio-only', isAudioOnly);
        panel.classList.toggle('is-kind-video-only', normalized.kind === 'video-only');
        panel.classList.toggle('is-kind-image-only', normalized.kind === 'image-only');

        if (currentPlayer) {
            currentPlayer.cleanup();
            currentPlayer = null;
        }
        playerSlot.innerHTML = '';

        if (normalized.media.audio.length > 0) {
            const audioUrl = normalized.media.audio[0].src;
            currentPlayer = createAudioPlayer(audioUrl, playerSlot, {
                isAudioOnly,
                lang: displayLang
            });
        }

        bodyContent.innerHTML = normalized.html;
        bodyContent.style.display = isAudioOnly ? 'none' : 'block';

        if (normalized.notesHtml) {
            const titleHtml = `<div class="entry-notes-title">${t(displayLang, 'notes')}</div>`;
            notesSection.innerHTML = titleHtml + normalized.notesHtml;
            notesSection.style.display = 'block';
            if (railNotesSection) {
                railNotesSection.innerHTML = titleHtml + normalized.notesHtml;
                railNotesSection.style.display = 'block';
            }
        } else {
            notesSection.innerHTML = '';
            notesSection.style.display = 'none';
            if (railNotesSection) {
                railNotesSection.innerHTML = '';
                railNotesSection.style.display = 'none';
            }
        }

        // Add footnote smooth scrolling listener inside panel
        panel.querySelectorAll('.note-ref, .note-back').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const target = panel.querySelector(href);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        target.classList.add('is-highlighted');
                        setTimeout(() => target.classList.remove('is-highlighted'), 1500);
                    }
                }
            });
        });

        // Set direction & styling
        const isRTL = displayLang === 'ar';
        bodyContent.dir = isRTL ? 'rtl' : 'ltr';
        bodyContent.classList.toggle('arabic', isRTL);
    }

    /**
     * Renders related entries list with 56px drawing emblems (Plan 3 §4 C3).
     */
    function renderRelated(entryData, allEntries) {
        const relatedIds = Array.isArray(entryData.related) ? entryData.related : [];
        if (relatedIds.length === 0) {
            relatedSection.style.display = 'none';
            relatedList.innerHTML = '';
            if (railRelatedSection) {
                railRelatedSection.style.display = 'none';
                railRelatedList.innerHTML = '';
            }
            return;
        }

        relatedList.innerHTML = '';
        if (railRelatedList) railRelatedList.innerHTML = '';
        let validCount = 0;

        for (const rel of relatedIds) {
            const id = typeof rel === 'object' ? rel.ID : parseInt(rel, 10);
            const found = allEntries.find(e => e.id === id);
            if (!found) continue;

            validCount++;
            const createItem = () => {
                const item = document.createElement('a');
                item.href = `#/e/${encodeURIComponent(found.slug || found.id)}`;
                item.className = 'entry-related-item related-chip';

                const isRead = store?.isRead ? store.isRead(found.id) : false;
                const tint = isRead ? '#f0ede6' : '#e26041';

                item.innerHTML = `
                    <img class="related-drawing" src="" alt="" style="display: none;" />
                    <div class="related-item-text">
                        <span class="related-item-type">${escapeHtml((found.type || 'TEXT').toUpperCase())}</span>
                        <span class="related-item-title">${escapeHtml(found.title)}</span>
                    </div>
                `;

                if (found.imageURL) {
                    const img = item.querySelector('.related-drawing');
                    img.style.display = 'block';
                    getTintedGlyphUrl(found.imageURL, tint, found.id).then(url => {
                        if (img) img.src = url;
                    });
                }

                // Hover pulse on 3D map (PLAN.md §2.4 C)
                item.addEventListener('mouseenter', () => {
                    const targetGlyph = glyphsManager?.glyphs?.find(g => g.glyphData?.id === found.id);
                    if (targetGlyph) {
                        glyphsManager.setHovered(targetGlyph);
                    }
                });
                item.addEventListener('mouseleave', () => {
                    glyphsManager?.setHovered(null);
                });

                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    router.navigate(`#/e/${encodeURIComponent(found.slug || found.id)}`);
                });

                return item;
            };

            relatedList.appendChild(createItem());
            if (railRelatedList) railRelatedList.appendChild(createItem());
        }

        const hasRelated = validCount > 0;
        relatedSection.style.display = hasRelated ? 'block' : 'none';
        if (railRelatedSection) railRelatedSection.style.display = hasRelated ? 'block' : 'none';
    }

    /**
     * Renders alphabetical Prev / Next navigation with drawing emblems (Plan 3 §4 C3).
     */
    function renderPrevNext(index, sortedEntries) {
        if (index === -1 || sortedEntries.length <= 1) {
            prevLink.style.display = 'none';
            nextLink.style.display = 'none';
            return;
        }

        const prevIdx = (index - 1 + sortedEntries.length) % sortedEntries.length;
        const nextIdx = (index + 1) % sortedEntries.length;

        const prevEntry = sortedEntries[prevIdx];
        const nextEntry = sortedEntries[nextIdx];

        if (prevEntry) {
            prevLink.style.display = 'flex';
            prevLink.querySelector('.nav-title').textContent = prevEntry.title || '';
            prevLink.entrySlug = prevEntry.slug || prevEntry.id;

            if (prevEntry.imageURL) {
                prevDrawing.style.display = 'block';
                const isRead = store?.isRead ? store.isRead(prevEntry.id) : false;
                getTintedGlyphUrl(prevEntry.imageURL, isRead ? '#f0ede6' : '#e26041', prevEntry.id).then(url => {
                    if (prevDrawing) prevDrawing.src = url;
                });
            } else {
                prevDrawing.style.display = 'none';
            }

            prevLink.onclick = (e) => {
                e.preventDefault();
                router.navigate(`#/e/${encodeURIComponent(prevEntry.slug || prevEntry.id)}`);
            };
        } else {
            prevLink.style.display = 'none';
        }

        if (nextEntry) {
            nextLink.style.display = 'flex';
            nextLink.querySelector('.nav-title').textContent = nextEntry.title || '';
            nextLink.entrySlug = nextEntry.slug || nextEntry.id;

            if (nextEntry.imageURL) {
                nextDrawing.style.display = 'block';
                const isRead = store?.isRead ? store.isRead(nextEntry.id) : false;
                getTintedGlyphUrl(nextEntry.imageURL, isRead ? '#f0ede6' : '#e26041', nextEntry.id).then(url => {
                    if (nextDrawing) nextDrawing.src = url;
                });
            } else {
                nextDrawing.style.display = 'none';
            }

            nextLink.onclick = (e) => {
                e.preventDefault();
                router.navigate(`#/e/${encodeURIComponent(nextEntry.slug || nextEntry.id)}`);
            };
        } else {
            nextLink.style.display = 'none';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Touch drag down to dismiss bottom sheet on mobile (PLAN.md §2.4 F)
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isDraggingSheet = false;

    const dragHandle = panel.querySelector('.sheet-drag-handle');
    const panelHeader = panel.querySelector('.panel-header');

    const onTouchStart = (e) => {
        if (window.innerWidth > 720) return;
        const touch = e.touches[0];
        touchStartY = touch.clientY;
        touchCurrentY = touch.clientY;
        isDraggingSheet = true;
    };

    const onTouchMove = (e) => {
        if (!isDraggingSheet || window.innerWidth > 720) return;
        const touch = e.touches[0];
        touchCurrentY = touch.clientY;
        const deltaY = touchCurrentY - touchStartY;
        if (deltaY > 0) {
            panel.style.transform = `translateY(${deltaY}px)`;
        }
    };

    const onTouchEnd = () => {
        if (!isDraggingSheet || window.innerWidth > 720) return;
        isDraggingSheet = false;
        const deltaY = touchCurrentY - touchStartY;
        panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.7, 0.1, 1)';
        if (deltaY > 80) {
            close(true);
        } else {
            panel.style.transform = 'translateY(0)';
        }
        setTimeout(() => {
            panel.style.transition = '';
        }, 300);
    };

    if (dragHandle) {
        dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
        dragHandle.addEventListener('touchmove', onTouchMove, { passive: true });
        dragHandle.addEventListener('touchend', onTouchEnd, { passive: true });
    }
    if (panelHeader) {
        panelHeader.addEventListener('touchstart', onTouchStart, { passive: true });
        panelHeader.addEventListener('touchmove', onTouchMove, { passive: true });
        panelHeader.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    return {
        el: panel,
        open,
        close,
        isOpen: () => isLayerOpen(panel),
        cleanup: () => {
            window.removeEventListener('keydown', onKeyDown);
            if (dragHandle) {
                dragHandle.removeEventListener('touchstart', onTouchStart);
                dragHandle.removeEventListener('touchmove', onTouchMove);
                dragHandle.removeEventListener('touchend', onTouchEnd);
            }
            if (panelHeader) {
                panelHeader.removeEventListener('touchstart', onTouchStart);
                panelHeader.removeEventListener('touchmove', onTouchMove);
                panelHeader.removeEventListener('touchend', onTouchEnd);
            }
            if (currentPlayer) currentPlayer.cleanup();
            panel.remove();
        }
    };
}
