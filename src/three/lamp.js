import * as THREE from 'three';

/**
 * Creates the inspection lamp lighting setup:
 * - Low-elevation raking SpotLight following the pointer hit point
 * - Cool Prussian-blue fill HemisphereLight
 * - Subtle rim light for paper edges
 * - Lissajous idle drift when pointer is inactive
 * - Postcard illumination (rear lamp + rear archival spotlight)
 */
export function createLamp({ scene, invalidate }) {
    // 1. Key SpotLight (Warm Inspection Lamp)
    const spot = new THREE.SpotLight(0xffeedb, 85);
    spot.position.set(-1.2, -4.0, 3.8); // low raking elevation
    spot.angle = THREE.MathUtils.degToRad(38);
    spot.penumbra = 0.65;
    spot.decay = 2.0;
    spot.distance = 18;

    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 15;
    spot.shadow.bias = -0.0004;
    spot.shadow.radius = 2.0;

    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0, 0.1);
    scene.add(targetObj);
    spot.target = targetObj;
    scene.add(spot);

    // 2. Fill Light (Dim Cool Sky / Ink Ground)
    const fill = new THREE.HemisphereLight(0x27348b, 0x0b0c10, 0.12);
    scene.add(fill);

    // 3. Rim Light (Faint backlight highlighting paper rim)
    const rim = new THREE.DirectionalLight(0x7090b0, 0.35);
    rim.position.set(0, 4.0, -2.5);
    scene.add(rim);

    // 4. Rear Postcard Lighting (Illuminates postcard and reverse relief face in About view)
    const rearLamp = new THREE.DirectionalLight(0xffeedb, 0.6);
    rearLamp.position.set(0.6, -3.2, -4.2);
    scene.add(rearLamp);

    const rearSpot = new THREE.SpotLight(0xfff5ea, 0); // warm archival gallery light
    rearSpot.position.set(0.6, -3.6, -4.6);
    rearSpot.angle = THREE.MathUtils.degToRad(42);
    rearSpot.penumbra = 0.75;
    rearSpot.decay = 1.5;
    rearSpot.distance = 14;
    rearSpot.castShadow = false;

    const postcardTarget = new THREE.Object3D();
    postcardTarget.position.set(0, 0, -0.3);
    scene.add(postcardTarget);
    rearSpot.target = postcardTarget;
    scene.add(rearSpot);

    // Kept as no-op for API compatibility (light emission is strictly on the text mesh itself; no map light orb)
    const setGlyphEmission = () => {};

    // Pointer Tracking & Idle State
    const currentHit = new THREE.Vector3(0, 0, 0.1);
    const targetHit = new THREE.Vector3(0, 0, 0.1);
    let lastPointerTime = performance.now();
    let currentView = 'map';

    const setView = (v) => {
        currentView = v;
        invalidate(200);
    };

    const setPointerTarget = (worldPoint) => {
        if (!worldPoint) return;
        targetHit.copy(worldPoint);
        lastPointerTime = performance.now();
        invalidate(150);
    };



    const update = (delta, now) => {
        const timeSincePointer = (now - lastPointerTime) / 1000;

        // Idle drift only on 'map' view, between 4s and 14s of inactivity
        if (currentView === 'map' && timeSincePointer > 4.0 && timeSincePointer < 14.0) {
            const t = now * 0.0006;
            targetHit.x = 2.0 * Math.sin(t * 0.7);
            targetHit.y = 1.6 * Math.sin(t * 0.5 + 1.2);
            targetHit.z = 0.2;
            invalidate(100);
        } else if (currentView === 'map' && timeSincePointer >= 14.0 && timeSincePointer < 15.5) {
            // Gently ease back to resting overview target
            targetHit.set(0, 0, 0.1);
        }

        // Smooth ease toward inspection lamp target
        let spotMoving = false;
        const distSq = currentHit.distanceToSquared(targetHit);
        if (distSq > 0.00001) {
            currentHit.lerp(targetHit, Math.min(1.0, delta * 4.0 + 0.06));
            targetObj.position.copy(currentHit);

            spot.position.x = currentHit.x - 1.2;
            spot.position.y = currentHit.y - 3.8;
            spot.position.z = Math.max(2.8, currentHit.z + 3.2);

            spotMoving = true;
        } else {
            if (currentHit.x !== targetHit.x || currentHit.y !== targetHit.y || currentHit.z !== targetHit.z) {
                currentHit.copy(targetHit);
                targetObj.position.copy(currentHit);
                spot.position.x = currentHit.x - 1.2;
                spot.position.y = currentHit.y - 3.8;
                spot.position.z = Math.max(2.8, currentHit.z + 3.2);
            }
        }

        // Smooth ease rear postcard lights
        const isAbout = currentView === 'about';
        const targetRearLamp = isAbout ? 1.8 : 0.6;
        const targetRearSpot = isAbout ? 36.0 : 0.0;
        let rearActive = false;

        if (Math.abs(rearLamp.intensity - targetRearLamp) > 0.02) {
            rearLamp.intensity = THREE.MathUtils.lerp(rearLamp.intensity, targetRearLamp, Math.min(1.0, delta * 4.0));
            rearActive = true;
        }
        if (Math.abs(rearSpot.intensity - targetRearSpot) > 0.05) {
            rearSpot.intensity = THREE.MathUtils.lerp(rearSpot.intensity, targetRearSpot, Math.min(1.0, delta * 4.0));
            rearActive = true;
        }

        return spotMoving || rearActive;
    };

    return {
        spot,
        fill,
        rim,
        rearLamp,
        rearSpot,
        targetObj,
        setView,
        setPointerTarget,
        setGlyphEmission,
        update,
        cleanup: () => {
            scene.remove(spot);
            scene.remove(targetObj);
            scene.remove(fill);
            scene.remove(rim);
            scene.remove(rearLamp);
            scene.remove(rearSpot);
            scene.remove(postcardTarget);
            spot.dispose();
            rearLamp.dispose();
            rearSpot.dispose();
        }
    };
}
