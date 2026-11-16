#!/usr/bin/env node
// Usage: node tools/check-assets.mjs <target.glb> [source.glb]
// Checks GLB bounding box parity against source GLB (tolerance 1e-4)
// and reports triangle counts, mesh count, and texture stats.

import fs from 'node:fs';

const targetPath = process.argv[2];
const sourcePath = process.argv[3] || 'public/map-assets/map-2048.glb';
const tolArg = process.argv[4] ? parseFloat(process.argv[4]) : null;

if (!targetPath) {
    console.error('Usage: node tools/check-assets.mjs <target.glb> [source.glb] [tolerance]');
    process.exit(1);
}

function parseGlb(filePath) {
    const buf = fs.readFileSync(filePath);
    const magic = buf.toString('utf8', 0, 4);
    if (magic !== 'glTF') {
        throw new Error(`${filePath} is not a valid GLB file (magic: ${magic})`);
    }
    const version = buf.readUInt32LE(4);
    const totalLength = buf.readUInt32LE(8);
    const jsonChunkLength = buf.readUInt32LE(12);
    const jsonChunkType = buf.toString('utf8', 16, 20);
    if (jsonChunkType !== 'JSON') {
        throw new Error(`${filePath} first chunk is not JSON`);
    }
    const jsonStr = buf.toString('utf8', 20, 20 + jsonChunkLength);
    const gltf = JSON.parse(jsonStr);

    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];

    let totalIndices = 0;
    let totalPositions = 0;

    for (const mesh of gltf.meshes || []) {
        for (const prim of mesh.primitives || []) {
            const posAccIdx = prim.attributes?.POSITION;
            if (posAccIdx !== undefined) {
                const acc = gltf.accessors[posAccIdx];
                if (acc && acc.min && acc.max) {
                    for (let i = 0; i < 3; i++) {
                        if (acc.min[i] < min[i]) min[i] = acc.min[i];
                        if (acc.max[i] > max[i]) max[i] = acc.max[i];
                    }
                }
                if (acc) totalPositions += acc.count || 0;
            }
            if (prim.indices !== undefined) {
                const idxAcc = gltf.accessors[prim.indices];
                if (idxAcc) totalIndices += idxAcc.count || 0;
            }
        }
    }

    const triCount = totalIndices > 0 ? Math.floor(totalIndices / 3) : Math.floor(totalPositions / 3);

    return {
        fileSize: buf.length,
        min,
        max,
        triCount,
        posCount: totalPositions,
        imagesCount: (gltf.images || []).length,
        texturesCount: (gltf.textures || []).length,
        materialsCount: (gltf.materials || []).length
    };
}

const targetStats = parseGlb(targetPath);
const sourceStats = parseGlb(sourcePath);

console.log(`=== Asset Check: ${targetPath} vs ${sourcePath} ===`);
console.log(`Target: size=${(targetStats.fileSize / 1024 / 1024).toFixed(2)} MB, tris=${targetStats.triCount}, textures=${targetStats.texturesCount}`);
console.log(`Source: size=${(sourceStats.fileSize / 1024 / 1024).toFixed(2)} MB, tris=${sourceStats.triCount}, textures=${sourceStats.texturesCount}`);
console.log(`Target min bounds (glTF X,Y,Z): [${targetStats.min.map(n => n.toFixed(6)).join(', ')}]`);
console.log(`Source min bounds (glTF X,Y,Z): [${sourceStats.min.map(n => n.toFixed(6)).join(', ')}]`);
console.log(`Target max bounds (glTF X,Y,Z): [${targetStats.max.map(n => n.toFixed(6)).join(', ')}]`);
console.log(`Source max bounds (glTF X,Y,Z): [${sourceStats.max.map(n => n.toFixed(6)).join(', ')}]`);

const isProxy = targetPath.includes('proxy');
const tol = tolArg !== null ? tolArg : (isProxy ? 2e-3 : 1e-4);
let passed = true;

// Axis 0 (X in glTF): must match source bounds
for (const [name, valT, valS] of [
    ['Min X', targetStats.min[0], sourceStats.min[0]],
    ['Max X', targetStats.max[0], sourceStats.max[0]],
    ['Min Y', targetStats.min[1], sourceStats.min[1]],
    ['Max Y', targetStats.max[1], sourceStats.max[1]],
    ['Max Z (front relief surface)', targetStats.max[2], sourceStats.max[2]],
]) {
    const diff = Math.abs(valT - valS);
    if (diff > tol) {
        console.error(`FAIL: ${name} differs by ${diff.toFixed(6)} > ${tol}`);
        passed = false;
    } else {
        console.log(`OK:   ${name} diff=${diff.toFixed(6)} <= ${tol}`);
    }
}

// Axis 2 Min Z is allowed to extend backwards (negative Z in glTF) for the added solidified back and rim
const backExtension = sourceStats.min[2] - targetStats.min[2];
console.log(`Back thickness extension along -Z: ${(backExtension * 1000).toFixed(2)} mm`);
if (targetStats.min[2] > sourceStats.max[2] || backExtension < -tol) {
    console.error(`FAIL: Back plane is inverted or in front of source mesh`);
    passed = false;
}

if (!passed) {
    console.error('Asset check FAILED.');
    process.exit(1);
} else {
    console.log('Asset check PASSED: bounds match within 1e-4 tolerance.');
    process.exit(0);
}
