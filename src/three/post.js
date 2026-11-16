import * as THREE from 'three';
import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    VignetteEffect,
    NoiseEffect,
    FXAAEffect,
    BlendFunction
} from 'postprocessing';

/**
 * Post-processing pass for Al-Khatib Glossar (PLAN.md §3.2 & Phase 8).
 * - Subtle bloom on red trace highlights
 * - Archival 35mm grain noise
 * - Vignette around the boundaries
 * - SMAA anti-aliasing
 * - Quality tier gating: bypassed completely on mobile / coarse pointers for 60fps performance
 * - 1-second frame-time probe auto-downgrading low-spec hardware
 */
export function createPostProcessing({ renderer, scene, camera, store }) {
    const isCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;
    const isPhone = isCoarse || isMobileWidth;
    const isReducedMotion = store ? store.get().reducedMotion : false;

    if (isPhone) {
        console.log('[Post] Mobile device detected — bypassing post-processing for 60fps performance (PLAN.md §3.2)');
        return {
            enabled: false,
            render: (delta) => renderer.render(scene, camera),
            setSize: () => {},
            cleanup: () => {}
        };
    }

    try {
        const composer = new EffectComposer(renderer, {
            frameBufferType: THREE.HalfFloatType
        });

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // 1. Subtle Bloom on the red traces
        const bloomEffect = new BloomEffect({
            blendFunction: BlendFunction.SCREEN,
            luminanceThreshold: 0.70,
            luminanceSmoothing: 0.25,
            intensity: 0.45,
            mipmapBlur: true
        });

        // 2. Archival 35mm grain noise
        const noiseEffect = new NoiseEffect({
            blendFunction: BlendFunction.OVERLAY,
            premultiply: true
        });
        noiseEffect.blendMode.opacity.value = isReducedMotion ? 0.0 : 0.04;

        // 3. Subtle archival vignette
        const vignetteEffect = new VignetteEffect({
            eskil: false,
            offset: 0.25,
            darkness: 0.40
        });

        // 4. Lightweight FXAA anti-aliasing
        const fxaaEffect = new FXAAEffect();

        const effectPass = new EffectPass(camera, bloomEffect, noiseEffect, vignetteEffect, fxaaEffect);
        composer.addPass(effectPass);

        // 1-second frame-time probe (60 frames)
        let probeFrames = 0;
        let probeTotalDuration = 0;
        let isDowngraded = false;

        return {
            enabled: true,
            render: (delta) => {
                if (isDowngraded) {
                    renderer.render(scene, camera);
                    return;
                }

                if (probeFrames < 60) {
                    const start = performance.now();
                    composer.render(delta);
                    const dur = performance.now() - start;
                    probeTotalDuration += dur;
                    probeFrames++;
                    if (probeFrames === 60) {
                        const avg = probeTotalDuration / 60;
                        if (avg > 20) {
                            console.warn(`[Post] Frame time probe avg ${avg.toFixed(1)}ms (>20ms). Downgrading to low tier.`);
                            isDowngraded = true;
                        }
                    }
                } else {
                    composer.render(delta);
                }
            },
            setSize: (w, h) => {
                composer.setSize(w, h);
            },
            cleanup: () => {
                composer.dispose();
            }
        };
    } catch (err) {
        console.warn('[Post] Post-processing initialization failed, falling back to direct render:', err);
        return {
            enabled: false,
            render: (delta) => renderer.render(scene, camera),
            setSize: () => {},
            cleanup: () => {}
        };
    }
}
