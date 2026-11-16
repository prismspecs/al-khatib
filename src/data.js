/**
 * Fetches and normalizes glossary posts from the WordPress REST API.
 * Handles edge cases specified in PLAN.md §8.
 */

export async function fetchGlossaryData(apiBase = '') {
    const base = (apiBase || '').replace(/\/?$/, '');
    const url = `${base}/wp-json/wp/v2/posts?categories=2&per_page=100&_embed&t=${Date.now()}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch glossary posts: HTTP ${res.status}`);
    }

    const posts = await res.json();
    return normalizeGlossaryPosts(posts);
}

/**
 * Fetches single entry body on demand.
 * PLAN.md §4.2
 */
export async function fetchEntryBody(id, apiBase = '') {
    const base = (apiBase || '').replace(/\/?$/, '');
    try {
        const res = await fetch(`${base}/wp-json/akg/v1/entry/${id}`);
        if (res.ok) {
            const data = await res.json();
            return data.content || null;
        }
    } catch {
        // Fallback handled by caller
    }
    return null;
}

export function normalizeGlossaryPosts(rawPosts) {
    const glyphs = [];
    let aboutPost = null;

    for (const post of rawPosts) {
        const acf = post.acf || {};
        const isPostcard = acf.is_postcard === true || post.id === 550;

        // Languages availability check (length > 2 and trimmed)
        const hasGerman = typeof acf.german === 'string' && acf.german.trim().length > 2;
        const hasEnglish = typeof acf.english === 'string' && acf.english.trim().length > 2;
        const hasArabic = typeof acf.arabic === 'string' && acf.arabic.trim().length > 2;

        // Author credits parsing (PLAN.md §8: split by first colon)
        const rawAuthor = acf.author || '';
        const parsedCredits = parseAuthorCredits(rawAuthor);

        // Featured image
        let imageURL = '';
        let aspect = 1.0;
        let mediaDetails = null;

        if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
            const media = post._embedded['wp:featuredmedia'][0];
            imageURL = media.source_url || '';
            mediaDetails = media.media_details || null;
            if (mediaDetails && mediaDetails.width && mediaDetails.height) {
                aspect = mediaDetails.width / mediaDetails.height;
            }
        }

        const normalized = {
            id: post.id,
            slug: post.slug || '',
            link: post.link || '',
            title: post.title ? post.title.rendered : '',
            isPostcard,
            author: rawAuthor,
            credits: parsedCredits,
            type: parsedCredits.type || 'text',
            position: {
                x: parseFloat(acf.position?.x) || 0,
                y: parseFloat(acf.position?.y) || 0,
                z: parseFloat(acf.position?.z) || 0.3
            },
            rotation: {
                x: parseFloat(acf.rotation?.x) || 0,
                y: parseFloat(acf.rotation?.y) || 0,
                z: parseFloat(acf.rotation?.z) || 0
            },
            // Flat convenience coordinates
            x: parseFloat(acf.position?.x) || 0,
            y: parseFloat(acf.position?.y) || 0,
            z: parseFloat(acf.position?.z) || 0.3,
            rotX: parseFloat(acf.rotation?.x) || 0,
            rotY: parseFloat(acf.rotation?.y) || 0,
            rotZ: parseFloat(acf.rotation?.z) || 0,
            imageURL,
            aspect,
            langs: {
                de: hasGerman,
                en: hasEnglish,
                ar: hasArabic
            },
            content: {
                german: acf.german || '',
                english: acf.english || '',
                arabic: acf.arabic || ''
            },
            // Related posts array: normalize false to []
            related: Array.isArray(acf.related) ? acf.related : []
        };

        if (isPostcard) {
            aboutPost = normalized;
        } else {
            glyphs.push(normalized);
        }
    }

    return { glyphs, aboutPost };
}

/**
 * Parses author string into type and contributor roles.
 * E.g. "text: kenan | übersetzung: maru | stimme: carsten"
 */
export function parseAuthorCredits(authorString) {
    if (!authorString || typeof authorString !== 'string') {
        return { type: 'text', items: [] };
    }

    const segments = authorString.split('|').map(s => s.trim()).filter(Boolean);
    const items = [];
    let detectedType = '';

    for (const seg of segments) {
        const colonIdx = seg.indexOf(':');
        if (colonIdx !== -1) {
            const role = seg.substring(0, colonIdx).trim().toLowerCase();
            const names = seg.substring(colonIdx + 1).trim();
            items.push({ role, names });
            if (!detectedType) {
                detectedType = role;
            }
        } else {
            items.push({ role: '', names: seg });
        }
    }

    return {
        type: detectedType || 'text',
        items
    };
}
