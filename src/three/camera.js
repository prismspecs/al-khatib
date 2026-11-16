import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { getFreeRect } from './view-offset.js';

// Install three.js subset into camera-controls (handles Node CJS/ESM interop)
const CC = CameraControls.default || CameraControls;
CC.install({ THREE });

/**
 * Initializes the camera and CameraControls with named camera shots.
 */
export function createCameraControls({ renderer, invalidate }) {
    const aspect = (typeof window !== 'undefined' && window.innerWidth && window.innerHeight)
        ? (window.innerWidth / window.innerHeight)
        : (renderer.domElement?.clientWidth && renderer.domElement?.clientHeight)
            ? (renderer.domElement.clientWidth / renderer.domElement.clientHeight)
            : (16 / 9);

    const camera = new THREE.PerspectiveCamera(
        42,
        aspect,
        0.05,
        100
    );

    // B1. Fix camera frame: relief lies in XY plane and faces +Z
    // camera.up MUST be set to +Z before constructing CameraControls!
    camera.up.set(0, 0, 1);

    const controls = new CC(camera, renderer.domElement);
    controls.updateCameraUp();

    // Feel parameters (Plan 2 §3.2 B2)
    controls.draggingSmoothTime = 0.08;
    controls.smoothTime = 0.35;
    controls.restThreshold = 0.015;

    // Angle and distance constraints for front of map (Plan 2 §3.1 B1)
    // Polar: 0° (looking straight down at paper) to 68° (raking tilt)
    // Azimuth: -100° to +100° (table turn)
    controls.minDistance = 1.6;
    controls.maxDistance = 15.0;
    controls.minPolarAngle = THREE.MathUtils.degToRad(0);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(68);
    controls.minAzimuthAngle = THREE.MathUtils.degToRad(-100);
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(100);

    // Bounding box for camera target: target always stays on the 10x10 paper
    const frontBbox = new THREE.Box3(
        new THREE.Vector3(-5.2, -5.2, 0),
        new THREE.Vector3(5.2, 5.2, 0.6)
    );
    controls.setBoundary(frontBbox);
    controls.boundaryEnclosesCamera = false;

    // Actions (Plan 2 §3.2 B2)
    controls.mouseButtons.left = CC.ACTION.TRUCK;
    controls.mouseButtons.right = CC.ACTION.ROTATE;
    controls.mouseButtons.wheel = CC.ACTION.DOLLY;
    controls.mouseButtons.middle = CC.ACTION.DOLLY;
    controls.mouseButtons.shiftLeft = CC.ACTION.ROTATE;

    controls.dollyToCursor = true;
    controls.dollySpeed = 0.6;
    controls.truckSpeed = 1.0;

    // Touch controls
    controls.touches.one = CC.ACTION.TOUCH_TRUCK;
    controls.touches.two = CC.ACTION.TOUCH_DOLLY_ROTATE;
    controls.touches.three = CC.ACTION.TOUCH_TRUCK;

    // Invalidate loop whenever camera changes
    controls.addEventListener('update', () => invalidate(100));
    controls.addEventListener('controlstart', () => invalidate(300));
    controls.addEventListener('control', () => invalidate(100));

    // Handle window resize
    const onResize = () => {
        if (typeof window !== 'undefined') {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            invalidate(200);
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', onResize);
    }

    const restoreFrontConstraints = () => {
        controls.minAzimuthAngle = THREE.MathUtils.degToRad(-100);
        controls.maxAzimuthAngle = THREE.MathUtils.degToRad(100);
        controls.minPolarAngle = THREE.MathUtils.degToRad(0);
        controls.maxPolarAngle = THREE.MathUtils.degToRad(68);
        controls.setBoundary(frontBbox);
    };

    const liftConstraintsForAbout = () => {
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        const aboutBbox = new THREE.Box3(
            new THREE.Vector3(-5.2, -5.2, -1.0),
            new THREE.Vector3(5.2, 5.2, 1.0)
        );
        controls.setBoundary(aboutBbox);
    };

    const getOverviewDistance = () => {
        const curAspect = (typeof window !== 'undefined' && window.innerWidth && window.innerHeight)
            ? (window.innerWidth / window.innerHeight)
            : (camera.aspect || 1.6);
        const fovRad = THREE.MathUtils.degToRad(camera.fov);
        const tanFov2 = Math.tan(fovRad / 2);
        const polar = THREE.MathUtils.degToRad(32);
        const hProj = 10 * Math.cos(polar); // ~8.48
        const wProj = 10;
        const dHeight = hProj / (2 * tanFov2 * 0.85);
        const dWidth = wProj / (2 * tanFov2 * curAspect * 0.85);
        const d = Math.max(dHeight, dWidth);
        return THREE.MathUtils.clamp(d, 1.6, 14.8);
    };

    // Named Camera Shots (re-derived in spherical coordinates, Plan 2 §3.1 B1)
    const shots = {
        threshold: (enableTransition = true) => {
            restoreFrontConstraints();
            return Promise.all([
                controls.moveTo(0, 0, 0, enableTransition),
                controls.rotateTo(0, THREE.MathUtils.degToRad(12), enableTransition),
                controls.dollyTo(13, enableTransition)
            ]);
        },
        overview: (enableTransition = true) => {
            restoreFrontConstraints();
            const dist = getOverviewDistance();
            return Promise.all([
                controls.moveTo(0, 0, 0.2, enableTransition),
                controls.rotateTo(0, THREE.MathUtils.degToRad(32), enableTransition),
                controls.dollyTo(dist, enableTransition)
            ]);
        },
        glyph: (position, optsOrRTL = false, enableTransition = true) => {
            restoreFrontConstraints();
            const opts = typeof optsOrRTL === 'boolean' ? { isRTL: optsOrRTL } : (optsOrRTL || {});
            const isRTL = !!opts.isRTL;
            const gw = opts.width || 1.8;
            const gh = opts.height || 1.8;

            const px = typeof position.x === 'number' ? position.x : (parseFloat(position.x) || 0);
            const py = typeof position.y === 'number' ? position.y : (parseFloat(position.y) || 0);
            const pz = typeof position.z === 'number' ? position.z : (parseFloat(position.z) || 0.4);

            // Plan 2 §4.2 C2: Fitted distance so glyph fills ~55% of free rect
            const freeRect = getFreeRect({ isRTL });
            const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
            const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
            const fovRad = THREE.MathUtils.degToRad(camera.fov);
            const tanFov2 = Math.tan(fovRad / 2);
            const dHeight = (gh / (2 * tanFov2)) * (H / (freeRect.h || H));
            const dWidth = (gw / (2 * tanFov2)) * (H / (freeRect.w || W));
            const fittedDist = THREE.MathUtils.clamp(
                Math.max(dHeight, dWidth) / 0.55,
                controls.minDistance,
                controls.maxDistance
            );

            // Keep current azimuth unless |azimuth| > 45°, in which case ease it to 0 so writing is upright
            const curAz = controls.azimuthAngle;
            const targetAz = Math.abs(curAz) > THREE.MathUtils.degToRad(45) ? 0 : curAz;
            const targetPolar = THREE.MathUtils.degToRad(28);

            return Promise.all([
                controls.moveTo(px, py, pz, enableTransition),
                controls.rotateTo(targetAz, targetPolar, enableTransition),
                controls.dollyTo(fittedDist, enableTransition)
            ]);
        },
        about: (enableTransition = true) => {
            liftConstraintsForAbout();
            return Promise.all([
                controls.moveTo(0, 0, -0.3, enableTransition),
                controls.rotateTo(Math.PI, THREE.MathUtils.degToRad(150), enableTransition),
                controls.dollyTo(5.0, enableTransition)
            ]);
        }
    };

    // Initial Overview Position (direct spherical placement)
    shots.overview(false);

    return {
        camera,
        controls,
        shots,
        cleanup: () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', onResize);
            }
            controls.dispose();
        }
    };
}
