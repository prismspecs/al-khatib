import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEntryHtml } from '../src/ui/sanitize.js';

test('sanitizeEntryHtml strips script tags including application/ld+json', () => {
    const input = '<div>Hello<script type="application/ld+json">{"bad": true}</script><script>alert("xss")</script> world</div>';
    const output = sanitizeEntryHtml(input);
    assert.equal(output.includes('<script>'), false);
    assert.equal(output.includes('application/ld+json'), false);
    assert.equal(output.includes('alert'), false);
    assert.equal(output.includes('Hello'), true);
    assert.equal(output.includes('world'), true);
});

test('sanitizeEntryHtml strips inline styles', () => {
    const input = '<p><span style="font-weight: 400; color: red;">Styled text</span></p>';
    const output = sanitizeEntryHtml(input);
    assert.equal(output.includes('style='), false);
    assert.equal(output.includes('color: red'), false);
    assert.equal(output.includes('Styled text'), true);
});

test('sanitizeEntryHtml unwraps ARVE video containers', () => {
    const input = `
    <div class="arve" data-mode="normal">
        <div class="arve-inner">
            <video controls controlslist preload="metadata" class="arve-video">
                <source type="video/mp4" src="http://al-khatib.local/wp-content/uploads/2023/04/al-khatib.mp4">
            </video>
        </div>
        <script type="application/ld+json">{"type":"VideoObject"}</script>
    </div>`;
    const output = sanitizeEntryHtml(input, 'http://current.origin');
    assert.equal(output.includes('<video'), true);
    assert.equal(output.includes('class="arve"'), false);
    assert.equal(output.includes('application/ld+json'), false);
    assert.equal(output.includes('http://current.origin/wp-content/uploads/2023/04/al-khatib.mp4'), true);
});

test('sanitizeEntryHtml rewrites hardcoded hostnames to current origin', () => {
    const input = '<p><img src="http://al-khatib.local/wp-content/uploads/2023/04/pic.jpg" /><a href="https://al-khatib-glossar.com/welten/">Link</a></p>';
    const output = sanitizeEntryHtml(input, 'http://test.local');
    assert.equal(output.includes('http://al-khatib.local'), false);
    assert.equal(output.includes('https://al-khatib-glossar.com'), false);
    assert.equal(output.includes('http://test.local/wp-content/uploads/2023/04/pic.jpg'), true);
    assert.equal(output.includes('http://test.local/welten/'), true);
});
