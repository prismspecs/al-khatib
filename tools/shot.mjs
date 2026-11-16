#!/usr/bin/env node
// Usage: node tools/shot.mjs <url> <outPrefix> [--width=1440] [--height=900] [--mobile] [--wait=14000]
// Drives headless chrome over CDP to capture screenshots and console logs.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node tools/shot.mjs <url> <outPrefix> [--width=1440] [--height=900] [--mobile] [--wait=ms]');
    process.exit(1);
}

const url = args[0];
const outPrefix = args[1];

let width = 1440;
let height = 900;
let isMobile = false;
let waitTime = 12000;

for (const arg of args.slice(2)) {
    if (arg.startsWith('--width=')) width = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--height=')) height = parseInt(arg.split('=')[1], 10);
    else if (arg === '--mobile') isMobile = true;
    else if (arg.startsWith('--wait=')) waitTime = parseInt(arg.split('=')[1], 10);
}

// Ensure parent dir of outPrefix exists
fs.mkdirSync(path.dirname(outPrefix), { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-shot-'));
const port = 9333 + Math.floor(Math.random() * 500);

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
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cleanup = () => {
    try { ch.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
};

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

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
    console.error('Failed to connect to headless Chrome');
    cleanup();
    process.exit(1);
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

const send = (method, params = {}, timeoutMs = 8000) => new Promise(resolve => {
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

const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outPrefix}-${name}.png`, Buffer.from(r.data, 'base64'));
    console.log(`Saved screenshot: ${outPrefix}-${name}.png`);
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

console.log(`Navigating to ${url}...`);
await send('Page.navigate', { url });
await sleep(waitTime);

// Save initial view (Landing/Threshold or Map)
await shot('initial');

// Check if mobile popover is present
const hasMobilePopover = await ev(`!!document.getElementById('mobile-popover') && getComputedStyle(document.getElementById('mobile-popover')).display !== 'none'`);
if (hasMobilePopover) {
    console.log('Dismissing mobile popover...');
    await ev(`document.getElementById('mobile-popover').style.display = 'none'`);
    await sleep(500);
    await shot('mobile-dismissed');
}

// Check if landing or threshold element exists and transition to map
const hasThreshold = await ev(`!!document.getElementById('threshold') && !document.getElementById('threshold').classList.contains('is-hidden')`);
if (hasThreshold) {
    console.log('Transitioning from threshold to map via Enter...');
    await ev(`document.getElementById('threshold-enter-btn')?.click()`);
    await sleep(2500);
} else {
    const hasLanding = await ev(`!!document.getElementById('landing') && getComputedStyle(document.getElementById('landing')).display !== 'none'`);
    if (hasLanding) {
        console.log('Dismissing legacy landing overlay...');
        await ev(`document.getElementById('landing').style.display = 'none'`);
        await sleep(1500);
    }
}

// Nudge wheel / render
await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: Math.floor(width / 2),
    y: Math.floor(height / 2),
    deltaX: 0,
    deltaY: -1
});
await sleep(1500);
await shot('map');

// Hover sweep to check glyphs interaction
if (!isMobile) {
    const hoverPoints = [
        [Math.floor(width * 0.45), Math.floor(height * 0.47)],
        [Math.floor(width * 0.5), Math.floor(height * 0.53)],
        [Math.floor(width * 0.4), Math.floor(height * 0.42)],
        [Math.floor(width * 0.57), Math.floor(height * 0.33)],
    ];
    for (const [x, y] of hoverPoints) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await sleep(200);
    }
    await shot('hover');
}

// Try clicking candidate coordinates for glyphs / entries
let clicked = false;
const clickPoints = [
    [Math.floor(width * 0.45), Math.floor(height * 0.47)],
    [Math.floor(width * 0.5), Math.floor(height * 0.53)],
    [Math.floor(width * 0.4), Math.floor(height * 0.42)],
    [Math.floor(width * 0.57), Math.floor(height * 0.33)],
    [Math.floor(width * 0.35), Math.floor(height * 0.62)],
    [Math.floor(width * 0.62), Math.floor(height * 0.58)]
];

for (const [x, y] of clickPoints) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(300);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(900);
    const isOpen = await ev(`
        (document.getElementById('overlay-outer') && getComputedStyle(document.getElementById('overlay-outer')).display !== 'none') ||
        (document.getElementById('entry-panel') && getComputedStyle(document.getElementById('entry-panel')).display !== 'none')
    `);
    if (isOpen) {
        clicked = true;
        break;
    }
}

await sleep(1000);
await shot('overlay');
console.log('Overlay/Entry opened:', clicked);

// Write console logs
fs.writeFileSync(`${outPrefix}-console.log`, consoleLogs.join('\n'));
console.log(`Saved console log: ${outPrefix}-console.log`);

cleanup();
process.exit(0);
