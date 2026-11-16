import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import gsap from 'gsap';

/**
 * Manages the 3D photogrammetry relief mesh:
 * - Instant proxy load (`relief_proxy.opt.glb`)
 * - Smooth swap to full production model (`relief.opt.glb`)
 * - Raycasting target support for pointer hit detection
 */
export function createRelief({ scene, assetsDir, invalidate, onLoaded, onProgress }) {
    const group = new THREE.Group();
    group.name = 'relief-group';
    scene.add(group);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    let proxyMesh = null;
    let fullMesh = null;
    let hitMesh = null;

    const configureMesh = (mesh) => {
        mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = false; // Relief has baked normal + AO map; redundant to cast shadows on itself
                child.receiveShadow = true;
                if (child.material) {
                    child.material.roughness = 0.90;
                    child.material.metalness = 0.0;
                }
            }
        });
        mesh.scale.set(10, 10, 10);
    };

    // 1. Load low-res proxy first
    const proxyUrl = `${assetsDir}relief_proxy.opt.glb`;
    const fullUrl = `${assetsDir}relief.opt.glb`;

    loader.load(
        proxyUrl,
        (gltf) => {
            proxyMesh = gltf.scene;
            configureMesh(proxyMesh);
            group.add(proxyMesh);

            hitMesh = proxyMesh.children[0] || proxyMesh;
            invalidate(500);

            if (onLoaded) onLoaded(proxyMesh, false);

            // 2. Load full production model in background
            loader.load(
                fullUrl,
                (fullGltf) => {
                    fullMesh = fullGltf.scene;
                    configureMesh(fullMesh);

                    // Fade in full model
                    fullMesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = true;
                            child.material.opacity = 0.0;
                        }
                    });
                    group.add(fullMesh);

                    // 600 ms cross-fade
                    gsap.to(
                        fullMesh.children.map(c => c.material).filter(Boolean),
                        {
                            opacity: 1.0,
                            duration: 0.6,
                            ease: 'power2.inOut',
                            onUpdate: () => invalidate(100),
                            onComplete: () => {
                                // Retain proxyMesh in scene for fast 8k raycasting, but hide from camera
                                if (proxyMesh) {
                                    proxyMesh.visible = false;
                                }
                                fullMesh.traverse((child) => {
                                    if (child.isMesh && child.material) {
                                        child.material.transparent = false;
                                    }
                                });
                                invalidate(200);
                                if (onProgress) onProgress(100, 'relief');
                                if (onLoaded) onLoaded(fullMesh, true);
                            }
                        }
                    );
                },
                (xhr) => {
                    if (xhr.total > 0 && onProgress) {
                        onProgress(40 + (xhr.loaded / xhr.total) * 60, 'relief');
                    }
                },
                (err) => {
                    console.warn('[Relief] Full model failed to load, keeping proxy:', err);
                }
            );
        },
        (xhr) => {
            if (xhr.total > 0 && onProgress) {
                onProgress((xhr.loaded / xhr.total) * 40, 'proxy');
            }
        },
        (err) => {
            console.error('[Relief] Proxy model failed to load:', err);
        }
    );

    return {
        group,
        getHitMesh: () => (proxyMesh ? (proxyMesh.children[0] || proxyMesh) : (fullMesh ? (fullMesh.children[0] || fullMesh) : null)),
        cleanup: () => {
            scene.remove(group);
        }
    };
}
