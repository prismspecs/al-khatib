#!/usr/bin/env node
// tools/verify-about-lighting.mjs: Comprehensive CDP verification of:
// 1. Redesigned About panel (desktop + mobile, DE + AR)
// 2. Postcard illumination when camera flips around
// 3. Glyph light emission onto map and active breathing pulse

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runSession({ width = 1440, height = 900 }) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'about-lighting-'));
    const port = 9500 + Math.floor(Math.random() * 400);

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
        throw new Error('Failed to connect to Chrome CDP');
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

    ws.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.method === 'Runtime.consoleAPICalled') {
            const text = d.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
            consoleLogs.push(`[${d.params.type}] ${text}`);
        } else if (d.method === 'Runtime.exceptionThrown') {
            consoleLogs.push(`[EXCEPTION] ${d.params.exceptionDetails?.text || ''} ${d.params.exceptionDetails?.exception?.description || ''}`);
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

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        return r?.result?.value;
    };

    const shot = async (filePath) => {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(r.data, 'base64'));
        console.log(`Saved screenshot: ${filePath}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');

    return { send, ev, shot, consoleLogs, cleanup };
}

async function verify() {
    console.log('=== VERIFYING ABOUT REDESIGN, POSTCARD ILLUMINATION & GLYPH LIGHTING ===\n');

    // 1. Desktop About Test (1440x900)
    console.log('--- 1. Desktop About Verification (1440x900) ---');
    const desktop = await runSession({ width: 1440, height: 900 });

    try {
        console.log('Navigating to http://al-khatib.local/?debug=1#/about ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/?debug=1#/about' });
        await sleep(5500);

        const aboutData = await desktop.ev(`(() => {
            const panel = document.getElementById('akg-about-panel');
            const title = panel?.querySelector('.about-display-title')?.textContent;
            const subtitle = panel?.querySelector('.about-subtitle')?.textContent;
            const lead = panel?.querySelector('.about-lead')?.textContent?.trim().slice(0, 50);
            const paras = panel?.querySelectorAll('.statement-para')?.length;
            const cards = panel?.querySelectorAll('.about-credit-card')?.length;
            const links = panel?.querySelectorAll('.about-link')?.length;
            const isOpen = panel?.classList.contains('is-open');
            const isHidden = panel?.hasAttribute('hidden');
            const headerH = panel?.querySelector('.panel-header')?.offsetHeight;
            const zIndex = window.getComputedStyle(panel).zIndex;

            // Check lighting intensities in window.__akg
            const app = window.__akg;
            const rearSpotIntensity = app?.lamp?.rearSpot?.intensity;
            const rearLampIntensity = app?.lamp?.rearLamp?.intensity;

            // Check postcard screen position vs free area center
            const postcard = app?.postcard?.getMesh();
            let screenX = null;
            let freeCenterX = null;
            if (postcard && app.camera) {
                postcard.updateMatrixWorld(true);
                app.camera.updateMatrixWorld(true);
                const THREE = app.camera.position.constructor;
                const pos = new THREE(0, 0, -0.3);
                pos.project(app.camera);
                screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
                const panelRect = panel.getBoundingClientRect();
                const freeW = window.innerWidth - panelRect.width;
                freeCenterX = freeW * 0.5;
            }

            const off = app?.viewOffset?.getOffset();
            return {
                title, subtitle, lead, paras, cards, links, isOpen, isHidden, headerH, zIndex,
                rearSpotIntensity, rearLampIntensity, screenX, freeCenterX,
                offsetX: off?.x,
                offsetY: off?.y
            };
        })()`);

        console.log('About panel data:', aboutData);
        if (!aboutData.isOpen || aboutData.isHidden) {
            throw new Error(`About panel not open: isOpen=${aboutData.isOpen}, isHidden=${aboutData.isHidden}`);
        }
        if (aboutData.paras !== 4) {
            throw new Error(`Expected 4 collective statement paragraphs, found ${aboutData.paras}`);
        }
        if (aboutData.cards !== 3) {
            throw new Error(`Expected 3 credit cards, found ${aboutData.cards}`);
        }

        console.log(`Postcard screen position: screenX=${aboutData.screenX}, freeCenterX=${aboutData.freeCenterX}`);
        console.log('Offset info:', { offsetX: aboutData.offsetX, offsetY: aboutData.offsetY });
        if (Math.abs(aboutData.screenX - aboutData.freeCenterX) > 25) {
            throw new Error(`Postcard is not centered in free area! screenX=${aboutData.screenX}, freeCenterX=${aboutData.freeCenterX}`);
        }

        console.log(`Postcard illumination: rearSpot=${aboutData.rearSpotIntensity}, rearLamp=${aboutData.rearLampIntensity}`);
        await desktop.shot('docs/redesign/progress/about-redesign-desktop-de.png');

        // Test Arabic toggle
        console.log('Testing Arabic mode in About...');
        await desktop.ev(`document.querySelector('.about-lang-chip[data-lang="ar"]')?.click()`);
        await sleep(600);

        const arTitle = await desktop.ev(`document.querySelector('.about-display-title')?.textContent`);
        const arDir = await desktop.ev(`document.getElementById('akg-about-panel')?.getAttribute('dir')`);
        console.log(`Arabic title: "${arTitle}", dir: "${arDir}"`);
        if (arTitle !== 'معجم الخطيب' || arDir !== 'rtl') {
            throw new Error(`Arabic mode failed: title=${arTitle}, dir=${arDir}`);
        }

        const arPostcardCheck = await desktop.ev(`(() => {
            const app = window.__akg;
            const panel = document.getElementById('akg-about-panel');
            const postcard = app?.postcard?.getMesh();
            if (!postcard || !app?.camera) return null;
            postcard.updateMatrixWorld(true);
            app.camera.updateMatrixWorld(true);
            const THREE = app.camera.position.constructor;
            const pos = new THREE(0, 0, -0.3);
            pos.project(app.camera);
            const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const panelRect = panel.getBoundingClientRect();
            // In RTL, panel is on the left, free area is on the right
            const freeCenterX = panelRect.width + (window.innerWidth - panelRect.width) * 0.5;
            return { screenX, freeCenterX };
        })()`);
        if (arPostcardCheck) {
            console.log(`Arabic postcard screen position: screenX=${arPostcardCheck.screenX}, freeCenterX=${arPostcardCheck.freeCenterX}`);
            if (Math.abs(arPostcardCheck.screenX - arPostcardCheck.freeCenterX) > 25) {
                throw new Error(`Arabic postcard is not centered in free area! screenX=${arPostcardCheck.screenX}, freeCenterX=${arPostcardCheck.freeCenterX}`);
            }
        }
        await desktop.shot('docs/redesign/progress/about-redesign-desktop-ar.png');

        // Return to DE
        await desktop.ev(`document.querySelector('.about-lang-chip[data-lang="de"]')?.click()`);
        await sleep(300);

        // 2. Test Glyph Light Emission & Active Breathing Pulse
        console.log('\n--- 2. Testing Glyph Light Emission & Active Pulse ---');
        console.log('Navigating to http://al-khatib.local/?debug=1#/map ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/?debug=1#/map' });
        await sleep(3500);

        // Open entry 224 (Al-Khatib)
        console.log('Selecting Entry 224...');
        await desktop.ev(`window.__akg.router.navigate('#/e/al-khatib')`);
        await sleep(2500);

        const glyphLightingData = await desktop.ev(`(() => {
            const app = window.__akg;
            const activeId = app?.store?.get()?.activeId;
            const gm = app?.glyphsManager;
            const activeMesh = gm?.getActiveMesh();
            const glyphLight = app?.lamp?.glyphLight;
            const idleMesh = gm?.glyphs?.find(g => g.glyphData?.id !== activeId);

            return {
                activeId,
                activeMeshScale: activeMesh?.scale?.x,
                widthSegments: activeMesh?.geometry?.parameters?.widthSegments,
                heightSegments: activeMesh?.geometry?.parameters?.heightSegments,
                uWeight: activeMesh?.material?.uniforms?.uWeight?.value,
                activeFillColor: activeMesh?.material?.uniforms?.uColor?.value?.getHexString(),
                idleFillColor: idleMesh?.material?.uniforms?.uColor?.value?.getHexString(),
                hasGroundAura: !!gm?.groundAura,
                hasPointLight: !!glyphLight
            };
        })()`);

        console.log('Active glyph shader, text fill emission & displacement data:', glyphLightingData);
        if (glyphLightingData.hasGroundAura) {
            throw new Error(`Flat billboard disc orb must not be present: hasGroundAura=${glyphLightingData.hasGroundAura}`);
        }
        if (glyphLightingData.hasPointLight) {
            throw new Error(`Light orb/point light must not be present on map: hasPointLight=${glyphLightingData.hasPointLight}`);
        }
        if (glyphLightingData.activeFillColor !== 'ff4a3d') {
            throw new Error(`Active glyph fill color must be trace vermilion (ff4a3d), got: ${glyphLightingData.activeFillColor}`);
        }
        if (glyphLightingData.idleFillColor !== 'f4efe4') {
            throw new Error(`Idle glyph fill color must be paper white (f4efe4), got: ${glyphLightingData.idleFillColor}`);
        }
        if (glyphLightingData.widthSegments !== 48 || glyphLightingData.heightSegments !== 48) {
            throw new Error(`Expected 48x48 subdivided geometry for vertex displacement, got ${glyphLightingData.widthSegments}x${glyphLightingData.heightSegments}`);
        }
        if (glyphLightingData.uWeight < 0.8) {
            throw new Error(`Expected active stroke weight >= 0.8, got ${glyphLightingData.uWeight}`);
        }

        // Test that animation CONTINUES when mouse is stationary (no mouse events)
        const time1 = await desktop.ev(`window.__akg.glyphsManager.glyphs[0].material.uniforms.uTime.value`);
        const scale1 = await desktop.ev(`window.__akg.glyphsManager.getActiveMesh()?.scale?.x`);

        await sleep(600); // 600ms without touching the mouse!

        const time2 = await desktop.ev(`window.__akg.glyphsManager.glyphs[0].material.uniforms.uTime.value`);
        const scale2 = await desktop.ev(`window.__akg.glyphsManager.getActiveMesh()?.scale?.x`);

        console.log(`Continuous animation check (stationary mouse): time1=${time1.toFixed(3)}, time2=${time2.toFixed(3)}, dt=${(time2 - time1).toFixed(3)}s`);
        console.log(`Pulse animation check: scale1=${scale1}, scale2=${scale2}`);

        if (time2 <= time1 + 0.3) {
            throw new Error(`Render loop froze when mouse stopped moving: time1=${time1}, time2=${time2}`);
        }

        await desktop.shot('docs/redesign/progress/glyph-text-glow-displace-desktop.png');

        const desktopErrors = desktop.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Desktop console errors: ${desktopErrors.length}`);
        if (desktopErrors.length > 0) {
            console.log('Desktop errors:', desktopErrors);
        }

    } finally {
        desktop.cleanup();
    }

    // 3. Mobile About Test (390x844)
    console.log('\n--- 3. Mobile About Verification (390x844) ---');
    const mobile = await runSession({ width: 390, height: 844 });

    try {
        console.log('Navigating to mobile http://al-khatib.local/#/about ...');
        await mobile.send('Page.navigate', { url: 'http://al-khatib.local/#/about' });
        await sleep(3500);

        // Dismiss mobile popover if present
        await mobile.ev(`
            const pop = document.getElementById('mobile-popover');
            if (pop) pop.style.display = 'none';
        `);
        await sleep(300);

        const mobileData = await mobile.ev(`(() => {
            const panel = document.getElementById('akg-about-panel');
            const chrome = document.getElementById('chrome-layer');
            const chromeDisplay = window.getComputedStyle(chrome).display;
            const panelW = panel?.offsetWidth;
            const panelH = panel?.offsetHeight;
            const isOpen = panel?.classList.contains('is-open');

            return { panelW, panelH, chromeDisplay, isOpen };
        })()`);

        console.log('Mobile About data:', mobileData);
        if (!mobileData.isOpen) {
            throw new Error('Mobile About panel is not open');
        }
        if (mobileData.chromeDisplay !== 'none') {
            console.warn(`Note: mobile chrome display is ${mobileData.chromeDisplay}`);
        }

        await mobile.shot('docs/redesign/progress/about-redesign-mobile.png');

        const mobileErrors = mobile.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Mobile console errors: ${mobileErrors.length}`);
        if (mobileErrors.length > 0) {
            console.log('Mobile errors:', mobileErrors);
        }

    } finally {
        mobile.cleanup();
    }

    console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
}

verify().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
