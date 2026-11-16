import { ENTRY_OVERRIDES } from '../entry-overrides.js';

/**
 * HTML Body Normalizer & Media Extractor for Al-Khatib Glossar.
 * PLAN-3-entry-content.md §4 C4 (Rules 1 - 12)
 *
 * Pure function, fully unit-tested.
 */

const ALLOWED_TAGS = new Set([
    'p', 'br', 'em', 'i', 'b', 'strong', 'u', 'sup', 'sub',
    'blockquote', 'hr', 'ol', 'ul', 'li', 'span', 'div',
    'img', 'video', 'audio', 'source', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'figure', 'figcaption'
]);

const ALLOWED_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'controls', 'preload', 'poster', 'type', 'class', 'id',
    'loading', 'decoding', 'width', 'height', 'dir',
    'srcset', 'sizes', 'data-indent', 'data-size', 'data-note-id', 'aria-label', 'aria-hidden'
]);

function getDOMParser() {
    if (typeof DOMParser !== 'undefined') {
        return new DOMParser();
    }
    if (typeof globalThis.DOMParser !== 'undefined') {
        return new globalThis.DOMParser();
    }
    throw new Error('No DOMParser available in current environment');
}

/**
 * Checks if a paragraph is empty (contains only whitespace, &nbsp;, or <br>).
 */
function isEmptyParagraph(el) {
    if (!el || el.tagName !== 'P') return false;
    if (el.querySelector('img, video, audio, source, iframe, figure, table, hr')) return false;
    const text = el.textContent.replace(/[\s\u00a0\ufeff]/g, '');
    return text.length === 0;
}

/**
 * Normalizes entry body HTML and extracts media & kind.
 *
 * @param {string} rawHtml - Source HTML from WordPress ACF/REST
 * @param {object} [options] - Options: origin, lang, id
 * @returns {{ html: string, notesHtml: string, media: {audio: Array, video: Array, images: Array}, kind: string }}
 */
