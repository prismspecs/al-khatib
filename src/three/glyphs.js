import * as THREE from 'three';
import gsap from 'gsap';

export const GLYPH_SIZE = 1.8;

export function calcGlyphDimensions(aspect = 1.0, S = GLYPH_SIZE) {
    const safeAspect = aspect > 0 ? aspect : 1.0;
    const width = safeAspect >= 1.0 ? S : S * safeAspect;
    const height = safeAspect >= 1.0 ? S / safeAspect : S;
    return { width, height };
}

const COLOR_TRACE = new THREE.Color(0xff4a3d); // #ff4a3d --trace
const COLOR_PAPER = new THREE.Color(0xf4efe4); // #f4efe4 --paper

const textureLoader = new THREE.TextureLoader();

/**
 * Vertex shader with real-time 3D wave undulation and normal lift.
 * Displaces vertices smoothly when hovered or active.
 */
const GLYPH_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uWeight;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDisplacement;
varying float vWave;

void main() {
    vUv = uv;
    vec3 pos = position;

    // Organic 3D wave undulation when hovered or active
    // Subdivided PlaneGeometry allows silky smooth wave displacement across the calligraphy
    float wave1 = sin(position.x * 4.2 + uTime * 2.4) * cos(position.y * 3.6 + uTime * 1.8);
    float wave2 = sin((position.x + position.y) * 5.5 - uTime * 3.0) * 0.45;
    float displacement = (wave1 + wave2) * 0.038 * uWeight;

    // Gently lift text off parchment surface and add undulating 3D wave
    pos.z += (0.028 * uWeight) + displacement;

    vDisplacement = displacement;
    vWave = wave1;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/**
 * Fragment shader with self-emitting text fill, breathing radiance, and liquid shimmer.
 * The fill color itself changes and emits — strictly no two-tone outline.
 */
const GLYPH_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uReveal;
uniform float uWeight;
uniform float uTime;
uniform vec3 uLampPos;
uniform float uLampRadius;
uniform float uZoomWeight;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDisplacement;
varying float vWave;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec4 tex = texture2D(uMap, vUv);
    // Luminance of white calligraphy traces on dark background
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

    // 1. Core stroke definition (idle thin vs active wide)
    float strokeIdle = smoothstep(0.25, 0.60, lum);
    float strokeActive = smoothstep(0.08, 0.35, lum);
    float stroke = mix(strokeIdle, strokeActive, uWeight);

    // 2. Soft contoured optical bloom falloff in the EXACT SAME fill color (no outline color)
    float softFalloff = smoothstep(0.015, 0.20, lum) * 0.45 * uWeight;
    float combinedStroke = max(stroke, softFalloff);

    // 3. Procedural organic noise ink wipe on entrance uReveal (0 -> 1)
    float n = vnoise(vUv * 6.0);
    float coord = (1.0 - vUv.y) + (n - 0.5) * 0.25;
    float threshold = mix(-0.25, 1.25, uReveal);
    float wipe = smoothstep(0.0, 0.15, threshold - coord);

    // 4. Inspection lamp proximity reveal
    float dLamp = distance(vWorldPos.xy, uLampPos.xy);
    float proximity = 1.0 - smoothstep(uLampRadius * 0.35, uLampRadius, dLamp);

    // 5. Idle alpha scaled by zoom weight
    float proximityAlpha = mix(uAlpha * 0.40, uAlpha * 2.2, proximity) * uZoomWeight;
    float currentAlpha = mix(clamp(proximityAlpha, 0.05, 0.95), 1.0, uWeight);

    float finalAlpha = combinedStroke * currentAlpha * wipe;
    if (finalAlpha < 0.003) discard;

    // 6. Self-emitting text fill color dynamics
    // The fill color (uColor) is solid and uniform across the entire stroke — NO two-tone outline.
    vec3 col = uColor;
    if (uWeight > 0.02) {
        // Dynamic breathing emission pulse
        float pulse = sin(uTime * 2.2) * 0.5 + 0.5;

        // Liquid light traveling shimmer along calligraphy strokes
        float shimmer = sin(vUv.x * 8.0 + vUv.y * 6.0 - uTime * 2.8 + n * 2.0) * 0.5 + 0.5;
        float shimmerBoost = shimmer * 0.16 * uWeight;

        // 3D wave crest glow modulation from vertex displacement
        float waveHighlight = max(0.0, vWave) * 0.18 * uWeight;

        // Dynamic radiance: text itself emits light from within its fill
        float radiance = 1.0 + (pulse * 0.22 + shimmerBoost + waveHighlight) * uWeight;
        col = uColor * radiance;
    }

    gl_FragColor = vec4(col, finalAlpha);
}
`;

/**
 * Generates an ink mask for picking by ink rather than bounding rectangle (Plan 2 §2 A6).
 * Dilates by 3px so thin lines are easy to target with the cursor.
 */
export function generateInkMask(image, width = 96) {
    if (typeof document === 'undefined' || !image) return null;
    try {
        const aspect = (image.width && image.height) ? (image.width / image.height) : 1.0;
        const height = Math.max(16, Math.round(width / aspect));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;

        ctx.drawImage(image, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Raw binary luminance threshold (>35)
        const rawMask = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            rawMask[i / 4] = lum > 35 ? 1 : 0;
        }

        // 2. Dilate by 3px
        const dilated = new Uint8Array(width * height);
        const radius = 3;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (rawMask[y * width + x] === 1) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                dilated[ny * width + nx] = 1;
                            }
                        }
                    }
                }
            }
        }

        return {
            width,
            height,
            hasInkAtUV: (u, v) => {
                const px = Math.floor(Math.min(Math.max(u, 0), 1) * (width - 1));
                const py = Math.floor(Math.min(Math.max(1.0 - v, 0), 1) * (height - 1));
                return dilated[py * width + px] === 1;
            }
        };
    } catch {
        return null;
    }
}

/**
 * Creates and manages the 35 glyph plane meshes with custom ShaderMaterial,
 * 3D vertex wave displacement, contoured text glowing, and responsive animations.
 * PLAN.md §3.4
 */
export function createGlyphsManager({ scene, invalidate, isRead = () => false }) {
    const glyphsGroup = new THREE.Group();
    glyphsGroup.name = 'glyphs-group';
    scene.add(glyphsGroup);

    const glyphs = [];
    const raycastList = [];
    let activeGlyphId = null;
    let hoveredGlyph = null;

    // Shared uniforms across all 35 glyphs (Plan 2 §2 A4 & A5)
    const sharedLampPos = new THREE.Vector3(0, 0, 0.1);
    const sharedZoomWeight = { value: 1.0 };

    const createGlyphMesh = (data, reliefMesh = null) => {
        let mesh = null;
        const texture = textureLoader.load(data.imageURL, (tex) => {
            if (tex && tex.image && mesh) {
                mesh.inkMask = generateInkMask(tex.image);
            }
            invalidate(100);
        });
        texture.colorSpace = THREE.SRGBColorSpace;

        // Sizing rule - longest side is normalized to GLYPH_SIZE (1.8)
        const aspect = data.aspect || 1.0;
        const { width, height } = calcGlyphDimensions(aspect, GLYPH_SIZE);
        // Subdivided PlaneGeometry (48x48) enables smooth 3D vertex wave displacement
        const geo = new THREE.PlaneGeometry(width, height, 48, 48);

        const read = isRead(data.id);
        const baseColor = COLOR_PAPER;
        const baseAlpha = read ? 0.18 : 0.22;

        const mat = new THREE.ShaderMaterial({
            vertexShader: GLYPH_VERTEX_SHADER,
            fragmentShader: GLYPH_FRAGMENT_SHADER,
            uniforms: {
                uMap: { value: texture },
                uColor: { value: new THREE.Color(baseColor) },
                uAlpha: { value: baseAlpha },
                uReveal: { value: 1.0 },
                uWeight: { value: 0.0 }, // 0.0 = idle, 1.0 = hover/active
                uTime: { value: 0.0 },
                uLampPos: { value: sharedLampPos },
                uLampRadius: { value: 2.2 },
                uZoomWeight: sharedZoomWeight
            },
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            polygonOffset: true,
            polygonOffsetFactor: -2.0,
            polygonOffsetUnits: -4.0,
            side: THREE.DoubleSide
        });

        mesh = new THREE.Mesh(geo, mat);
        mesh.name = `glyph-${data.id}`;
        mesh.glyphData = data;
        mesh.isReadState = read;
        mesh.renderOrder = parseInt(data.id, 10) || 1;

        mesh.position.set(
            parseFloat(data.x) || 0,
            parseFloat(data.y) || 0,
            parseFloat(data.z) || 0.3
        );

        // Rotation comes strictly from ACF; no normal-based tilting
        const rotX = parseFloat(data.rotX) || 0;
        const rotY = parseFloat(data.rotY) || 0;
        const rotZ = parseFloat(data.rotZ) || 0;

        if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
            mesh.rotation.set(
                THREE.MathUtils.degToRad(rotX),
                THREE.MathUtils.degToRad(rotY),
                THREE.MathUtils.degToRad(rotZ)
            );
        }

        if (reliefMesh) {
            surfaceAlign(mesh, reliefMesh);
        }

        // Invisible hit plane uses simple 1x1 geometry for optimal raycasting performance
        const hitGeo = new THREE.PlaneGeometry(width, height);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.name = `glyph-hit-${data.id}`;
        hitMesh.parentGlyph = mesh;
        mesh.add(hitMesh);

        glyphsGroup.add(mesh);
        glyphs.push(mesh);
        raycastList.push(hitMesh);

        return mesh;
    };

    /**
     * Surface height helper: Plan 2 §2 A2
     * Keeps glyph flat on map plane and samples 5 points against relief to float cleanly.
     */
    function surfaceAlign(mesh, reliefMesh) {
        if (!reliefMesh) return;
        const data = mesh.glyphData || {};
        const aspect = data.aspect || 1.0;
        const { width, height } = calcGlyphDimensions(aspect, GLYPH_SIZE);
        const halfW = width * 0.5;
        const halfH = height * 0.5;

        const samplePoints = [
            { x: mesh.position.x, y: mesh.position.y },
            { x: mesh.position.x - halfW, y: mesh.position.y - halfH },
            { x: mesh.position.x + halfW, y: mesh.position.y - halfH },
            { x: mesh.position.x - halfW, y: mesh.position.y + halfH },
            { x: mesh.position.x + halfW, y: mesh.position.y + halfH }
        ];

        let maxSampledHeight = -Infinity;
        const downRay = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1);

        for (const pt of samplePoints) {
            downRay.set(new THREE.Vector3(pt.x, pt.y, 5.0), dir);
            const hits = downRay.intersectObject(reliefMesh, true);
            if (hits.length > 0) {
                maxSampledHeight = Math.max(maxSampledHeight, hits[0].point.z);
            }
        }

        if (maxSampledHeight > -Infinity) {
            const acfZ = parseFloat(data.z) || 0.3;
            mesh.position.z = Math.max(acfZ, maxSampledHeight + 0.03);
        }
    }

    const populate = (items, reliefMesh = null) => {
        glyphs.forEach(g => glyphsGroup.remove(g));
        glyphs.length = 0;
        raycastList.length = 0;

        for (const item of items) {
            if (item.isPostcard || item.id === 550) continue;
            if (!item.imageURL) {
                console.warn('[Glyphs] Skipping entry lacking image:', item.id, item.title);
                continue;
            }
            createGlyphMesh(item, reliefMesh);
        }

        console.log(`[Glyphs] Initialized ${glyphs.length} glyphs on map`);
        invalidate(500);
    };

    /**
     * Staggered intro animation: ink-wipes in all 35 glyphs on entrance
     */
    const playIntro = (staggerMs = 40) => {
        if (glyphs.length === 0) return;

        const shuffled = [...glyphs].sort(() => Math.random() - 0.5);

        shuffled.forEach((glyph, index) => {
            const mat = glyph.material;
            mat.uniforms.uReveal.value = 0.0;

            gsap.to(mat.uniforms.uReveal, {
                value: 1.0,
                duration: 0.65,
                delay: (index * staggerMs) / 1000,
                ease: 'power2.out',
                onUpdate: () => invalidate(60)
            });
        });
    };

    const getActiveMesh = () => {
        return activeGlyphId ? glyphs.find(g => g.glyphData.id === activeGlyphId) : null;
    };

    /**
     * Hover interaction: lifts text, activates 3D wave undulation and contoured glow
     */
    const setHovered = (glyphMesh) => {
        if (hoveredGlyph === glyphMesh) return;

        if (hoveredGlyph && hoveredGlyph !== getActiveMesh()) {
            unhover(hoveredGlyph);
        }

        hoveredGlyph = glyphMesh;

        if (glyphMesh) {
            const mat = glyphMesh.material;
            gsap.killTweensOf(mat.uniforms.uReveal);
            gsap.killTweensOf(mat.uniforms.uAlpha);
            gsap.killTweensOf(mat.uniforms.uWeight);
            gsap.killTweensOf(mat.uniforms.uColor.value);
            gsap.killTweensOf(glyphMesh.scale);

            gsap.to(mat.uniforms.uReveal, { value: 1.0, duration: 0.45, ease: 'power2.out', onUpdate: () => invalidate(60) });
            gsap.to(mat.uniforms.uAlpha, { value: 1.0, duration: 0.25, ease: 'power2.out', onUpdate: () => invalidate(60) });
            gsap.to(mat.uniforms.uWeight, { value: 1.0, duration: 0.25, ease: 'power2.out', onUpdate: () => invalidate(60) });
            gsap.to(mat.uniforms.uColor.value, { r: COLOR_TRACE.r, g: COLOR_TRACE.g, b: COLOR_TRACE.b, duration: 0.25 });
            gsap.to(glyphMesh.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.35, ease: 'power2.out', onUpdate: () => invalidate(60) });
        }
    };

    const unhover = (glyphMesh) => {
        if (!glyphMesh || glyphMesh === getActiveMesh()) return;

        const mat = glyphMesh.material;
        const read = isRead(glyphMesh.glyphData.id);
        const isDimmed = activeGlyphId !== null && glyphMesh.glyphData.id !== activeGlyphId;
        const targetAlpha = isDimmed ? 0.08 : (read ? 0.18 : 0.22);
        const targetColor = COLOR_PAPER;

        gsap.killTweensOf(mat.uniforms.uReveal);
        gsap.killTweensOf(mat.uniforms.uAlpha);
        gsap.killTweensOf(mat.uniforms.uWeight);
        gsap.killTweensOf(mat.uniforms.uColor.value);
        gsap.killTweensOf(glyphMesh.scale);

        gsap.to(mat.uniforms.uReveal, { value: 1.0, duration: 0.35, ease: 'power2.inOut', onUpdate: () => invalidate(60) });
        gsap.to(mat.uniforms.uAlpha, { value: targetAlpha, duration: 0.35, ease: 'power2.inOut', onUpdate: () => invalidate(60) });
        gsap.to(mat.uniforms.uWeight, { value: 0.0, duration: 0.35, ease: 'power2.inOut', onUpdate: () => invalidate(60) });
        gsap.to(mat.uniforms.uColor.value, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: 0.35 });
        gsap.to(glyphMesh.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.35, ease: 'power2.inOut', onUpdate: () => invalidate(60) });
    };

    /**
     * Active state: active glyph glows, undulates in 3D, and stays prominent; others dim to 8%
     */
    const setActiveId = (id) => {
        activeGlyphId = id ? parseInt(id, 10) : null;

        for (const glyph of glyphs) {
            const gid = glyph.glyphData.id;
            const mat = glyph.material;
            const read = isRead(gid);

            gsap.killTweensOf(mat.uniforms.uAlpha);
            gsap.killTweensOf(mat.uniforms.uWeight);
            gsap.killTweensOf(mat.uniforms.uColor.value);
            gsap.killTweensOf(glyph.scale);

            if (activeGlyphId === null) {
                // Return to idle resting state
                const targetAlpha = read ? 0.18 : 0.22;
                const targetColor = COLOR_PAPER;
                gsap.to(mat.uniforms.uAlpha, { value: targetAlpha, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uWeight, { value: 0.0, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uColor.value, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: 0.4 });
                gsap.to(glyph.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
            } else if (gid === activeGlyphId) {
                // Active glyph: fill color changes to emitting trace red with full glow
                gsap.to(mat.uniforms.uAlpha, { value: 1.0, duration: 0.3, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uWeight, { value: 1.0, duration: 0.3, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uColor.value, { r: COLOR_TRACE.r, g: COLOR_TRACE.g, b: COLOR_TRACE.b, duration: 0.3 });
                gsap.to(glyph.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.3, ease: 'power2.out', onUpdate: () => invalidate(60) });
            } else {
                // Dim other glyphs to 8% in resting paper color
                gsap.to(mat.uniforms.uAlpha, { value: 0.08, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uWeight, { value: 0.0, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
                gsap.to(mat.uniforms.uColor.value, { r: COLOR_PAPER.r, g: COLOR_PAPER.g, b: COLOR_PAPER.b, duration: 0.4 });
                gsap.to(glyph.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.4, ease: 'power2.out', onUpdate: () => invalidate(60) });
            }
        }
    };

    /**
     * Updates read state: turns idle read glyphs to paper color at 18%
     */
    const updateReadState = (readEntries = []) => {
        const isReadCheck = (readEntries instanceof Set)
            ? (id) => readEntries.has(id)
            : Array.isArray(readEntries)
                ? (id) => readEntries.includes(id)
                : typeof readEntries === 'function'
                    ? readEntries
                    : () => false;

        for (const glyph of glyphs) {
            const gid = glyph.glyphData.id;
            const isReadNow = isReadCheck(gid);
            glyph.isReadState = isReadNow;

            if (gid !== activeGlyphId && glyph !== hoveredGlyph) {
                const targetAlpha = isReadNow ? 0.18 : 0.22;
                glyph.material.uniforms.uAlpha.value = targetAlpha;
                glyph.material.uniforms.uColor.value.copy(COLOR_PAPER);
            }
        }
        invalidate(100);
    };

    /**
     * Hit test against raycastList with relief occlusion check and per-ink picking.
     */
    const testHit = (raycaster, reliefMesh = null) => {
        if (!raycaster) return null;

        let minReliefDist = Infinity;
        if (reliefMesh) {
            const reliefHits = raycaster.intersectObject(reliefMesh, true);
            if (reliefHits.length > 0) {
                minReliefDist = reliefHits[0].distance;
            }
        }

        const hits = raycaster.intersectObjects(raycastList, false);
        if (!hits || hits.length === 0) return null;

        const validHits = hits.filter(hit => hit.distance <= minReliefDist + 0.12);
        if (validHits.length === 0) return null;

        // Pass 1: Ink mask hit test
        for (const hit of validHits) {
            const glyph = hit.object.parentGlyph;
            if (glyph && glyph.inkMask && hit.uv) {
                if (glyph.inkMask.hasInkAtUV(hit.uv.x, hit.uv.y)) {
                    return glyph;
                }
            }
        }

        // Pass 2: Centre proximity fallback within 35%
        let closestGlyph = null;
        let closestDist = Infinity;

        for (const hit of validHits) {
            if (hit.uv) {
                const du = Math.abs(hit.uv.x - 0.5);
                const dv = Math.abs(hit.uv.y - 0.5);
                if (du <= 0.175 + 1e-4 && dv <= 0.175 + 1e-4) {
                    const distToCenter = Math.sqrt(du * du + dv * dv);
                    if (distToCenter < closestDist) {
                        closestDist = distToCenter;
                        closestGlyph = hit.object.parentGlyph;
                    }
                }
            }
        }

        return closestGlyph;
    };

    /**
     * Per-frame animation update:
     * - updates lamp position, zoom weight, and time uniforms.
     * - drives smooth 3D vertex wave displacement and contoured stroke glow.
     */
    const update = (opts) => {
        let elapsed = 0;
        if (typeof opts === 'number') {
            elapsed = opts;
        } else if (opts) {
            elapsed = opts.elapsedSeconds || 0;
            if (opts.lampPos) {
                sharedLampPos.copy(opts.lampPos);
            }
            if (opts.zoomWeight !== undefined) {
                sharedZoomWeight.value = opts.zoomWeight;
            }
        }

        for (const glyph of glyphs) {
            glyph.material.uniforms.uTime.value = elapsed;
        }

        const activeMesh = getActiveMesh();
        if (activeMesh) {
            // Gentle sinusoidal breathing pulse (frequency ~0.35 Hz)
            const breath = (Math.sin(elapsed * 2.2) + 1) * 0.5; // 0.0 to 1.0

            // 1. Subtle scale pulse
            const s = 1.04 + breath * 0.05;
            activeMesh.scale.set(s, s, s);

            // 2. Stroke weight & glow breathing in fragment shader
            activeMesh.material.uniforms.uWeight.value = 0.90 + breath * 0.20;

            return true;
        } else if (hoveredGlyph) {
            return true;
        } else {
            return false;
        }
    };

    /**
     * Re-aligns all glyphs against the relief mesh to guarantee none are submerged
     */
    const alignToRelief = (reliefMesh) => {
        if (!reliefMesh) return;
        for (const glyph of glyphs) {
            surfaceAlign(glyph, reliefMesh);
        }
        invalidate(200);
    };

    return {
        group: glyphsGroup,
        glyphs,
        raycastList,
        populate,
        playIntro,
        setHovered,
        setActiveId,
        updateReadState,
        alignToRelief,
        testHit,
        update,
        getActiveMesh,
        getHoveredMesh: () => hoveredGlyph,
        hasActivePulse: () => activeGlyphId !== null,
        cleanup: () => {
            scene.remove(glyphsGroup);
        }
    };
}
