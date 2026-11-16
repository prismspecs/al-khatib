import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Loads and manages the About Postcard model (`postcard.opt.glb`).
 */
export function createPostcard({ scene, assetsDir, invalidate, onLoaded }) {
    let postcardObj = null;
    let pendingData = null;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const url = `${assetsDir}postcard.opt.glb`;

    loader.load(
        url,
        (gltf) => {
            postcardObj = gltf.scene.children[0] || gltf.scene;
            postcardObj.name = 'postcard';
            postcardObj.position.set(0, 0, -0.3); // behind the relief at z = -0.3 (PLAN.md §2.4 E)
            postcardObj.rotation.set(
                THREE.MathUtils.degToRad(92),
                THREE.MathUtils.degToRad(3),
                THREE.MathUtils.degToRad(178)
            );
            postcardObj.scale.set(1.0, 1.0, 1.0); // original unit scale matching 6x4.5 bounding box

            postcardObj.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = 0.70;
                        child.material.metalness = 0.0;
                        if (child.material.map) {
                            child.material.map.colorSpace = THREE.SRGBColorSpace;
                        }
                        child.material.needsUpdate = true;
                    }
                }
            });

            if (pendingData) {
                postcardObj.htmlData = pendingData;
            }

            scene.add(postcardObj);
            invalidate(300);

            if (onLoaded) onLoaded(postcardObj);
        },
        undefined,
        (err) => {
            console.error('[Postcard] Failed to load postcard:', err);
        }
    );

    return {
        getMesh: () => postcardObj,
        setData: (data) => {
            pendingData = data;
            if (postcardObj) {
                postcardObj.htmlData = data;
            }
        },
        cleanup: () => {
            if (postcardObj) scene.remove(postcardObj);
        }
    };
}
