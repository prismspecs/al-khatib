#!/usr/bin/env node
// tools/test-phase8.mjs: Tests Phase 8 Post-Processing, Mobile Bottom Sheet, and No-JS fallback

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runSession({ width = 1440, height = 900, isMobile = false }) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-test-'));
    const port = 9500 + Math.floor(Math.random() * 500);

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

    const send = (method, params = {}, timeoutMs = 10000) => new Promise(resolve => {
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
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(r.data, 'base64'));
        console.log(`Saved screenshot: ${filePath}`);
    };

    const ev = async (expression) => {
        const res = await send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        return res?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    if (isMobile) {
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 2,
            mobile: true
        });
        await send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 5
        });
    }

    return {
        send,
        shot,
        ev,
        consoleLogs,
        cleanup
    };
}

async function run() {
    console.log('=== PHASE 8 VERIFICATION: POST-PROCESSING, POLISH & MOBILE ===');

    // 1. Desktop Test (1440x900)
    console.log('\n--- 1. Testing Desktop with Post-Processing (1440x900) ---');
    const desktop = await runSession({ width: 1440, height: 900, isMobile: false });

    try {
        console.log('Navigating to http://al-khatib.local/#/map ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/#/map' });
        await sleep(4000);

        // Nudge render loop
        await desktop.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 720,
            y: 450,
            deltaX: 0,
            deltaY: -1
        });
        await sleep(1500);

        // Check if canvas is rendered
        const hasCanvas = await desktop.ev(`!!document.getElementById('scene-canvas')`);
        console.log('3D canvas present:', hasCanvas);

        await desktop.shot('docs/redesign/progress/phase-8-desktop-map.png');

        // Test deep linking to an entry with post-processing active
        console.log('Navigating to http://al-khatib.local/#/e/al-khatib ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/#/e/al-khatib' });
        await sleep(3500);

        const isPanelOpen = await desktop.ev(`
            const p = document.getElementById('entry-panel');
            p && !p.classList.contains('is-hidden')
        `);
        console.log('Entry panel open on desktop:', isPanelOpen);
        await desktop.shot('docs/redesign/progress/phase-8-desktop-entry.png');

        const errors = desktop.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Desktop console errors: ${errors.length}`);
        if (errors.length > 0) {
            console.log('Errors:', errors);
        }

    } finally {
        desktop.cleanup();
    }

    // 2. Mobile Test (390x844)
    console.log('\n--- 2. Testing Mobile Bottom Sheet & Wall Removal (390x844) ---');
    const mobile = await runSession({ width: 390, height: 844, isMobile: true });

    try {
        console.log('Navigating to mobile http://al-khatib.local/#/map ...');
        await mobile.send('Page.navigate', { url: 'http://al-khatib.local/#/map' });
        await sleep(4000);

        // Check that mobile wall (#mobile-popover) does NOT exist
        const hasMobileWall = await mobile.ev(`!!document.getElementById('mobile-popover')`);
        console.log('Legacy mobile wall present (expected: false):', hasMobileWall);

        await mobile.shot('docs/redesign/progress/phase-8-mobile-map.png');

        // Open entry on mobile -> verify bottom sheet layout
        console.log('Navigating to mobile http://al-khatib.local/#/e/al-khatib ...');
        await mobile.send('Page.navigate', { url: 'http://al-khatib.local/#/e/al-khatib' });
        await sleep(3500);

        const hasDragHandle = await mobile.ev(`
            const h = document.querySelector('.sheet-drag-handle');
            h && getComputedStyle(h).display !== 'none'
        `);
        console.log('Mobile sheet drag handle visible:', hasDragHandle);

        const panelHeight = await mobile.ev(`document.getElementById('entry-panel')?.getBoundingClientRect()?.height || 0`);
        console.log(`Mobile bottom sheet height: ${panelHeight}px`);

        await mobile.shot('docs/redesign/progress/phase-8-mobile-entry.png');

        const mobileErrors = mobile.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Mobile console errors: ${mobileErrors.length}`);
        if (mobileErrors.length > 0) {
            console.log('Mobile errors:', mobileErrors);
        }

    } finally {
        mobile.cleanup();
    }

    console.log('\n=== PHASE 8 VERIFICATION COMPLETE ===');
}

run().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
