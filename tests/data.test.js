import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGlossaryPosts, parseAuthorCredits } from '../src/data.js';

test('parseAuthorCredits parses standard colon roles', () => {
    const raw = 'text: kenan | übersetzung: maru | stimme: carsten';
    const parsed = parseAuthorCredits(raw);
    assert.equal(parsed.type, 'text');
    assert.equal(parsed.items.length, 3);
    assert.deepEqual(parsed.items[0], { role: 'text', names: 'kenan' });
    assert.deepEqual(parsed.items[1], { role: 'übersetzung', names: 'maru' });
    assert.deepEqual(parsed.items[2], { role: 'stimme', names: 'carsten' });
});

test('parseAuthorCredits handles single string without colon', () => {
    const raw = 'kenan khadaj';
    const parsed = parseAuthorCredits(raw);
    assert.equal(parsed.type, 'text');
    assert.deepEqual(parsed.items[0], { role: '', names: 'kenan khadaj' });
});

test('parseAuthorCredits handles empty/null author', () => {
    assert.deepEqual(parseAuthorCredits(''), { type: 'text', items: [] });
    assert.deepEqual(parseAuthorCredits(null), { type: 'text', items: [] });
});

test('normalizeGlossaryPosts separates Post 550 and extracts 35 glyphs', () => {
    const samplePosts = [
        {
            id: 550,
            title: { rendered: 'About' },
            acf: {
                is_postcard: true,
                english: 'About English text',
                german: 'About German text'
            }
        },
        {
            id: 224,
            slug: 'test-glyph',
            title: { rendered: 'Test Glyph' },
            acf: {
                position: { x: '1.5', y: '-2.0', z: '0.4' },
                rotation: { x: '10', y: '0', z: '45' },
                author: 'text: sandra',
                german: 'Ein langer deutscher Text...',
                english: '',
                arabic: '',
                related: false // edge case from PLAN.md §8
            },
            _embedded: {
                'wp:featuredmedia': [{
                    source_url: 'http://al-khatib.local/wp-content/uploads/glyph.jpg',
                    media_details: { width: 1000, height: 1000 }
                }]
            }
        }
    ];

    const { glyphs, aboutPost } = normalizeGlossaryPosts(samplePosts);

    assert.ok(aboutPost, 'About post should be extracted');
    assert.equal(aboutPost.id, 550);
    assert.equal(aboutPost.isPostcard, true);

    assert.equal(glyphs.length, 1);
    const glyph = glyphs[0];
    assert.equal(glyph.id, 224);
    assert.equal(glyph.x, 1.5);
    assert.equal(glyph.y, -2.0);
    assert.equal(glyph.z, 0.4);
    assert.equal(glyph.rotX, 10);
    assert.equal(glyph.rotZ, 45);
    assert.equal(glyph.langs.de, true);
    assert.equal(glyph.langs.en, false);
    assert.equal(glyph.langs.ar, false);
    assert.deepEqual(glyph.related, []); // false normalized to empty array
});
