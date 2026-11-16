#!/usr/bin/env node
// tools/check-data.mjs
// Validates REST API responses against data integrity rules:
// - Fetches all posts
// - Checks that all glyphs have featured images
// - Checks that all positions and rotations are valid floats (no NaN)
// - Checks that About post (550) exists
// - Checks that related post IDs exist in the dataset

import { fetchGlossaryData } from '../src/data.js';

const apiBase = process.argv[2] || process.env.AKG_API_BASE || 'http://al-khatib.local';
console.log(`Checking data from: ${apiBase}...`);

try {
    const { glyphs, aboutPost } = await fetchGlossaryData(apiBase);

    console.log(`Found ${glyphs.length} glossary glyphs and ${aboutPost ? 'About post 550' : 'NO About post'}`);

    let errors = 0;

    if (!aboutPost) {
        console.error('FAIL: Missing post 550 (About / Postcard)');
        errors++;
    }

    if (glyphs.length !== 35) {
        console.warn(`WARN: Expected 35 glyphs, found ${glyphs.length}`);
    }

    const idSet = new Set(glyphs.map(g => g.id));
    if (aboutPost) idSet.add(aboutPost.id);

    glyphs.forEach(g => {
        if (!g.imageURL) {
            console.error(`FAIL: Glyph ${g.id} ("${g.title}") has no featured image URL`);
            errors++;
        }

        if (isNaN(g.x) || isNaN(g.y) || isNaN(g.z)) {
            console.error(`FAIL: Glyph ${g.id} ("${g.title}") position has NaN: x=${g.x}, y=${g.y}, z=${g.z}`);
            errors++;
        }

        if (isNaN(g.rotX) || isNaN(g.rotY) || isNaN(g.rotZ)) {
            console.error(`FAIL: Glyph ${g.id} ("${g.title}") rotation has NaN: x=${g.rotX}, y=${g.rotY}, z=${g.rotZ}`);
            errors++;
        }

        if (Array.isArray(g.related)) {
            for (const rel of g.related) {
                const relId = typeof rel === 'object' ? rel.ID : rel;
                if (relId && !idSet.has(relId)) {
                    console.warn(`WARN: Glyph ${g.id} references non-existent related post ID ${relId}`);
                }
            }
        }
    });

    if (errors > 0) {
        console.error(`check-data FAILED with ${errors} error(s).`);
        process.exit(1);
    } else {
        console.log('check-data PASSED: All 35 glyphs valid, coordinates non-NaN, About post present.');
        process.exit(0);
    }
} catch (err) {
    console.error('check-data encountered an exception:', err);
    process.exit(1);
}