export function normalizeEntryHtml(rawHtml, options = {}) {
    const { origin = '', id = null, lang = 'de' } = options;

    if (!rawHtml || typeof rawHtml !== 'string') {
        return {
            html: '',
            notesHtml: '',
            media: { audio: [], video: [], images: [] },
            kind: 'prose'
        };
    }

    // 0. Pre-clean domains
    let cleaned = rawHtml
        .replace(/https?:\/\/al-khatib-glossar\.com/g, origin)
        .replace(/https?:\/\/al-khatib\.local/g, origin);

    const parser = getDOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><html><head></head><body>${cleaned}</body></html>`, 'text/html');
    const body = doc.body;

    // Remove dangerous or unwanted tags
    body.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach(el => el.remove());

    // Unwrap ARVE wrappers
    body.querySelectorAll('.arve').forEach(arve => {
        const video = arve.querySelector('video');
        if (video) {
            video.setAttribute('controls', '');
            video.setAttribute('preload', 'metadata');
            video.removeAttribute('controlslist');
            arve.replaceWith(video);
        } else {
            arve.remove();
        }
    });

    // -------------------------------------------------------------------------
    // Rule 1: Underlines -> <u class="mark"> (BEFORE stripping inline styles)
    // -------------------------------------------------------------------------
    body.querySelectorAll('[style*="text-decoration"][style*="underline"]').forEach(el => {
        const u = doc.createElement('u');
        u.className = 'mark';
        while (el.firstChild) {
            u.appendChild(el.firstChild);
        }
        el.replaceWith(u);
    });

    // -------------------------------------------------------------------------
    // Rule 2: Indents -> data-indent="k" (BEFORE stripping inline styles)
    // -------------------------------------------------------------------------
    body.querySelectorAll('[style*="padding-left"]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/padding-left:\s*(\d+)px/i);
        if (match) {
            const px = parseInt(match[1], 10);
            const k = Math.min(12, Math.max(1, Math.round(px / 40)));
            el.setAttribute('data-indent', String(k));
        }
    });

    // -------------------------------------------------------------------------
    // Rule 3: Keep srcset, sizes, width, height on images; add sizes if missing
    // -------------------------------------------------------------------------
    body.querySelectorAll('img').forEach(img => {
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        if (!img.getAttribute('sizes')) {
            img.setAttribute('sizes', '(min-width: 1100px) 42rem, 90vw');
        }
    });

    // -------------------------------------------------------------------------
    // Rule 4: Unwrap font-weight spans, drop text-align, strip remaining styles
    // -------------------------------------------------------------------------
    body.querySelectorAll('span').forEach(span => {
        if (span.classList.contains('mark') || span.classList.contains('speaker') || span.classList.contains('highlight')) {
            return;
        }
        // Unwrap redundant span
        span.replaceWith(...span.childNodes);
    });

    body.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
            el.replaceWith(...el.childNodes);
            return;
        }
        el.removeAttribute('style');

        // Sanitize attributes
        Array.from(el.attributes).forEach(attr => {
            if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
                el.removeAttribute(attr.name);
            }
        });
    });

    // -------------------------------------------------------------------------
    // Rule 5: Spacers: run of empty <p> -> <div class="gap" data-size="1|2|3">
    // -------------------------------------------------------------------------
    const children = Array.from(body.children);
    let emptyRun = [];

    const flushEmptyRun = () => {
        if (emptyRun.length === 0) return;
        const size = Math.min(3, emptyRun.length);
        const gap = doc.createElement('div');
        gap.className = 'gap';
        gap.setAttribute('data-size', String(size));
        emptyRun[0].replaceWith(gap);
        for (let i = 1; i < emptyRun.length; i++) {
            emptyRun[i].remove();
        }
        emptyRun = [];
    };

    children.forEach(child => {
        if (isEmptyParagraph(child)) {
            emptyRun.push(child);
        } else {
            flushEmptyRun();
        }
    });
    flushEmptyRun();

    // Drop leading and trailing gaps
    while (body.firstElementChild && body.firstElementChild.classList.contains('gap')) {
        body.firstElementChild.remove();
    }
    while (body.lastElementChild && body.lastElementChild.classList.contains('gap')) {
        body.lastElementChild.remove();
    }

    // -------------------------------------------------------------------------
    // Rule 6: Verse: .poem or run of >= 6 short paragraphs
    // -------------------------------------------------------------------------
    const override = id ? ENTRY_OVERRIDES[id] : null;
    const forceVerse = override?.verse === true;
    const forceNotVerse = override?.verse === false;

    // Case A: Explicit .poem containers
    body.querySelectorAll('.poem').forEach(poem => {
        const verse = doc.createElement('div');
        verse.className = 'verse';
        let currentStanza = doc.createElement('p');
        currentStanza.className = 'stanza';

        const linesOrChildren = Array.from(poem.children);
        if (linesOrChildren.length === 0) {
            // Text lines separated by newlines
            const textLines = (poem.textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
            textLines.forEach(l => {
                const lineSpan = doc.createElement('span');
                lineSpan.className = 'line';
                lineSpan.textContent = l;
                currentStanza.appendChild(lineSpan);
            });
            if (currentStanza.children.length > 0) {
                verse.appendChild(currentStanza);
            }
        } else {
            linesOrChildren.forEach(child => {
                if (child.classList.contains('gap') || isEmptyParagraph(child)) {
                    if (currentStanza.children.length > 0) {
                        verse.appendChild(currentStanza);
                        currentStanza = doc.createElement('p');
                        currentStanza.className = 'stanza';
                    }
                } else {
                    const lineSpan = doc.createElement('span');
                    lineSpan.className = 'line';
                    lineSpan.innerHTML = child.innerHTML;
                    currentStanza.appendChild(lineSpan);
                }
            });
            if (currentStanza.children.length > 0) {
                verse.appendChild(currentStanza);
            }
        }
        poem.replaceWith(verse);
    });

    // Case B: Heuristic verse detection outside .poem
    if (!forceNotVerse) {
        const paragraphs = Array.from(body.querySelectorAll('p:not(.stanza):not(.turn)'));
        if (paragraphs.length >= 6 || forceVerse) {
            const shortCount = paragraphs.filter(p => p.textContent.trim().length < 70).length;
            const longCount = paragraphs.filter(p => p.textContent.trim().length > 140).length;
            const isHeuristicVerse = (paragraphs.length >= 6 && (shortCount / paragraphs.length >= 0.8) && longCount === 0) || forceVerse;

            if (isHeuristicVerse) {
                const verse = doc.createElement('div');
                verse.className = 'verse';
                let currentStanza = doc.createElement('p');
                currentStanza.className = 'stanza';

                const bodyNodes = Array.from(body.children);
                bodyNodes.forEach(node => {
                    if (node.tagName === 'P') {
                        const lineSpan = doc.createElement('span');
                        lineSpan.className = 'line';
                        lineSpan.innerHTML = node.innerHTML;
                        currentStanza.appendChild(lineSpan);
                        node.remove();
                    } else if (node.classList?.contains('gap')) {
                        if (currentStanza.children.length > 0) {
                            verse.appendChild(currentStanza);
                            currentStanza = doc.createElement('p');
                            currentStanza.className = 'stanza';
                        }
                        node.remove();
                    }
                });
                if (currentStanza.children.length > 0) {
                    verse.appendChild(currentStanza);
                }
                body.appendChild(verse);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Rule 7: Speaker turns (<p class="turn"><span class="speaker">...</span>)
    // -------------------------------------------------------------------------
    body.querySelectorAll('p').forEach(p => {
        if (p.classList.contains('stanza') || p.classList.contains('turn')) return;
        const first = p.firstChild;
        if (first && (first.nodeName === 'U' || (first.classList && first.classList.contains('mark')))) {
            const nextNode = first.nextSibling;
            const nextText = nextNode && nextNode.nodeType === 3 ? nextNode.textContent : '';
            if (nextText.trim().startsWith(':')) {
                p.classList.add('turn');
                const speakerSpan = doc.createElement('span');
                speakerSpan.className = 'speaker';
                speakerSpan.textContent = first.textContent.trim() + ':';
                first.remove();
                if (nextNode && nextNode.nodeType === 3) {
                    nextNode.textContent = nextText.replace(/^[\s:]+/, ' ');
                }
                p.insertBefore(speakerSpan, p.firstChild);
            }
        }
    });

    // -------------------------------------------------------------------------
    // Rule 8: Sub-headings (<h3 class="subhead">)
    // -------------------------------------------------------------------------
    body.querySelectorAll('p').forEach(p => {
        if (p.classList.contains('turn') || p.classList.contains('stanza')) return;
        const text = p.textContent.trim();
        if (text && text.length < 120) {
            const clone = p.cloneNode(true);
            clone.querySelectorAll('b, strong, u, .mark').forEach(e => e.remove());
            if (clone.textContent.trim().length === 0) {
                const h3 = doc.createElement('h3');
                h3.className = 'subhead';
                h3.innerHTML = text;
                p.replaceWith(h3);
            }
        }
    });

    // -------------------------------------------------------------------------
    // Rule 9: Notes / Sources (<hr> followed by numbered paragraphs or Quellen)
    // -------------------------------------------------------------------------
    // Convert underscore/dash paragraphs to <hr>
    body.querySelectorAll('p').forEach(p => {
        if (/^[_\-–—\s]{3,}$/.test(p.textContent.trim())) {
            const hr = doc.createElement('hr');
            p.replaceWith(hr);
        }
    });

    let notesHtml = '';
    const hrElements = Array.from(body.querySelectorAll('hr'));
    if (hrElements.length > 0) {
        const lastHr = hrElements[hrElements.length - 1];
        let next = lastHr.nextElementSibling;
        let isNotesSection = false;

        if (next) {
            const nextText = next.textContent.trim();
            if (/^(Quelle|Quellen|Notes|Footnotes)/i.test(nextText) || /^(\[\d+\]|\d+[\.\)])/.test(nextText)) {
                isNotesSection = true;
            }
        }

        if (isNotesSection) {
            const notesNodes = [];
            let cur = lastHr.nextElementSibling;
            while (cur) {
                const toRemove = cur;
                cur = cur.nextElementSibling;
                notesNodes.push(toRemove);
                toRemove.remove();
            }
            lastHr.remove();

            // Link note references <sup>n</sup> in text
            body.querySelectorAll('sup').forEach(sup => {
                const num = sup.textContent.trim().replace(/[\[\]]/g, '');
                if (/^\d+$/.test(num)) {
                    sup.className = 'note-ref';
                    sup.innerHTML = `<a href="#note-${num}" id="ref-${num}">${num}</a>`;
                }
            });

            // Build notesHtml with back-links
            const notesDoc = parser.parseFromString(`<!DOCTYPE html><html><head></head><body></body></html>`, 'text/html');
            const notesList = notesDoc.createElement('ol');
            notesList.className = 'notes-list';

            notesNodes.forEach(node => {
                const text = node.textContent.trim();
                const match = text.match(/^(\[\d+\]|\d+[\.\)])\s*(.*)/);
                if (match) {
                    const num = match[1].replace(/[^\d]/g, '');
                    const li = notesDoc.createElement('li');
                    li.id = `note-${num}`;
                    li.className = 'note-item';
                    li.innerHTML = `${node.innerHTML} <a href="#ref-${num}" class="note-back" aria-label="Back">↩</a>`;
                    notesList.appendChild(li);
                } else {
                    const p = notesDoc.createElement('p');
                    p.className = 'note-item';
                    p.innerHTML = node.innerHTML;
                    notesList.appendChild(p);
                }
            });

            notesHtml = notesList.outerHTML;
        }
    }

    // Remaining <hr> become styled section dividers
    body.querySelectorAll('hr').forEach(hr => {
        hr.className = 'section-divider';
    });

    // -------------------------------------------------------------------------
    // Rule 10: Figures (<p> containing only an <img> -> <figure class="fig">)
    // -------------------------------------------------------------------------
    body.querySelectorAll('p').forEach(p => {
        const img = p.querySelector('img');
        if (img && p.children.length === 1 && p.textContent.trim().length === 0) {
            const fig = doc.createElement('figure');
            fig.className = 'fig';
            if (img.getAttribute('src')?.toLowerCase().includes('.gif')) {
                fig.classList.add('fig-gif');
            }
            fig.appendChild(img);
            p.replaceWith(fig);
        }
    });

    // -------------------------------------------------------------------------
    // Rule 11: Lists (hanging numerals, mono)
    // -------------------------------------------------------------------------
    body.querySelectorAll('ol, ul').forEach(list => {
        list.classList.add('entry-list');
    });

    // -------------------------------------------------------------------------
    // Rule 12: External Links (target="_blank" rel="noopener noreferrer" + ↗)
    // -------------------------------------------------------------------------
    body.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('http://') || href.startsWith('https://')) {
            if (origin && !href.startsWith(origin)) {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                if (!a.querySelector('.ext-arrow') && !a.textContent.includes('↗')) {
                    const arrow = doc.createElement('span');
                    arrow.className = 'ext-arrow';
                    arrow.setAttribute('aria-hidden', 'true');
                    arrow.textContent = ' ↗';
                    a.appendChild(arrow);
                }
            }
        }
    });

    // -------------------------------------------------------------------------
    // Media Extraction & Kind Classification
    // -------------------------------------------------------------------------
    const media = {
        audio: [],
        video: [],
        images: []
    };

    body.querySelectorAll('audio').forEach(audio => {
        const src = audio.getAttribute('src') || audio.querySelector('source')?.getAttribute('src');
        if (src) media.audio.push({ src });
    });

    body.querySelectorAll('video').forEach(video => {
        const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src');
        const poster = video.getAttribute('poster') || undefined;
        if (src) media.video.push({ src, poster });
    });

    body.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        if (src) media.images.push({ src, alt });
    });

    // Strip raw audio tags from body HTML since they are rendered in playerSlot
    body.querySelectorAll('audio').forEach(a => a.remove());

    // Determine content kind
    let kind = 'prose';
    const textOnly = body.textContent.replace(/[\s\u00a0\ufeff]/g, '');

    if (override?.kind) {
        kind = override.kind;
    } else if (media.audio.length > 0 && textOnly.length < 60) {
        kind = 'audio-only';
    } else if (media.video.length > 0 && textOnly.length < 60) {
        kind = 'video-only';
    } else if (media.images.length > 0 && textOnly.length < 60 && !body.querySelector('.verse')) {
        kind = 'image-only';
    } else if (body.querySelector('.verse')) {
        kind = 'verse';
    } else if (body.querySelector('.turn')) {
        kind = 'transcript';
    } else {
        kind = 'prose';
    }

    return {
        html: body.innerHTML.trim(),
        notesHtml,
        media,
        kind
    };
}
