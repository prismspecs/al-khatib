import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from 'linkedom';
import { normalizeEntryHtml } from '../src/ui/normalize.js';

// Setup DOMParser for Node environment
globalThis.DOMParser = DOMParser;

// Load real post fixtures
const fixtures = JSON.parse(fs.readFileSync('tests/fixtures-entries.json', 'utf8'));

test('Rule 1: Underlines -> <u class="mark">', () => {
    const input = '<p><span style="text-decoration: underline;">Important Notice</span> and plain text</p>';
    const res = normalizeEntryHtml(input);
    assert.ok(res.html.includes('<u class="mark">Important Notice</u>'));
    assert.ok(!res.html.includes('style='));
});

test('Rule 2: Indents -> data-indent="k"', () => {
    const input = '<p style="padding-left: 80px;">Indented by 80px</p><p style="padding-left: 120px;">Indented by 120px</p>';
    const res = normalizeEntryHtml(input);
    assert.ok(res.html.includes('data-indent="2"'));
    assert.ok(res.html.includes('data-indent="3"'));
    assert.ok(!res.html.includes('padding-left'));
});

test('Rule 3: Image attributes kept and default sizes injected', () => {
    const input = '<p><img src="/img.jpg" width="800" height="600" /></p>';
    const res = normalizeEntryHtml(input);
    assert.ok(res.html.includes('loading="lazy"'));
    assert.ok(res.html.includes('decoding="async"'));
    assert.ok(res.html.includes('sizes="(min-width: 1100px) 42rem, 90vw"'));
    assert.ok(res.html.includes('width="800"'));
    assert.ok(res.html.includes('height="600"'));
});

test('Rule 4: Strip styles, font-weight spans, drop text-align', () => {
    const input = '<p style="text-align: right;"><span style="font-weight: 400;">Unwrapped text</span></p>';
    const res = normalizeEntryHtml(input);
    assert.ok(!res.html.includes('style='));
    assert.ok(!res.html.includes('text-align'));
    assert.ok(!res.html.includes('font-weight'));
    assert.ok(res.html.includes('Unwrapped text'));
});

test('Rule 5: Spacers: run of empty <p> -> <div class="gap" data-size="1|2|3">', () => {
    const input = `
        <p>&nbsp;</p>
        <p>Paragraph 1</p>
        <p>&nbsp;</p>
        <p>Paragraph 2</p>
        <p>&nbsp;</p>
        <p><br></p>
        <p>Paragraph 3</p>
        <p>&nbsp;</p>
        <p>&nbsp;</p>
        <p>&nbsp;</p>
        <p>Paragraph 4</p>
        <p>&nbsp;</p>
    `;
    const res = normalizeEntryHtml(input);
    // Leading and trailing gaps dropped
    assert.ok(!res.html.startsWith('<div class="gap"'));
    assert.ok(!res.html.endsWith('<div class="gap"></div>'));
    assert.ok(res.html.includes('data-size="1"') && res.html.includes('class="gap"'));
    assert.ok(res.html.includes('data-size="2"') && res.html.includes('class="gap"'));
    assert.ok(res.html.includes('data-size="3"') && res.html.includes('class="gap"'));
});

test('Rule 6: Verse positive entries: 217 (de, ar), 149, 152 (de, ar)', () => {
    // 217 DE
    const res217De = normalizeEntryHtml(fixtures[217].german, { id: 217, lang: 'de' });
    assert.equal(res217De.kind, 'verse');
    assert.ok(res217De.html.includes('class="verse"'));
    assert.ok(res217De.html.includes('class="stanza"'));
    assert.ok(res217De.html.includes('class="line"'));

    // 217 AR
    const res217Ar = normalizeEntryHtml(fixtures[217].arabic, { id: 217, lang: 'ar' });
    assert.equal(res217Ar.kind, 'verse');
    assert.ok(res217Ar.html.includes('class="verse"'));

    // 149 DE
    const res149 = normalizeEntryHtml(fixtures[149].german, { id: 149, lang: 'de' });
    assert.equal(res149.kind, 'verse');
    assert.ok(res149.html.includes('class="verse"'));

    // 152 DE
    const res152De = normalizeEntryHtml(fixtures[152].german, { id: 152, lang: 'de' });
    assert.equal(res152De.kind, 'verse');
    assert.ok(res152De.html.includes('class="verse"'));

    // 152 AR
    const res152Ar = normalizeEntryHtml(fixtures[152].arabic, { id: 152, lang: 'ar' });
    assert.equal(res152Ar.kind, 'verse');
    assert.ok(res152Ar.html.includes('class="verse"'));
});

