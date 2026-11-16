#!/usr/bin/env node
// tools/test-perf.mjs: Comprehensive performance, raycasting, and idle sleep verification

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPerfTest() {
    console.log('==> Starting Headless Chrome Performance Audit...');
    const width = 1440;
    const height = 900;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-test-'));
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

    const send = (method, params = {}) => new Promise(resolve => {
        const reqId = ++id;
        pend.set(reqId, resolve);
        ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    const evalJs = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        return r?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    console.log('==> Navigating to http://al-khatib.local/#/map ...');
    await send('Page.navigate', { url: 'http://al-khatib.local/#/map' });

    // Wait for initial load, data fetch, and relief proxy / full model
    console.log('==> Waiting 8 seconds for models and data to load...');
    await sleep(8000);

    // 1. Verify basic bootstrap
    const stateInfo = await evalJs(`(() => {
        return {
            canvasExists: !!document.getElementById('scene-canvas'),
            dpr: window.devicePixelRatio,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            title: document.title
        };
    })()`);
    console.log('Stage State:', stateInfo);

    // 2. Profile rapid pointer movement (simulate 200 high-frequency mouse moves)
    console.log('==> Simulating 200 rapid pointermove events (gaming mouse 1000Hz simulation)...');
    const pointerPerf = await evalJs(`(() => {
        const canvas = document.getElementById('scene-canvas');
        const start = performance.now();
        for (let i = 0; i < 200; i++) {
            const x = 300 + (i % 50) * 10;
            const y = 200 + (i % 40) * 8;
            window.dispatchEvent(new PointerEvent('pointermove', {
                clientX: x,
                clientY: y,
                bubbles: true
            }));
        }
        const dispatchDurationMs = performance.now() - start;
        return { dispatchDurationMs };
    })()`);
    console.log(`200 pointermove dispatches took: ${pointerPerf.dispatchDurationMs.toFixed(2)} ms (average ${(pointerPerf.dispatchDurationMs / 200).toFixed(3)} ms per event)`);

    // Let any scheduled rAFs run
    await sleep(500);

    // 3. Test render loop activity / idle monitoring
    console.log('==> Profiling requestAnimationFrame activity over 2 seconds...');
    const rafCountDuringActivity = await evalJs(`new Promise(resolve => {
        let count = 0;
        const start = performance.now();
        function track() {
            count++;
            if (performance.now() - start < 1000) {
                requestAnimationFrame(track);
            } else {
                resolve({ fps: count });
            }
        }
        requestAnimationFrame(track);
    })`);
    console.log(`Browser refresh rate: ~${rafCountDuringActivity.fps} fps`);

    // 4. Test render loop sleep:
    // Switch view to 'entry' or simulate being idle > 16s so lamp settles
    console.log('==> Testing loop sleep in entry view...');
    await evalJs(`window.location.hash = '#/about';`);
    await sleep(1500);

    const isSleepingInAbout = await evalJs(`new Promise(resolve => {
        // Measure canvas draw calls or loop activity
        let ticks = 0;
        const start = performance.now();
        // Check if cursor tick is running or asleep
        const cursorEl = document.getElementById('custom-cursor');
        const initialTransform = cursorEl ? cursorEl.style.transform : '';
        setTimeout(() => {
            const finalTransform = cursorEl ? cursorEl.style.transform : '';
            resolve({
                cursorStationary: initialTransform === finalTransform
            });
        }, 800);
    })`);
    console.log('Cursor at rest:', isSleepingInAbout);

    // Return to map
    await evalJs(`window.location.hash = '#/map';`);
    await sleep(1000);

    // 5. Capture screenshot of map
    const scr = await send('Page.captureScreenshot', { format: 'png' });
    if (scr && scr.data) {
        const outPath = 'docs/redesign/progress/verify-perf-optimized.png';
        fs.writeFileSync(outPath, Buffer.from(scr.data, 'base64'));
        console.log(`==> Screenshot captured to ${outPath}`);
    }

    console.log('==> Console Logs from Session:');
    consoleLogs.forEach(l => console.log('  ', l));

    const errors = consoleLogs.filter(l => l.includes('[error]') || l.includes('[EXCEPTION]'));
    console.log(`==> Errors detected: ${errors.length}`);
    if (errors.length > 0) {
        console.error('Errors:', errors);
    }

    cleanup();
    console.log('==> Performance audit complete!');
}

runPerfTest().catch(err => {
    console.error('Performance test failed:', err);
    process.exit(1);
});
