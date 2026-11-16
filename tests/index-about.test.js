import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeGlossaryPosts } from '../src/data.js';

describe('Index & About View Logic', () => {
    const mockPosts = [
        {
            id: 224,
            slug: 'al-khatib',
            title: { rendered: 'Al-Khatib' },
            acf: {
                position: { x: '1.2', y: '-0.5', z: '0.4' },
                rotation: { x: '0', y: '0', z: '0' },
                author: 'text: kenan khadaj',
                german: 'Langer deutscher Text...',
                english: 'Long english text...',
                arabic: '',
                related: [220, 251]
            }
        },
        {
            id: 220,
            slug: 'stimme',
            title: { rendered: 'Stimme' },
            acf: {
                position: { x: '-0.8', y: '1.5', z: '0.3' },
                author: 'stimme: carsten jenss',
                german: 'Deutscher Audiotext...',
                english: '',
                arabic: '',
                related: false
            }
        },
        {
            id: 31,
            slug: 'zellen',
            title: { rendered: 'خلايا' },
            acf: {
                position: { x: '0.0', y: '0.0', z: '0.3' },
                author: 'نص: جلال الأحمدي',
                german: '',
                english: '',
                arabic: 'نص عربي كامل...',
                related: [224]
            }
        },
        {
            id: 550,
            slug: 'about',
            title: { rendered: 'About' },
            acf: {
                is_postcard: true,
                author: 'Kollektiv Wiese',
                german: 'Das Kollektiv Wiese...',
                english: 'The collective Wiese...',
                arabic: 'مجموعة مرج...'
            }
        }
    ];

    it('separates 35 glyph entries from Post 550', () => {
        const { glyphs, aboutPost } = normalizeGlossaryPosts(mockPosts);
        assert.strictEqual(glyphs.length, 3);
        assert.ok(aboutPost);
        assert.strictEqual(aboutPost.id, 550);
        assert.strictEqual(aboutPost.content.german, 'Das Kollektiv Wiese...');
    });

    it('filters glyph entries by type', () => {
        const { glyphs } = normalizeGlossaryPosts(mockPosts);
        const textEntries = glyphs.filter(g => g.type.toLowerCase().includes('text'));
        const audioEntries = glyphs.filter(g => g.type.toLowerCase().includes('stimme'));

        assert.strictEqual(textEntries.length, 1);
        assert.strictEqual(textEntries[0].id, 224);
        assert.strictEqual(audioEntries.length, 1);
        assert.strictEqual(audioEntries[0].id, 220);
    });

    it('filters glyph entries by available language', () => {
        const { glyphs } = normalizeGlossaryPosts(mockPosts);
        const deEntries = glyphs.filter(g => g.langs.de);
        const enEntries = glyphs.filter(g => g.langs.en);
        const arEntries = glyphs.filter(g => g.langs.ar);

        assert.strictEqual(deEntries.length, 2);
        assert.strictEqual(enEntries.length, 1);
        assert.strictEqual(enEntries[0].id, 224);
        assert.strictEqual(arEntries.length, 1);
        assert.strictEqual(arEntries[0].id, 31);
    });

    it('extracts unique entry types for filter chips', () => {
        const { glyphs } = normalizeGlossaryPosts(mockPosts);
        const types = new Set(glyphs.map(g => g.type.toLowerCase()).filter(Boolean));
        assert.ok(types.has('text'));
        assert.ok(types.has('stimme'));
    });
});