test('Rule 6: Verse negative entries: 172, 224, 175, 120 must NOT be verse', () => {
    const res172 = normalizeEntryHtml(fixtures[172].german, { id: 172, lang: 'de' });
    assert.notEqual(res172.kind, 'verse');
    assert.ok(!res172.html.includes('class="verse"'));

    const res224 = normalizeEntryHtml(fixtures[224].german, { id: 224, lang: 'de' });
    assert.notEqual(res224.kind, 'verse');
    assert.ok(!res224.html.includes('class="verse"'));

    const res175 = normalizeEntryHtml(fixtures[175].german, { id: 175, lang: 'de' });
    assert.notEqual(res175.kind, 'verse');
    assert.ok(!res175.html.includes('class="verse"'));

    const res120 = normalizeEntryHtml(fixtures[120].german, { id: 120, lang: 'de' });
    assert.notEqual(res120.kind, 'verse');
    assert.ok(!res120.html.includes('class="verse"'));
});

test('Rule 7: Speaker turns trigger on Entry 241', () => {
    const res241 = normalizeEntryHtml(fixtures[241].german, { id: 241, lang: 'de' });
    assert.equal(res241.kind, 'transcript');
    assert.ok(res241.html.includes('class="turn"'));
    assert.ok(res241.html.includes('<span class="speaker">Richterin:</span>'));
    assert.ok(res241.html.includes('<span class="speaker">Dolmetscher:</span>'));
});

test('Rule 8: Sub-headings trigger on Entry 224', () => {
    const res224 = normalizeEntryHtml(fixtures[224].german, { id: 224, lang: 'de' });
    assert.ok(res224.html.includes('<h3 class="subhead">Aus dem abschließenden Plädoyer der Anklage (Bundesanwaltschaft) am 2.12. 2021</h3>'));
});

test('Rule 9: Notes / Sources extracted from Entry 241', () => {
    const res241 = normalizeEntryHtml(fixtures[241].german, { id: 241, lang: 'de' });
    assert.ok(res241.notesHtml.length > 0);
    assert.ok(res241.notesHtml.includes('class="notes-list"'));
    assert.ok(res241.notesHtml.includes('note-back'));
    assert.ok(res241.html.includes('class="note-ref"'));
});

test('Rule 10: Figures (<p> with only <img> -> <figure class="fig">)', () => {
    const input = '<p><img src="/photo.jpg" alt="Photo" /></p>';
    const res = normalizeEntryHtml(input);
    assert.ok(res.html.includes('<figure class="fig">'));
    assert.ok(!res.html.includes('<p><figure'));
});

test('Media extraction and kind: 115 (audio-only), 251 (video-only), 247 (image-only)', () => {
    const res115 = normalizeEntryHtml(fixtures[115].german, { id: 115, lang: 'de' });
    assert.equal(res115.kind, 'audio-only');
    assert.ok(res115.media.audio.length > 0);

    const res251 = normalizeEntryHtml(fixtures[251].german, { id: 251, lang: 'de' });
    assert.equal(res251.kind, 'video-only');
    assert.ok(res251.media.video.length > 0);

    const res247 = normalizeEntryHtml(fixtures[247].german, { id: 247, lang: 'de' });
    assert.equal(res247.kind, 'image-only');
    assert.ok(res247.media.images.length > 0);
});
