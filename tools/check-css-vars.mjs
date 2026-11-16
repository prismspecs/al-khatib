#!/usr/bin/env node
/**
 * tools/check-css-vars.mjs
 * 
 * Verifies that every var(--x) used in src/styles/*.css is explicitly defined in tokens.css (Plan 3 §4 C0).
 */

import fs from 'node:fs';
import path from 'node:path';

const stylesDir = path.resolve(process.cwd(), 'src/styles');
const tokensPath = path.join(stylesDir, 'tokens.css');

if (!fs.existsSync(tokensPath)) {
    console.error(`Error: tokens.css not found at ${tokensPath}`);
    process.exit(1);
}

const tokensContent = fs.readFileSync(tokensPath, 'utf8');
const declared = new Set();
for (const match of tokensContent.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
    declared.add('--' + match[1]);
}

const used = new Map();
const files = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css'));
for (const file of files) {
    const content = fs.readFileSync(path.join(stylesDir, file), 'utf8');
    for (const match of content.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
        const varName = match[1];
        if (!used.has(varName)) used.set(varName, []);
        used.get(varName).push(file);
    }
}

const missing = [];
for (const [varName, usedFiles] of used.entries()) {
    if (!declared.has(varName)) {
        missing.push({ varName, files: Array.from(new Set(usedFiles)) });
    }
}

if (missing.length > 0) {
    console.error(`✖ CSS Variable Validation Failed: ${missing.length} undefined variables in src/styles/`);
    for (const m of missing) {
        console.error(`  • ${m.varName} used in: ${m.files.join(', ')}`);
    }
    process.exit(1);
}

console.log(`✔ All ${used.size} CSS variables used in src/styles/ are defined in tokens.css`);
process.exit(0);
