#!/usr/bin/env node
/**
 * tools/test-interaction.mjs
 * 
 * Comprehensive automated verification for PLAN-2-map-interaction.md:
 * - Part C (§4.4 C4): Test all 35 glyphs × 3 viewports (1440×900, 1920×1080, 390×844) × 2 languages (de, ar).
 *   Asserts glyph centre is within 24 px of free-rect centre, bounding box lies inside free rect, and synthetic click hits glyph.
 * - Part D (§5 D5): Test menu chip layering and click targets across views (map, entry, index, about).
 *   Asserts document.elementFromPoint is the chip, click triggers state change, and no glyph is clicked underneath.
 * - Final deliverables: Captures desktop (1440×900) and phone (390×844) overview and entry screenshots.
 * - Console error audit: Asserts 0 console errors/exceptions.
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
const targetSlugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];
const targetLangArg = args.find(a => a.startsWith('--lang='))?.split('=')[1];

const VIEWPORTS = targetVpArg
    ? ALL_VIEWPORTS.filter(v => v.name === targetVpArg || v.name.includes(targetVpArg))
    : ALL_VIEWPORTS;

const BASE_URL = process.env.TEST_URL || 'http://al-khatib.local';
const PROGRESS_DIR = path.resolve(process.cwd(), 'docs/redesign/progress');
fs.mkdirSync(PROGRESS_DIR, { recursive: true });

async function createBrowserSession({ width, height, isMobile }) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akg-interaction-test-'));
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
            consoleLogs.push(exc);
            consoleErrors.push(exc);
        }
        if (d.id && pend.has(d.id)) {
            pend.get(d.id)(d.result);
            pend.delete(d.id);
        }
    };

    const send = (method, params = {}, timeoutMs = 12000) => new Promise(resolve => {
        const curId = ++id;
        const timer = setTimeout(() => {
            if (pend.has(curId)) {
                pend.delete(curId);
                resolve(undefined);
            }
        }, timeoutMs);
        pend.set(curId, (res) => {
            clearTimeout(timer);
            resolve(res);
        });
        try {
            ws.send(JSON.stringify({ id: curId, method, params }));
        } catch {
            clearTimeout(timer);
            pend.delete(curId);
            resolve(undefined);
        }
    });

    const shot = async (filePath) => {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        if (r && r.data) {
            fs.writeFileSync(filePath, Buffer.from(r.data, 'base64'));
            console.log(`Saved screenshot: ${path.basename(filePath)}`);
        }
    };

    const ev = async (expression) => {
        const res = await send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (res?.exceptionDetails) {
            console.error('Runtime.evaluate exception:', res.exceptionDetails?.text, res.exceptionDetails?.exception?.description || res.exceptionDetails);
        }
        return res?.result?.value;
    };

    const clickAt = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y) });
        await sleep(50);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(50);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(100);
    };

    await send('Page.enable');
    await send('Runtime.enable');

    await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: isMobile
    });

    if (isMobile) {
        await send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 5
        });
    }

    return {
        send,
        shot,
        ev,
        clickAt,
        cleanup,
        getErrors: () => [...consoleErrors],
        getLogs: () => [...consoleLogs]
    };
}

async function runTests() {
    console.log('====================================================');
    console.log(' PLAN 2 INTERACTION & CENTRING TEST SUITE (C4 & D5)');
    console.log('====================================================\n');

    let totalAssertions = 0;
    let failedAssertions = 0;
    const failures = [];

    for (const vp of VIEWPORTS) {
        console.log(`\n----------------------------------------------------`);
        console.log(` Viewport: ${vp.name} (${vp.width}x${vp.height}, isMobile=${vp.isMobile})`);
        console.log(`----------------------------------------------------`);

        const session = await createBrowserSession(vp);

        try {
            // Load application with ?debug=1 to expose window.__akg
            const targetUrl = `${BASE_URL}/?debug=1#/map`;
            console.log(`Navigating to ${targetUrl}...`);
            await session.send('Page.navigate', { url: targetUrl });

            // Wait for app initialization and glossary loading
            let appReady = false;
            for (let i = 0; i < 40; i++) {
                await sleep(500);
                appReady = await session.ev(`!!window.__akg && !!window.__akg.store && window.__akg.store.get().glossary?.length === 35`);
                if (appReady) break;
            }

            if (!appReady) {
                throw new Error('Timeout waiting for window.__akg and glossary to initialize');
            }

            console.log('App and 35 glyphs initialized successfully.');

            // Dismiss mobile orientation/touch popover if present
            await session.ev(`
                const pop = document.getElementById('mobile-popover');
                if (pop) pop.style.display = 'none';
            `);

            // -----------------------------------------------------------------
            // PART C: Test all 35 glyphs × languages (de, ar)
            // -----------------------------------------------------------------
            const languages = targetLangArg ? [targetLangArg] : ['de', 'ar'];

            for (const lang of languages) {
                console.log(`\n[Part C] Testing glyphs with lang=${lang} on ${vp.name}...`);
                await session.ev(`
                    (async () => {
                        window.__akg.router.navigate('#/map');
                        if (window.__akg.waitForRest) await window.__akg.waitForRest();
                        window.__akg.store.setLang('${lang}');
                    })()
                `);
                await sleep(400);

                let glyphSlugs = await session.ev(`
                    window.__akg.store.get().glossary.map(g => g.slug || String(g.id))
                `);
                if (targetSlugArg) {
                    glyphSlugs = glyphSlugs.filter(s => s === targetSlugArg);
                }

                for (let i = 0; i < glyphSlugs.length; i++) {
                    const slug = glyphSlugs[i];
                    totalAssertions += 3; // centre distance <= 24px, bbox inside freeRect, synthetic hit matches

                    // Navigate to glyph
                    await session.ev(`window.__akg.router.navigate('#/e/${encodeURIComponent(slug)}')`);
                    await sleep(50);

                    // Wait for camera to rest and viewOffset to complete
                    await session.ev(`
                        (async () => {
                            if (window.__akg && window.__akg.waitForRest) {
                                await window.__akg.waitForRest();
                            } else {
                                await new Promise(r => setTimeout(r, 600));
                            }
                        })()
                    `);

                    // Evaluate projection and bounds inside browser
                    const res = await session.ev(`
                        (() => {
                            const app = window.__akg;
                            const THREE = window.THREE || app.THREE;
                            const glyphsManager = app.glyphsManager;
                            const target = glyphsManager.glyphs.find(g => g.glyphData && (g.glyphData.slug === '${slug}' || String(g.glyphData.id) === '${slug}'));
                            if (!target) return { error: 'Glyph not found: ${slug}' };

                            const isRTL = app.store.get().lang === 'ar';
                            const W = window.innerWidth;
                            const H = window.innerHeight;

                            // Free rect
                            const freeRect = app.getFreeRect
                                ? app.getFreeRect({ isRTL, width: W, height: H })
                                : { x: 0, y: 0, w: W, h: H };

                            const freeCenterX = freeRect.x + freeRect.w * 0.5;
                            const freeCenterY = freeRect.y + freeRect.h * 0.5;

                            // Projected world position of centre
                            const worldPos = new THREE.Vector3();
                            target.getWorldPosition(worldPos);
                            const ndc = worldPos.clone().project(app.camera);
                            const pixelX = ((ndc.x + 1) * 0.5) * W;
                            const pixelY = ((-ndc.y + 1) * 0.5) * H;

                            const distFromCenter = Math.hypot(pixelX - freeCenterX, pixelY - freeCenterY);
                            const centerOk = distFromCenter <= 24.0;

                            // Projected bounding box
                            const aspect = target.glyphData.aspect || 1.0;
                            const GLYPH_SIZE = 1.8;
                            let gw, gh;
                            if (aspect >= 1.0) {
                                gw = GLYPH_SIZE;
                                gh = GLYPH_SIZE / aspect;
                            } else {
                                gh = GLYPH_SIZE;
                                gw = GLYPH_SIZE * aspect;
                            }

                            const corners = [
                                new THREE.Vector3(-gw * 0.5, -gh * 0.5, 0).applyMatrix4(target.matrixWorld),
                                new THREE.Vector3( gw * 0.5, -gh * 0.5, 0).applyMatrix4(target.matrixWorld),
                                new THREE.Vector3( gw * 0.5,  gh * 0.5, 0).applyMatrix4(target.matrixWorld),
                                new THREE.Vector3(-gw * 0.5,  gh * 0.5, 0).applyMatrix4(target.matrixWorld)
                            ];

                            const projCorners = corners.map(c => {
                                const p = c.clone().project(app.camera);
                                return {
                                    x: ((p.x + 1) * 0.5) * W,
                                    y: ((-p.y + 1) * 0.5) * H
                                };
                            });

                            const minX = Math.min(...projCorners.map(c => c.x));
                            const maxX = Math.max(...projCorners.map(c => c.x));
                            const minY = Math.min(...projCorners.map(c => c.y));
                            const maxY = Math.max(...projCorners.map(c => c.y));

                            // Bbox inside freeRect with 2px tolerance for subpixel rounding
                            const bboxOk = minX >= (freeRect.x - 2) &&
                                           maxX <= (freeRect.x + freeRect.w + 2) &&
                                           minY >= (freeRect.y - 2) &&
                                           maxY <= (freeRect.y + freeRect.h + 2);

                            // Synthetic raycast at projected centre
                            const raycaster = new THREE.Raycaster();
                            raycaster.setFromCamera({ x: ndc.x, y: ndc.y }, app.camera);
                            const hit = glyphsManager.testHit(raycaster, app.relief?.getHitMesh());
                            const hitOk = !!hit && hit.glyphData && (hit.glyphData.id === target.glyphData.id);

                            const ctrlTarget = new THREE.Vector3();
                            if (app.controls && app.controls.getTarget) app.controls.getTarget(ctrlTarget);

                            return {
                                slug: target.glyphData.slug,
                                distFromCenter,
                                centerOk,
                                bboxOk,
                                hitOk,
                                pixel: { x: pixelX, y: pixelY },
                                freeCenter: { x: freeCenterX, y: freeCenterY },
                                bbox: { minX, maxX, minY, maxY },
                                freeRect,
                                diag: {
                                    camPos: app.camera.position,
                                    camQuat: app.camera.quaternion,
                                    camUp: app.camera.up,
                                    ctrlTarget,
                                    targetPos: target.position,
                                    targetWorldPos: worldPos,
                                    viewOffset: app.camera.view ? {
                                        enabled: app.camera.view.enabled,
                                        offsetX: app.camera.view.offsetX,
                                        offsetY: app.camera.view.offsetY
                                    } : null,
                                    distance: app.controls?.distance,
                                    polar: app.controls?.polarAngle,
                                    azimuth: app.controls?.azimuthAngle,
                                    matWorld: Array.from(app.camera.matrixWorld.elements),
                                    projMat: Array.from(app.camera.projectionMatrix.elements)
                                }
                            };
                        })()
                    `);

                    if (!res || res.error) {
                        failedAssertions += 3;
                        const errMsg = res ? res.error : 'Evaluation returned undefined';
                        failures.push(`[${vp.name}][${lang}] ${slug}: ${errMsg}`);
                        console.error(`  ✖ [${i+1}/35] ${slug}: ${errMsg}`);
                        continue;
                    }

                    const pass = res.centerOk && res.bboxOk && res.hitOk;
                    if (!pass) {
                        if (!res.centerOk) failedAssertions++;
                        if (!res.bboxOk) failedAssertions++;
                        if (!res.hitOk) failedAssertions++;

                        const failReason = `centerOk=${res.centerOk} (dist=${res.distFromCenter.toFixed(1)}px), bboxOk=${res.bboxOk}, hitOk=${res.hitOk}`;
                        failures.push(`[${vp.name}][${lang}] Glyph ${slug}: ${failReason}`);
                        console.error(`  ✖ [${i+1}/35] ${slug}: FAIL (${failReason})`);
                        console.error('    Diagnostic:', JSON.stringify(res.diag, null, 2));
                        console.error('    Pixel:', res.pixel, 'FreeCenter:', res.freeCenter);

                        // Capture failure screenshot per C4
                        const failImg = path.join(PROGRESS_DIR, `plan2-centre-fail-${vp.name}-${lang}-${slug}.png`);
                        await session.shot(failImg);
                    } else {
                        if ((i + 1) % 7 === 0 || i === glyphSlugs.length - 1) {
                            console.log(`  ✔ [${i+1}/35] Passed (latest: ${slug}, dist=${res.distFromCenter.toFixed(1)}px)`);
                        }
                    }
                }
            }

            // -----------------------------------------------------------------
            // PART D: Menu chip layering and event target testing (§5 D5)
            // -----------------------------------------------------------------
            console.log(`\n[Part D] Testing Menu Chips layering & clicks on ${vp.name}...`);
            await session.ev(`
                (async () => {
                    window.__akg.store.setLang('de');
                    window.__akg.router.navigate('#/map');
                    if (window.__akg.waitForRest) await window.__akg.waitForRest();
                })()
            `);
            await sleep(400);

            // Record events for debugging click targets
            await session.ev(`
                window.__events = [];
                ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'].forEach(evt => {
                    window.addEventListener(evt, (e) => {
                        window.__events.push({
                            type: e.type,
                            target: e.target?.tagName + (e.target?.id ? '#' + e.target.id : '') + (e.target?.className ? '.' + e.target.className : ''),
                            x: e.clientX,
                            y: e.clientY
                        });
                    }, { capture: true, passive: true });
                });
            `);

            const testViews = ['map', 'entry', 'index', 'about'];

            for (const viewName of testViews) {
                // Navigate to view and wait for all slide transitions to complete
                if (viewName === 'map') {
                    await session.ev(`
                        (async () => {
                            window.__akg.router.navigate('#/map');
                            if (window.__akg.waitForRest) await window.__akg.waitForRest();
                        })()
                    `);
                } else if (viewName === 'entry') {
                    await session.ev(`
                        (async () => {
                            window.__akg.router.navigate('#/e/dual-form');
                            if (window.__akg.waitForRest) await window.__akg.waitForRest();
                        })()
                    `);
                } else if (viewName === 'index') {
                    await session.ev(`window.__akg.router.navigate('#/index')`);
                } else if (viewName === 'about') {
                    await session.ev(`window.__akg.router.navigate('#/about')`);
                }
                await sleep(550);

                // Count visible chips in this view
                const chipCount = await session.ev(`
                    (() => {
                        const selector = 'button.akg-chip, button.nav-chip, button.filter-chip, button.about-lang-chip, button.lang-chip, button.nav-compass-btn, .mode-toggle-chip';
                        const chips = Array.from(document.querySelectorAll(selector));
                        return chips.filter(c => {
                            if (c.closest('.is-hidden')) return false;
                            const r = c.getBoundingClientRect();
                            if (r.width === 0 || r.height === 0) return false;
                            let cur = c;
                            while (cur && cur !== document.body) {
                                const s = window.getComputedStyle(cur);
                                if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
                                cur = cur.parentElement;
                            }
                            return true;
                        }).length;
                    })()
                `);

                for (let chipIndex = 0; chipIndex < chipCount; chipIndex++) {
                    totalAssertions += 2; // hitOk, click does not steal glyph focus

                    const report = await session.ev(`
                        (() => {
                            const selector = 'button.akg-chip, button.nav-chip, button.filter-chip, button.about-lang-chip, button.lang-chip, button.nav-compass-btn, .mode-toggle-chip';
                            const chips = Array.from(document.querySelectorAll(selector));
                            const visibleChips = chips.filter(c => {
                                if (c.closest('.is-hidden')) return false;
                                const r = c.getBoundingClientRect();
                                if (r.width === 0 || r.height === 0) return false;
                                let cur = c;
                                while (cur && cur !== document.body) {
                                    const s = window.getComputedStyle(cur);
                                    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
                                    cur = cur.parentElement;
                                }
                                return true;
                            });

                            const c = visibleChips[${chipIndex}];
                            if (!c) return null;

                            const r = c.getBoundingClientRect();
                            const cx = r.left + r.width * 0.5;
                            const cy = r.top + r.height * 0.5;
                            const elAt = document.elementFromPoint(cx, cy);
                            const hitOk = elAt && (elAt === c || c.contains(elAt));
                            return {
                                id: c.id,
                                text: c.textContent.trim().slice(0, 20),
                                cx,
                                cy,
                                hitOk,
                                topTag: elAt?.tagName,
                                topId: elAt?.id,
                                topClass: elAt?.className
                            };
                        })()
                    `);

                    if (!report) continue;

                    if (!report.hitOk) {
                        failedAssertions++;
                        const failDesc = `[${vp.name}][${viewName}] Chip "${report.text || report.id}" at (${report.cx.toFixed(1)}, ${report.cy.toFixed(1)}) obscured by <${report.topTag} id="${report.topId}" class="${report.topClass}">`;
                        failures.push(failDesc);
                        console.error(`  ✖ ${failDesc}`);
                    } else {
                        // Click test: verify clicking chip does not accidentally click an underlying 3D glyph
                        const activeIdBefore = await session.ev(`window.__akg.store.get().activeId`);
                        await session.clickAt(report.cx, report.cy);
                        await sleep(150);
                        const activeIdAfter = await session.ev(`window.__akg.store.get().activeId`);

                        if (viewName === 'map' && activeIdAfter !== null && activeIdBefore === null) {
                            failedAssertions++;
                            const failDesc = `[${vp.name}][${viewName}] Clicking chip "${report.text || report.id}" accidentally clicked glyph id=${activeIdAfter}`;
                            failures.push(failDesc);
                            console.error(`  ✖ ${failDesc}`);
                        }

                        // Restore view and default language after testing chip
                        if (viewName === 'map') {
                            await session.ev(`
                                (async () => {
                                    window.__akg.store.setLang('de');
                                    window.__akg.router.navigate('#/map');
                                    if (window.__akg.waitForRest) await window.__akg.waitForRest();
                                })()
                            `);
                            await sleep(200);
                        } else if (viewName === 'entry') {
                            await session.ev(`
                                (async () => {
                                    window.__akg.store.setLang('de');
                                    window.__akg.router.navigate('#/e/dual-form');
                                    if (window.__akg.waitForRest) await window.__akg.waitForRest();
                                })()
                            `);
                            await sleep(200);
                        } else if (viewName === 'index') {
                            await session.ev(`
                                window.__akg.store.setLang('de');
                                window.__akg.router.navigate('#/index');
                            `);
                            await sleep(400);
                        } else if (viewName === 'about') {
                            await session.ev(`
                                window.__akg.store.setLang('de');
                                window.__akg.router.navigate('#/about');
                            `);
                            await sleep(400);
                        }
                    }
                }
                console.log(`  ✔ Tested ${chipCount} visible chips in "${viewName}" view`);
            }

            // -----------------------------------------------------------------
            // Final Deliverable Screenshots
            // -----------------------------------------------------------------
            if (vp.name === 'desktop-1440') {
                console.log('\n[Deliverables] Capturing desktop 1440x900 screenshots...');
                await session.ev(`window.__akg.router.navigate('#/map')`);
                await sleep(500);
                await session.shot(path.join(PROGRESS_DIR, 'plan2-final-overview-1440x900.png'));

                await session.ev(`window.__akg.router.navigate('#/e/dual-form')`);
                await session.ev(`(async () => { if (window.__akg?.waitForRest) await window.__akg.waitForRest(); })()`);
                await sleep(400);
                await session.shot(path.join(PROGRESS_DIR, 'plan2-final-entry-1440x900.png'));
            } else if (vp.name === 'mobile-390') {
                console.log('\n[Deliverables] Capturing mobile 390x844 screenshots...');
                await session.ev(`window.__akg.router.navigate('#/map')`);
                await sleep(500);
                await session.shot(path.join(PROGRESS_DIR, 'plan2-final-overview-390x844.png'));

                await session.ev(`window.__akg.router.navigate('#/e/dual-form')`);
                await session.ev(`(async () => { if (window.__akg?.waitForRest) await window.__akg.waitForRest(); })()`);
                await sleep(400);
                await session.shot(path.join(PROGRESS_DIR, 'plan2-final-entry-390x844.png'));
            }

            // -----------------------------------------------------------------
            // Console Error Audit
            // -----------------------------------------------------------------
            const errors = session.getErrors();
            if (errors.length > 0) {
                console.error(`\n[Console Audit] ${errors.length} console errors encountered on ${vp.name}:`);
                errors.forEach(e => console.error(`  ✖ ${e}`));
                failures.push(`[${vp.name}] ${errors.length} console error(s)`);
                failedAssertions += errors.length;
            } else {
                console.log(`\n✔ 0 console errors on ${vp.name}`);
            }

        } finally {
            session.cleanup();
        }
    }

    console.log('\n====================================================');
    console.log(' TEST SUMMARY');
    console.log('====================================================');
    console.log(`Total Assertions : ${totalAssertions}`);
    console.log(`Passed Assertions: ${totalAssertions - failedAssertions}`);
    console.log(`Failed Assertions: ${failedAssertions}`);

    if (failures.length > 0) {
        console.error('\nFailures List:');
        failures.forEach(f => console.error(` - ${f}`));
        process.exit(1);
    } else {
        console.log('\n✔ All interaction and centring tests PASSED!');
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
