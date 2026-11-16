/**
 * HTML Sanitizer & Media Rewriter for Al-Khatib Glossar.
 * PLAN.md §3.6 and §8.
 */

const ALLOWED_TAGS = new Set([
    'p', 'br', 'em', 'i', 'b', 'strong', 'sup', 'sub',
    'blockquote', 'hr', 'ol', 'ul', 'li', 'span', 'div',
    'img', 'video', 'audio', 'source', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]);

const ALLOWED_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'controls', 'preload', 'poster', 'type', 'class',
    'loading', 'decoding', 'width', 'height', 'dir'
]);

/**
 * Sanitizes entry body HTML and rewrites media:
 * - Strips all <script> tags (including application/ld+json).
 * - Strips inline style attributes and font-weight spans.
 * - Unwraps ARVE wrappers into clean <video controls preload="metadata">.
 * - Injects loading="lazy" decoding="async" onto images.
 * - Rewrites hardcoded local/production hostnames to the current runtime origin.
 * - Secures external links with target="_blank" rel="noopener noreferrer".
 */
export function sanitizeEntryHtml(html, currentOrigin = '') {
    if (!html || typeof html !== 'string') return '';

    // 1. Rewrite known domain variations to relative or current origin
    let sanitized = html
        .replace(/https?:\/\/al-khatib-glossar\.com/g, currentOrigin)
        .replace(/https?:\/\/al-khatib\.local/g, currentOrigin);

    // 2. In headless/browser environment, use DOMParser
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<body>${sanitized}</body>`, 'text/html');

        // Remove dangerous or unwanted tags
        doc.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach(el => el.remove());

        // Unwrap ARVE wrappers
        doc.querySelectorAll('.arve').forEach(arve => {
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

        // Clean all elements
        const allElements = doc.body.querySelectorAll('*');
        allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();

            // Strip disallowed tags
            if (!ALLOWED_TAGS.has(tagName)) {
                el.replaceWith(...el.childNodes);
                return;
            }

            // Remove inline style attributes
            el.removeAttribute('style');

            // Unwrap redundant spans with font-weight or empty classes
            if (tagName === 'span' && (!el.attributes.length || el.className === 'highlight')) {
                // Keep .highlight
            } else if (tagName === 'span') {
                el.replaceWith(...el.childNodes);
                return;
            }

            // Clean attributes
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
                    el.removeAttribute(attr.name);
                }
            });

            // Images: ensure lazy loading and async decoding
            if (tagName === 'img') {
                el.setAttribute('loading', 'lazy');
                el.setAttribute('decoding', 'async');
            }

            // Links: secure external links
            if (tagName === 'a') {
                const href = el.getAttribute('href') || '';
                if (href.startsWith('http://') || href.startsWith('https://')) {
                    if (currentOrigin && !href.startsWith(currentOrigin)) {
                        el.setAttribute('target', '_blank');
                        el.setAttribute('rel', 'noopener noreferrer');
                    }
                }
            }
        });

        return doc.body.innerHTML.trim();
    }

    // Node / regex fallback for test environments without DOMParser
    return fallbackRegexSanitize(sanitized, currentOrigin);
}

function fallbackRegexSanitize(html, currentOrigin) {
    let out = html
        // Remove script tags with content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove style tags
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Remove inline style attributes
        .replace(/\s*style=(".*?"|'.*?'|[^\s>]*)/gi, '')
        // Unwrap ARVE wrappers
        .replace(/<div class="arve"[^>]*>[\s\S]*?<video([\s\S]*?)<\/video>[\s\S]*?<\/div>/gi, '<video controls preload="metadata"$1</video>');

    return out.trim();
}
