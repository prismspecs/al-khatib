import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Returns the free rectangular region of the viewport not covered by UI panels.
 * Plan 2 §4.1 C1
 */
export function getFreeRect({ isRTL = false, width, height, isExpanded: explicitExpanded } = {}) {
    const W = width || (typeof window !== 'undefined' ? window.innerWidth : 1440);
    const H = height || (typeof window !== 'undefined' ? window.innerHeight : 900);

    // Mobile viewport: bottom sheet occupies ~55% of height
    const isMobile = W <= 720;
    if (isMobile) {
        const panelEl = typeof document !== 'undefined'
            ? (document.querySelector('.about-panel.is-open') || document.getElementById('entry-panel'))
            : null;
        const isAboutOpen = panelEl && panelEl.classList.contains('about-panel');
        if (isAboutOpen) {
            return { x: 0, y: 0, w: W, h: H };
        }
        const isExpanded = typeof explicitExpanded === 'boolean'
            ? explicitExpanded
            : (panelEl && panelEl.classList.contains('is-expanded'));
        if (isExpanded) {
            return { x: 0, y: 0, w: W, h: H };
        }
        const sheetFraction = 0.55;
        return {
            x: 0,
            y: 0,
            w: W,
            h: H * (1.0 - sheetFraction)
        };
    }

    // Desktop
    const panelEl = typeof document !== 'undefined'
        ? (document.querySelector('.about-panel.is-open') || document.querySelector('.akg-panel:not(.is-hidden)'))
        : null;
    const isExpanded = typeof explicitExpanded === 'boolean'
        ? explicitExpanded
        : (panelEl && panelEl.classList.contains('is-expanded'));

    if (isExpanded) {
        // In expanded full-column reading mode, map is background blur
        return { x: 0, y: 0, w: W, h: H };
    }

    let panelWidth = Math.min(720, 0.46 * W);
    if (panelEl) {
        const rect = panelEl.getBoundingClientRect();
        if (rect && rect.width > 0) {
            panelWidth = rect.width;
        }
    }
    const freeW = W - panelWidth;

    if (isRTL) {
        return {
            x: panelWidth,
            y: 0,
            w: freeW,
            h: H
        };
    } else {
        return {
            x: 0,
            y: 0,
            w: freeW,
            h: H
        };
    }
}

/**
 * Calculates (px, py) view offset so the 3D look-at target appears
 * exactly in the centre of the free viewport region.
 */
export function calcViewOffset(freeRect, W = window?.innerWidth || 1440, H = window?.innerHeight || 900) {
    const freeCenterX = freeRect.x + freeRect.w * 0.5;
    const freeCenterY = freeRect.y + freeRect.h * 0.5;
    const vpCenterX = W * 0.5;
    const vpCenterY = H * 0.5;

    return {
        px: vpCenterX - freeCenterX,
        py: vpCenterY - freeCenterY
    };
}

/**
 * Manages smooth camera view offset transitions when opening/closing panels.
 */
export function createViewOffsetManager({ camera, invalidate }) {
    const currentOffset = { x: 0, y: 0 };
    let currentTween = null;

    const apply = (px, py) => {
        currentOffset.x = px;
        currentOffset.y = py;
        const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
        const H = (typeof window !== 'undefined' && window.innerHeight) || 900;

        if (Math.abs(px) < 0.5 && Math.abs(py) < 0.5) {
            camera.clearViewOffset();
        } else {
            camera.setViewOffset(W, H, px, py, W, H);
        }
        if (invalidate) invalidate(60);
    };

    const animateTo = (targetPx, targetPy, duration = 0.5) => {
        if (currentTween) currentTween.kill();
        return new Promise(resolve => {
            currentTween = gsap.to(currentOffset, {
                x: targetPx,
                y: targetPy,
                duration,
                ease: 'power2.inOut',
                onUpdate: () => {
                    apply(currentOffset.x, currentOffset.y);
                },
                onComplete: () => {
                    resolve();
                }
            });
        });
    };

    const clear = (duration = 0.5) => {
        return animateTo(0, 0, duration);
    };

    return {
        getOffset: () => ({ ...currentOffset }),
        setImmediate: (px, py) => {
            if (currentTween) currentTween.kill();
            apply(px, py);
            return Promise.resolve();
        },
        animateTo,
        clear
    };
}
