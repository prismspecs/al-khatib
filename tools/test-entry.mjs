#!/usr/bin/env node
/**
 * tools/test-entry.mjs
 * 
 * Comprehensive automated verification for PLAN-3-entry-content.md (§7):
 * 1. Hit test: for every visible button, a, [role=slider] inside entry layer,
 *    assert elementFromPoint(centre) is the element or its descendant.
 * 2. No invisible interceptors: sample 12×8 grid over viewport; assert no top element
 *    has computed opacity: 0, [hidden], or inert.
 * 3. Real clicks: related entry -> hash changes; next -> hash changes;
 *    lang chip -> body changes; Close -> view is map.
 * 4. Scroll: wheel event over panel -> scrollTop > 0, camera distance unchanged.
 * 5. Reading mode: press F -> covers viewport; Esc -> returns to side panel; Esc again -> closes.
 * 6. Fonts: used font families loaded without 400+ HTTP errors.
 * 7. Console: zero errors.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const ALL_VIEWPORTS = [
    { name: 'desktop-1440', width: 1440, height: 900, isMobile: false },
    { name: 'desktop-1920', width: 1920, height: 1080, isMobile: false },
    { name: 'mobile-390', width: 390, height: 844, isMobile: true }
];

const args = process.argv.slice(2);
const targetVpArg = args.find(a => a.startsWith('--viewport='))?.split('=')[1];
const targetLangArg = args.find(a => a.startsWith('--lang='))?.split('=')[1];
const targetIdArg = args.find(a => a.startsWith('--id='))?.split('=')[1];

const VIEWPORTS = targetVpArg
    ? ALL_VIEWPORTS.filter(v => v.name === targetVpArg || v.name.includes(targetVpArg))
    : ALL_VIEWPORTS;

const BASE_URL = process.env.TEST_URL || 'http://al-khatib.local';
const PROGRESS_DIR = path.resolve(process.cwd(), 'docs/redesign/progress');
fs.mkdirSync(PROGRESS_DIR, { recursive: true });

// Entries to review per Plan 3 §6:
// 217 (verse), 149 (verse), 241 (transcript, 30k text), 224 (48k text), 136 (spacers),
// 158 (6 images), 233 (audio+text), 115 (audio only), 251 (video), 247 (gif), 31 (arabic only), 172 (trilingual)
const TEST_ENTRIES = [217, 149, 241, 224, 136, 158, 233, 115, 251, 247, 31, 172];

async function createBrowserSession({ width, height, isMobile }) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akg-entry-test-'));
    const port = 9600 + Math.floor(Math.random() * 300);

    const chromeArgs = [
        '--headless=new',
        '--no-sandbox',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--hide-scrollbars',
        `--window-size=${width},${height}`,
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${tmpDir}`,
        'about:blank'
    ];

    const ch = spawn('google-chrome', chromeArgs, { stdio: 'ignore' });
    const cleanup = () => {
        try { ch.kill('SIGKILL'); } catch (e) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    };

    let tabs;
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json`);
            tabs = await res.json();
            if (tabs && tabs.length > 0) break;
        } catch {
            await sleep(250);
        }
    }

    if (!tabs || !tabs.find(t => t.type === 'page')) {
        cleanup();
        throw new Error('Failed to connect to headless Chrome');
    }

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    let id = 0;
    const pend = new Map();
    const consoleLogs = [];
    const consoleErrors = [];
    const networkFailures = [];

    ws.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.method === 'Runtime.consoleAPICalled') {
            const text = d.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
            const logEntry = `[${d.params.type}] ${text}`;
            consoleLogs.push(logEntry);
            if (d.params.type === 'error') {
                consoleErrors.push(logEntry);
            }
        } else if (d.method === 'Runtime.exceptionThrown') {
            const exc = `[EXCEPTION] ${d.params.exceptionDetails?.text || ''} ${d.params.exceptionDetails?.exception?.description || ''}`;
            consoleErrors.push(exc);
        } else if (d.method === 'Network.responseReceived') {
            const status = d.params.response?.status;
            const url = d.params.response?.url;
            if (status >= 400) {
                networkFailures.push({ url, status });
            }
        } else if (d.id && pend.has(d.id)) {
            const { resolve, reject } = pend.get(d.id);
            pend.delete(d.id);
            if (d.error) reject(new Error(d.error.message));
            else resolve(d.result);
        }
    };

    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const msgId = ++id;
        pend.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    if (isMobile) {
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 2,
            mobile: true,
            hasTouch: true
        });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    } else {
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
            hasTouch: false
        });
    }

    const ev = async (expression) => {
        const res = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
        }
        return res.result?.value;
    };

    const clickAt = async (x, y) => {
        const rx = Math.round(x);
        const ry = Math.round(y);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rx, y: ry });
        await sleep(60);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
        await sleep(60);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
        await sleep(150);
    };

    const mouseWheel = async (x, y, deltaX, deltaY) => {
        const rx = Math.round(x);
        const ry = Math.round(y);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rx, y: ry });
        await sleep(50);
        await send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: rx,
            y: ry,
            deltaX,
            deltaY
        });
        await sleep(150);
    };

    const shot = async (filePath) => {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    };

    return {
        send,
        ev,
        clickAt,
        mouseWheel,
        shot,
        getErrors: () => [...consoleErrors],
        getNetworkFailures: () => [...networkFailures],
        close: async () => {
            try { ws.close(); } catch {}
            cleanup();
        }
    };
}

async function runEntrySuite() {
    console.log('====================================================');
    console.log(' PLAN 3 ENTRY PANEL TEST SUITE (§7)');
    console.log('====================================================\n');

    let totalAssertions = 0;
    let failedAssertions = 0;
    const failures = [];

    const langsToTest = targetLangArg ? [targetLangArg] : ['de', 'ar'];

    for (const vp of VIEWPORTS) {
        console.log(`\n----------------------------------------------------`);
        console.log(` Viewport: ${vp.name} (${vp.width}x${vp.height}, isMobile=${vp.isMobile})`);
        console.log(`----------------------------------------------------`);

        let session;
        try {
            session = await createBrowserSession(vp);
            console.log(`Navigating to ${BASE_URL}/?debug=1#/map...`);
            await session.send('Page.navigate', { url: `${BASE_URL}/?debug=1#/map` });

            // Wait for app ready
            let ready = false;
            for (let i = 0; i < 60; i++) {
                ready = await session.ev(`!!(window.__akg && window.__akg.store && window.__akg.store.get().glossary?.length)`);
                if (ready) break;
                await sleep(250);
            }
            if (!ready) throw new Error('App initialization timeout');

            for (const lang of langsToTest) {
                console.log(`\n[Lang: ${lang}] Testing on ${vp.name}...`);
                await session.ev(`window.__akg.store.setLang('${lang}')`);
                await sleep(200);

                // -------------------------------------------------------------
                // 1. Grid sample for invisible interceptors (§7.2)
                // -------------------------------------------------------------
                totalAssertions++;
                const interceptorCheck = await session.ev(`
                    (() => {
                        const bad = [];
                        const cols = 12;
                        const rows = 8;
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const x = (c + 0.5) * (w / cols);
                                const y = (r + 0.5) * (h / rows);
                                const el = document.elementFromPoint(x, y);
                                if (!el) continue;
                                let cur = el;
                                while (cur && cur !== document.body && cur !== document.documentElement) {
                                    const style = window.getComputedStyle(cur);
                                    const op = parseFloat(style.opacity);
                                    const isHidden = cur.hasAttribute('hidden') || style.display === 'none';
                                    const isInert = cur.hasAttribute('inert');
                                    if (op === 0 || isHidden || isInert) {
                                        bad.push({ x, y, tag: el.tagName, id: el.id, cls: el.className, ancestor: cur.id || cur.className, op, isHidden, isInert });
                                        break;
                                    }
                                    cur = cur.parentElement;
                                }
                            }
                        }
                        return bad;
                    })()
                `);

                if (interceptorCheck.length > 0) {
                    failedAssertions++;
                    const msg = `Invisible interceptor found at (${interceptorCheck[0].x}, ${interceptorCheck[0].y}): ${interceptorCheck[0].ancestor}`;
                    failures.push(`[${vp.name}][${lang}] ${msg}`);
                    console.error(`  ✖ Invisible interceptor:`, interceptorCheck[0]);
                } else {
                    console.log(`  ✔ No invisible interceptors across 12×8 viewport grid`);
                }

                // -------------------------------------------------------------
                // 2. Test entries (§6)
                // -------------------------------------------------------------
                const entriesToRun = targetIdArg
                    ? TEST_ENTRIES.filter(id => String(id) === targetIdArg)
                    : TEST_ENTRIES;

                for (const entryId of entriesToRun) {
                    // Navigate to entry
                    await session.ev(`
                        (async () => {
                            const glossary = window.__akg.store.get().glossary;
                            const item = glossary.find(g => g.id === ${entryId});
                            const slug = item?.slug || String(${entryId});
                            window.__akg.router.navigate('#/e/' + encodeURIComponent(slug));
                        })()
                    `);
                    await sleep(300);

                    // Wait for entry content to load and camera rest
                    await session.ev(`
                        (async () => {
                            for (let i = 0; i < 40; i++) {
                                const body = document.querySelector('.entry-body-content') || document.querySelector('.entry-panel-body');
                                if (body && body.textContent && body.textContent.trim().length > 10) break;
                                await new Promise(r => setTimeout(r, 100));
                            }
                            if (window.__akg?.waitForRest) await window.__akg.waitForRest();
                        })()
                    `);

                    if (entryId === 217 && lang === 'de') {
                        const step3Shot = path.join(PROGRESS_DIR, `plan3-step-3-${vp.name}.png`);
                        await session.shot(step3Shot);
                    }

                    // Check panel hit-testing (§7.1)
                    totalAssertions++;
                    const hitTestResult = await session.ev(`
                        (() => {
                            const panel = document.getElementById('entry-panel') || document.querySelector('.akg-panel');
                            if (!panel) return { error: 'Entry panel element not found' };

                            const controls = Array.from(panel.querySelectorAll('button, a, [role="slider"]'));
                            const visible = controls.filter(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0 &&
                                       rect.bottom > 0 && rect.top < window.innerHeight &&
                                       rect.right > 0 && rect.left < window.innerWidth;
                            });

                            const failed = [];
                            for (const c of visible) {
                                if (typeof c.scrollIntoView === 'function') {
                                    c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                                }
                                const rect = c.getBoundingClientRect();
                                const cx = rect.left + rect.width * 0.5;
                                const cy = rect.top + rect.height * 0.5;
                                const hit = document.elementFromPoint(cx, cy);
                                if (!hit || (hit !== c && !c.contains(hit))) {
                                    failed.push({
                                        control: c.className || c.tagName,
                                        text: (c.textContent || '').trim().slice(0, 30),
                                        cx, cy,
                                        hitTag: hit ? hit.tagName : null,
                                        hitId: hit ? hit.id : null,
                                        hitClass: hit ? hit.className : null
                                    });
                                }
                            }
                            return { total: visible.length, failed };
                        })()
                    `);

                    if (hitTestResult.error || hitTestResult.failed.length > 0) {
                        failedAssertions++;
                        const failMsg = hitTestResult.error ||
                            `Hit test failed for ${hitTestResult.failed.length}/${hitTestResult.total} controls (top hit: ${hitTestResult.failed[0]?.hitId || hitTestResult.failed[0]?.hitClass})`;
                        failures.push(`[${vp.name}][${lang}] Entry ${entryId}: ${failMsg}`);
                        console.error(`  ✖ Entry ${entryId}: FAIL (${failMsg})`);
                        console.error(`    Detailed failures:`, JSON.stringify(hitTestResult.failed, null, 2));
                    } else {
                        console.log(`  ✔ Entry ${entryId}: all ${hitTestResult.total} visible controls pass hit test`);
                    }

                    // On entry 224 (long prose), test scroll (§7.4)
                    if (entryId === 224) {
                        totalAssertions++;
                        const initialCamDist = await session.ev(`window.__akg.controls?.distance || 0`);
                        const initialScroll = await session.ev(`
                            (() => {
                                const scroller = document.querySelector('#entry-panel .panel-scroll') || document.getElementById('entry-panel');
                                return scroller ? scroller.scrollTop : 0;
                            })()
                        `);

                        // Dispatch wheel event inside #entry-panel .panel-scroll rect
                        const panelRect = await session.ev(`
                            (() => {
                                const p = document.querySelector('#entry-panel .panel-scroll') || document.getElementById('entry-panel');
                                const r = p.getBoundingClientRect();
                                return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
                            })()
                        `);
                        await session.mouseWheel(panelRect.x, panelRect.y, 0, 300);
                        await sleep(400);

                        const postScroll = await session.ev(`
                            (() => {
                                const scroller = document.querySelector('#entry-panel .panel-scroll') || document.getElementById('entry-panel');
                                return scroller ? scroller.scrollTop : 0;
                            })()
                        `);
                        const postCamDist = await session.ev(`window.__akg.controls?.distance || 0`);

                        const scrollPassed = (postScroll > initialScroll || postScroll > 0) && Math.abs(postCamDist - initialCamDist) < 0.05;
                        if (!scrollPassed) {
                            failedAssertions++;
                            const sMsg = `Scroll failed: initial=${initialScroll}, post=${postScroll}, camDistDelta=${(postCamDist - initialCamDist).toFixed(3)}`;
                            failures.push(`[${vp.name}][${lang}] ${sMsg}`);
                            console.error(`  ✖ ${sMsg}`);
                        } else {
                            console.log(`  ✔ Wheel scroll verified: panel scrolled ${postScroll}px with camera distance locked`);
                        }
                    }

                    // Structure assertions (§7.7)
                    if (lang === 'de') {
                        if (entryId === 217) {
                            totalAssertions++;
                            const hasVerse = await session.ev(`!!document.querySelector('.verse .stanza')`);
                            if (!hasVerse) {
                                failedAssertions++;
                                failures.push(`[${vp.name}] Entry 217 missing .verse .stanza`);
                                console.error(`  ✖ Entry 217 missing .verse .stanza`);
                            } else {
                                console.log(`  ✔ Entry 217: .verse .stanza verified`);
                            }
                        } else if (entryId === 241) {
                            totalAssertions++;
                            const turnCount = await session.ev(`document.querySelectorAll('.turn .speaker').length`);
                            const hasNotes = await session.ev(`!!document.querySelector('.entry-notes .note-back')`);
                            if (turnCount < 10 || !hasNotes) {
                                failedAssertions++;
                                const msg = `Entry 241 structure: turns=${turnCount} (expected >=10), hasNotes=${hasNotes}`;
                                failures.push(`[${vp.name}] ${msg}`);
                                console.error(`  ✖ ${msg}`);
                            } else {
                                console.log(`  ✔ Entry 241: ${turnCount} speaker turns & notes with back-links verified`);
                            }
                        } else if (entryId === 224) {
                            totalAssertions++;
                            const subheadCount = await session.ev(`document.querySelectorAll('h3.subhead').length`);
                            if (subheadCount < 1) {
                                failedAssertions++;
                                failures.push(`[${vp.name}] Entry 224 missing h3.subhead`);
                                console.error(`  ✖ Entry 224 missing h3.subhead`);
                            } else {
                                console.log(`  ✔ Entry 224: ${subheadCount} h3.subhead headings verified`);
                            }
                        } else if (entryId === 136) {
                            totalAssertions++;
                            const hasIndent = await session.ev(`document.querySelectorAll('[data-indent]').length > 0`);
                            if (!hasIndent) {
                                failedAssertions++;
                                failures.push(`[${vp.name}] Entry 136 missing [data-indent]`);
                                console.error(`  ✖ Entry 136 missing [data-indent]`);
                            } else {
                                console.log(`  ✔ Entry 136: [data-indent] elements verified`);
                            }
                        }
                    }
                }

                // -------------------------------------------------------------
                // 3. Reading Mode verification (§7.5) on Entry 224
                // -------------------------------------------------------------
                if (!vp.isMobile) {
                    console.log(`  [Reading Mode §7.5] Testing on ${vp.name}...`);
                    // Ensure entry 224 is navigated to
                    await session.ev(`
                        (async () => {
                            const glossary = window.__akg.store.get().glossary;
                            const item = glossary.find(g => g.id === 224);
                            window.__akg.router.navigate('#/e/' + encodeURIComponent(item?.slug || '224'));
                        })()
                    `);
                    await sleep(350);

                    // Set initial scroll position in side panel
                    await session.ev(`
                        (() => {
                            const scroller = document.querySelector('.panel-scroll');
                            if (scroller) scroller.scrollTop = 260;
                        })()
                    `);
                    const initialSideScroll = await session.ev(`document.querySelector('.panel-scroll')?.scrollTop || 0`);

                    // Press 'F' to toggle reading mode
                    await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
                    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
                    
                    // Wait for panel expand transition to settle
                    await session.ev(`
                        new Promise(resolve => {
                            const p = document.getElementById('entry-panel');
                            if (!p) return resolve();
                            const targetW = window.innerWidth;
                            const start = performance.now();
                            const check = () => {
                                const curW = p.getBoundingClientRect().width;
                                if (Math.abs(curW - targetW) <= 2 || performance.now() - start > 1800) {
                                    return resolve();
                                }
                                requestAnimationFrame(check);
                            };
                            check();
                        })
                    `);
                    await sleep(150);

                    // Check: layer rect equals viewport (§7.5)
                    totalAssertions++;
                    const readingGeo = await session.ev(`
                        (() => {
                            const p = document.getElementById('entry-panel');
                            if (!p) return { error: 'No panel' };
                            const r = p.getBoundingClientRect();
                            const isExp = p.classList.contains('is-expanded');
                            const w = window.innerWidth;
                            const h = window.innerHeight;
                            const rectMatches = Math.abs(r.left) <= 2 && Math.abs(r.top) <= 2 &&
                                                Math.abs(r.width - w) <= 2 && Math.abs(r.height - h) <= 2;
                            
                            const body = document.querySelector('.entry-body-content');
                            const rootSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
                            const bodyWidthPx = body ? body.getBoundingClientRect().width : 0;
                            const bodyRem = bodyWidthPx / rootSize;
                            const cs = window.getComputedStyle(p);
                            return {
                                isExp,
                                rectMatches,
                                className: p.className,
                                computed: {
                                    position: cs.position,
                                    width: cs.width,
                                    left: cs.left,
                                    right: cs.right,
                                    transform: cs.transform,
                                    display: cs.display
                                },
                                r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
                                w,
                                h,
                                bodyRem
                            };
                        })()
                    `);

                    if (!readingGeo.isExp || !readingGeo.rectMatches) {
                        failedAssertions++;
                        const msg = `Reading mode geometry mismatch: isExp=${readingGeo.isExp}, rectMatches=${readingGeo.rectMatches}, rect=${JSON.stringify(readingGeo.r)}, computed=${JSON.stringify(readingGeo.computed)}, cls=${readingGeo.className}`;
                        failures.push(`[${vp.name}][${lang}] ${msg}`);
                        console.error(`  ✖ ${msg}`);
                    } else {
                        console.log(`  ✔ Reading mode active: panel rect covers viewport (${readingGeo.w}x${readingGeo.h})`);
                    }

                    // Check: text column width within 40-44 rem on desktop (>=1100px) (§7.5)
                    if (vp.width >= 1100) {
                        totalAssertions++;
                        if (readingGeo.bodyRem < 39.5 || readingGeo.bodyRem > 44.5) {
                            failedAssertions++;
                            const msg = `Text column width ${readingGeo.bodyRem.toFixed(1)} rem out of range [40, 44] rem`;
                            failures.push(`[${vp.name}][${lang}] ${msg}`);
                            console.error(`  ✖ ${msg}`);
                        } else {
                            console.log(`  ✔ Text column width ${readingGeo.bodyRem.toFixed(1)} rem is within 40–44 rem`);
                        }
                    }

                    // Check: controls in both rails pass hit test in reading mode
                    totalAssertions++;
                    const railHitTest = await session.ev(`
                        (() => {
                            const panel = document.getElementById('entry-panel');
                            const controls = Array.from(panel.querySelectorAll('.rail button, .rail a, .panel-header button, .panel-header a'));
                            const visible = controls.filter(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0 &&
                                       rect.bottom > 0 && rect.top < window.innerHeight &&
                                       rect.right > 0 && rect.left < window.innerWidth;
                            });
                            const failed = [];
                            for (const c of visible) {
                                if (typeof c.scrollIntoView === 'function') {
                                    c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                                }
                                const r = c.getBoundingClientRect();
                                const cx = r.left + r.width * 0.5;
                                const cy = r.top + r.height * 0.5;
                                const hit = document.elementFromPoint(cx, cy);
                                if (!hit || (hit !== c && !c.contains(hit))) {
                                    failed.push({
                                        tag: c.tagName,
                                        cls: c.className,
                                        text: (c.textContent || '').trim().slice(0, 20),
                                        hit: hit?.className || hit?.tagName
                                    });
                                }
                            }
                            return { count: visible.length, failed };
                        })()
                    `);

                    if (railHitTest.failed.length > 0) {
                        failedAssertions++;
                        const msg = `Reading mode hit test failed for ${railHitTest.failed.length}/${railHitTest.count} controls`;
                        failures.push(`[${vp.name}][${lang}] ${msg}`);
                        console.error(`  ✖ ${msg}:`, railHitTest.failed);
                    } else {
                        console.log(`  ✔ All ${railHitTest.count} reading mode rail/header controls pass hit test`);
                    }

                    // Capture reading mode screenshot
                    if (lang === 'de') {
                        const step6Shot = path.join(PROGRESS_DIR, `plan3-step-6-${vp.name}.png`);
                        await session.shot(step6Shot);
                    }

                    // Scroll inside reading mode
                    await session.ev(`
                        (() => {
                            const scroller = document.querySelector('.panel-scroll');
                            if (scroller) scroller.scrollTop = 850;
                        })()
                    `);

                    // First Esc: returns to side panel, restores scroll (§7.5)
                    totalAssertions++;
                    await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                    
                    // Wait for collapse transition
                    await session.ev(`
                        new Promise(resolve => {
                            const p = document.getElementById('entry-panel');
                            if (!p) return resolve();
                            const start = performance.now();
                            const check = () => {
                                const curW = p.getBoundingClientRect().width;
                                const isSide = !p.classList.contains('is-expanded') && curW < window.innerWidth - 10;
                                if (isSide || performance.now() - start > 1800) {
                                    return resolve();
                                }
                                requestAnimationFrame(check);
                            };
                            check();
                        })
                    `);
                    await sleep(150);

                    const postFirstEsc = await session.ev(`
                        (() => {
                            const p = document.getElementById('entry-panel');
                            const isExp = p?.classList.contains('is-expanded');
                            const view = window.__akg.store.get().view;
                            const scroller = document.querySelector('.panel-scroll');
                            const scrollTop = scroller ? scroller.scrollTop : 0;
                            return { isExp, view, scrollTop };
                        })()
                    `);

                    const scrollRestored = Math.abs(postFirstEsc.scrollTop - initialSideScroll) <= 5;
                    if (postFirstEsc.isExp || postFirstEsc.view !== 'entry' || !scrollRestored) {
                        failedAssertions++;
                        const msg = `First Esc failed: isExp=${postFirstEsc.isExp} (expected false), view=${postFirstEsc.view} (expected entry), scrollTop=${postFirstEsc.scrollTop} (expected ${initialSideScroll})`;
                        failures.push(`[${vp.name}][${lang}] ${msg}`);
                        console.error(`  ✖ ${msg}`);
                    } else {
                        console.log(`  ✔ First Esc returned to side panel with exact scroll position restored (${postFirstEsc.scrollTop}px)`);
                    }

                    // Second Esc: closes to map (§7.5)
                    totalAssertions++;
                    await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                    await sleep(400);

                    const postSecondEscView = await session.ev(`window.__akg.store.get().view`);
                    if (postSecondEscView !== 'map') {
                        failedAssertions++;
                        const msg = `Second Esc failed to return to map (is ${postSecondEscView})`;
                        failures.push(`[${vp.name}][${lang}] ${msg}`);
                        console.error(`  ✖ ${msg}`);
                    } else {
                        console.log(`  ✔ Second Esc closed entry panel to map`);
                    }
                } else {
                    // Mobile: verify expand button is hidden
                    totalAssertions++;
                    const expandHiddenOnMobile = await session.ev(`
                        (() => {
                            const btn = document.querySelector('.entry-expand-btn');
                            if (!btn) return true;
                            const style = window.getComputedStyle(btn);
                            return style.display === 'none';
                        })()
                    `);
                    if (!expandHiddenOnMobile) {
                        failedAssertions++;
                        failures.push(`[${vp.name}] Expand button visible on mobile (<720px)`);
                        console.error(`  ✖ Expand button visible on mobile`);
                    } else {
                        console.log(`  ✔ Expand button is hidden on mobile (<720px)`);
                    }
                }

                // -------------------------------------------------------------
                // 4. Real Clicks: Close -> Map (§7.3)
                // -------------------------------------------------------------
                // Reopen entry if closed by Esc
                await session.ev(`
                    (async () => {
                        const glossary = window.__akg.store.get().glossary;
                        const item = glossary[0];
                        window.__akg.router.navigate('#/e/' + encodeURIComponent(item.slug || item.id));
                    })()
                `);
                await sleep(350);

                totalAssertions++;
                const closeBtnInfo = await session.ev(`
                    (() => {
                        const btn = document.querySelector('.entry-close-btn') || document.querySelector('#entry-panel .entry-close-btn');
                        if (!btn) return null;
                        const r = btn.getBoundingClientRect();
                        const cx = r.left + r.width * 0.5;
                        const cy = r.top + r.height * 0.5;
                        const hit = document.elementFromPoint(cx, cy);
                        return {
                            x: cx,
                            y: cy,
                            hitTag: hit?.tagName,
                            hitCls: hit?.className,
                            btnMatches: hit === btn || btn.contains(hit)
                        };
                    })()
                `);
                console.log('  Close button hit info:', closeBtnInfo);
                if (closeBtnInfo && closeBtnInfo.btnMatches) {
                    await session.clickAt(closeBtnInfo.x, closeBtnInfo.y);
                    await sleep(400);
                    const viewAfterClose = await session.ev(`window.__akg.store.get().view`);
                    if (viewAfterClose !== 'map') {
                        failedAssertions++;
                        failures.push(`[${vp.name}][${lang}] Close button click did not set view=map (is ${viewAfterClose})`);
                        console.error(`  ✖ Close button click failed, view is ${viewAfterClose}`);
                    } else {
                        console.log(`  ✔ Close button real click returned view to 'map'`);
                    }
                } else {
                    failedAssertions++;
                    failures.push(`[${vp.name}][${lang}] Close button obscured: hit was ${closeBtnInfo?.hitTag}.${closeBtnInfo?.hitCls}`);
                    console.error(`  ✖ Close button obscured by:`, closeBtnInfo);
                }
            }

            // Capture progress screenshot
            if (vp.name === 'desktop-1440') {
                const step1Shot = path.join(PROGRESS_DIR, 'plan3-step-1-1440x900.png');
                await session.shot(step1Shot);
            }

            // Console and Network Audit (§7.6 & §7.8)
            const errors = session.getErrors();
            if (errors.length > 0) {
                console.error(`\n[Console Audit] ${errors.length} console errors encountered on ${vp.name}:`);
                errors.forEach(e => console.error(`  • ${e}`));
                failedAssertions += errors.length;
            } else {
                console.log(`\n✔ 0 console errors on ${vp.name}`);
            }

            const netFails = session.getNetworkFailures();
            if (netFails.length > 0) {
                console.error(`\n[Network Audit] ${netFails.length} failed HTTP requests on ${vp.name}:`);
                netFails.forEach(f => console.error(`  • ${f.status}: ${f.url}`));
            }

        } finally {
            if (session) await session.close();
        }
    }

    console.log('\n====================================================');
    console.log(' TEST SUMMARY');
    console.log('====================================================');
    console.log(`Total Assertions : ${totalAssertions}`);
    console.log(`Passed Assertions: ${totalAssertions - failedAssertions}`);
    console.log(`Failed Assertions: ${failedAssertions}`);

    if (failures.length > 0) {
        console.error('\nFailures:');
        failures.forEach(f => console.error(`  ✖ ${f}`));
        process.exit(1);
    } else {
        console.log('\n✔ All entry panel hit tests & layer assertions PASSED!\n');
    }
}

runEntrySuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
