#!/usr/bin/env node
// tools/test-phase7.mjs: Tests Phase 7 Index and About views via CDP

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runSession({ width = 1440, height = 900, isMobile = false }) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase7-test-'));
    const port = 9400 + Math.floor(Math.random() * 500);

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
    console.log('=== PHASE 7 VERIFICATION: INDEX & ABOUT ===');

    // 1. Desktop Test (1440x900)
    console.log('\n--- 1. Testing Desktop Index (1440x900) ---');
    const desktop = await runSession({ width: 1440, height: 900, isMobile: false });

    try {
        console.log('Navigating to http://al-khatib.local/#/index ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/#/index' });
        await sleep(4000);

        // Check if index overlay is visible
        const isIndexVisible = await desktop.ev(`
            const el = document.getElementById('akg-index-overlay');
            el && !el.classList.contains('is-hidden') && getComputedStyle(el).display !== 'none'
        `);
        console.log('Index overlay visible:', isIndexVisible);

        // Count rows
        const rowCount = await desktop.ev(`document.querySelectorAll('.index-row').length`);
        console.log(`Index rows count: ${rowCount} (expected: 35)`);

        // Check filter chips
        const typeChipsCount = await desktop.ev(`document.querySelectorAll('#type-filters .filter-chip').length`);
        console.log(`Type filter chips: ${typeChipsCount}`);

        // Capture initial desktop index screenshot
        await desktop.shot('docs/redesign/progress/phase-7-index-desktop.png');

        // Test hover on row 0
        console.log('Testing hover on first index row...');
        const firstRowRect = await desktop.ev(`
            const r = document.querySelector('.index-row')?.getBoundingClientRect();
            r ? { x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) } : null
        `);
        if (firstRowRect) {
            await desktop.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: firstRowRect.x, y: firstRowRect.y });
            await sleep(400);
            await desktop.shot('docs/redesign/progress/phase-7-index-desktop-hover.png');
        }

        // Test filtering by type
        console.log('Testing type filter...');
        await desktop.ev(`
            const btn = document.querySelector('#type-filters .filter-chip[data-type-filter="stimme"]') ||
                        document.querySelectorAll('#type-filters .filter-chip')[1];
            btn?.click();
        `);
        await sleep(500);
        const filteredCount = await desktop.ev(`document.querySelectorAll('.index-row').length`);
        console.log(`Filtered row count: ${filteredCount}`);
        await desktop.shot('docs/redesign/progress/phase-7-index-desktop-filtered.png');

        // Reset filter
        await desktop.ev(`document.querySelector('#type-filters .filter-chip[data-type-filter="all"]')?.click()`);
        await sleep(300);

        // 2. Testing Desktop About
        console.log('\n--- 2. Testing Desktop About (1440x900) ---');
        console.log('Navigating to http://al-khatib.local/#/about ...');
        await desktop.send('Page.navigate', { url: 'http://al-khatib.local/#/about' });
        await sleep(4000);

        const isAboutVisible = await desktop.ev(`
            const el = document.getElementById('akg-about-panel');
            el && !el.classList.contains('is-hidden') && getComputedStyle(el).display !== 'none'
        `);
        console.log('About panel visible:', isAboutVisible);

        const statementLength = await desktop.ev(`document.querySelector('#about-content-body')?.textContent?.length || 0`);
        console.log(`About content text length: ${statementLength} characters`);

        await desktop.shot('docs/redesign/progress/phase-7-about-desktop.png');

        // Test Arabic toggle in About
        console.log('Testing Arabic mode in About...');
        await desktop.ev(`document.querySelector('.about-lang-chip[data-lang="ar"]')?.click()`);
        await sleep(800);
        const isRtl = await desktop.ev(`document.getElementById('akg-about-panel')?.getAttribute('dir') === 'rtl'`);
        console.log('About dir is RTL:', isRtl);
        await desktop.shot('docs/redesign/progress/phase-7-about-desktop-arabic.png');

        // Check console logs
        const errors = desktop.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Desktop console errors: ${errors.length}`);
        if (errors.length > 0) {
            console.log('Console errors:', errors);
        }

    } finally {
        desktop.cleanup();
    }

    // 3. Mobile Test (390x844)
    console.log('\n--- 3. Testing Mobile (390x844) ---');
    const mobile = await runSession({ width: 390, height: 844, isMobile: true });

    try {
        console.log('Navigating to mobile http://al-khatib.local/#/index ...');
        await mobile.send('Page.navigate', { url: 'http://al-khatib.local/#/index' });
        await sleep(4000);

        // Dismiss mobile popover if present
        await mobile.ev(`
            const pop = document.getElementById('mobile-popover');
            if (pop) pop.style.display = 'none';
        `);
        await sleep(300);

        const mobileRowCount = await mobile.ev(`document.querySelectorAll('.index-row').length`);
        console.log(`Mobile index rows count: ${mobileRowCount}`);
        await mobile.shot('docs/redesign/progress/phase-7-index-mobile.png');

        console.log('Navigating to mobile http://al-khatib.local/#/about ...');
        await mobile.send('Page.navigate', { url: 'http://al-khatib.local/#/about' });
        await sleep(4000);

        await mobile.ev(`
            const pop = document.getElementById('mobile-popover');
            if (pop) pop.style.display = 'none';
        `);
        await sleep(300);

        const isMobileAboutVisible = await mobile.ev(`
            const el = document.getElementById('akg-about-panel');
            el && !el.classList.contains('is-hidden')
        `);
        console.log('Mobile About visible:', isMobileAboutVisible);
        await mobile.shot('docs/redesign/progress/phase-7-about-mobile.png');

        const mobileErrors = mobile.consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[EXCEPTION]'));
        console.log(`Mobile console errors: ${mobileErrors.length}`);
        if (mobileErrors.length > 0) {
            console.log('Mobile errors:', mobileErrors);
        }

    } finally {
        mobile.cleanup();
    }

    console.log('\n=== PHASE 7 VERIFICATION COMPLETE ===');
}

run().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
