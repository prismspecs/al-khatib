/**
 * Glyph Image Processing & Tinting Utility
 * PLAN-3-entry-content.md §4 C3
 *
 * Converts luminance to alpha on glyph drawings (chalk/ink on dark JPEG)
 * and tints to --trace or --paper, caching data-URLs per (id/url, color).
 */

const glyphCache = new Map();

/**
 * Parses color into [r, g, b] array.
 * Accepts [r, g, b] array or '#rrggbb' / '#rgb' hex string.
 */
function parseColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
        return color.slice(0, 3);
    }
    if (typeof color === 'string') {
        const hex = color.trim().replace(/^#/, '');
        if (hex.length === 3) {
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16)
            ];
        }
        if (hex.length === 6) {
            return [
                parseInt(hex.slice(0, 2), 16),
                parseInt(hex.slice(2, 4), 16),
                parseInt(hex.slice(4, 6), 16)
            ];
        }
    }
    // Default fallback to --trace (#e26041)
    return [226, 96, 65];
}

/**
 * Converts luminance of RGBA pixel buffer to alpha and applies tint color.
 * Dark background (luminance <= 20) becomes transparent (alpha 0).
 * Mid-greys to white become smoothly semi-opaque to fully opaque.
 *
 * @param {Uint8ClampedArray} data - RGBA pixel buffer (mutated in-place)
 * @param {Array<number>|string} tintColor - [r, g, b] or hex string
 */
export function tintLuminanceToAlpha(data, tintColor) {
    const [tr, tg, tb] = parseColor(tintColor);
    const CUTOFF = 20;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Standard ITU-R BT.601 luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let alpha = 0;
        if (lum > CUTOFF) {
            alpha = Math.round(Math.min(255, Math.max(0, ((lum - CUTOFF) / (255 - CUTOFF)) * 255)));
        }

        data[i] = tr;
        data[i + 1] = tg;
        data[i + 2] = tb;
        data[i + 3] = alpha;
    }
}

/**
 * Loads a glyph JPEG image, renders it to an offscreen canvas,
 * tints luminance to alpha, and caches the resulting PNG data URL.
 *
 * @param {string} url - Source image URL
 * @param {Array<number>|string} tintColor - Tint color (default #e26041)
 * @param {string|number} [id] - Optional glyph ID for cache keying
 * @returns {Promise<string>} Tinted PNG data URL or original URL fallback
 */
export async function getTintedGlyphUrl(url, tintColor = '#e26041', id = null) {
    if (!url) return '';
    const rgb = parseColor(tintColor);
    const colorKey = `${rgb[0]}_${rgb[1]}_${rgb[2]}`;
    const cacheKey = `${id || url}_${colorKey}`;

    if (glyphCache.has(cacheKey)) {
        return glyphCache.get(cacheKey);
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return url;
    }

    const promise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(url);
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                tintLuminanceToAlpha(imgData.data, rgb);
                ctx.putImageData(imgData, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (err) {
                console.warn('Glyph tinting canvas error:', err);
                resolve(url);
            }
        };

        img.onerror = () => {
            resolve(url);
        };

        img.src = url;
    });

    glyphCache.set(cacheKey, promise);
    return promise;
}
