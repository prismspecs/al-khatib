import * as THREE from 'three';

/**
 * Initializes the Three.js scene, renderer, fog, and viewport handling.
 */
export function createStage(container = document.body) {
    const scene = new THREE.Scene();
    const inkColor = new THREE.Color(0x0b0c10);
    scene.background = inkColor;
    scene.fog = new THREE.FogExp2(inkColor, 0.06);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Color management and tone mapping
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping !== undefined
        ? THREE.AgXToneMapping
        : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.id = 'scene-canvas';
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'auto';

    // Insert canvas behind UI overlays
    if (container.firstChild) {
        container.insertBefore(renderer.domElement, container.firstChild);
    } else {
        container.appendChild(renderer.domElement);
    }

    const onResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    return {
        scene,
        renderer,
        inkColor,
        cleanup: () => {
            window.removeEventListener('resize', onResize);
            if (renderer.domElement.parentElement) {
                renderer.domElement.parentElement.removeChild(renderer.domElement);
            }
            renderer.dispose();
        }
    };
}
