import './styles/index.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { createStore } from './state.js';
import { createRouter } from './router.js';
import { createStage } from './three/stage.js';
import { createLoop } from './three/loop.js';
import { createCameraControls } from './three/camera.js';
import { createViewOffsetManager, getFreeRect, calcViewOffset } from './three/view-offset.js';
import { createLamp } from './three/lamp.js';
import { createRelief } from './three/relief.js';
import { createPostcard } from './three/postcard.js';
import { createGlyphsManager, calcGlyphDimensions, GLYPH_SIZE } from './three/glyphs.js';
import { createPostProcessing } from './three/post.js';
import { createCursor } from './ui/cursor.js';
import { createChrome } from './ui/chrome.js';
import { createNavControls } from './ui/nav-controls.js';
import { createHoverChip } from './ui/hover-chip.js';
import { createEntryPanel } from './ui/entry-panel.js';
import { createThreshold } from './ui/threshold.js';
import { createIndexView } from './ui/index-view.js';
import { createAbout } from './ui/about.js';
import { fetchGlossaryData, fetchEntryBody } from './data.js';

/**
 * Main application bootstrap.
 */
export async function initApp() {
    const AKG = window.AKG || {};
    const apiBase = AKG.apiBase || '';
    const themeBase = (AKG.themeBase || './').replace(/\/?$/, '/');
    const assetsDir = `${themeBase}map-assets/`;

    // 1. State Store & Router
    const store = createStore({ defaultLang: AKG.defaultLang || 'de' });
    const router = createRouter(store);

    // Set initial document language & direction
    document.documentElement.lang = store.get().lang;
    document.documentElement.dir = store.get().lang === 'ar' ? 'rtl' : 'ltr';

    // 2. Stage (Scene, Renderer, Fog)
    const stage = createStage(document.body);
    const { scene, renderer } = stage;

    // 3. Camera Controls & Named Shots
    let loop = null;
    const cameraModule = createCameraControls({
        renderer,
        invalidate: (ms) => loop && loop.invalidate(ms)
    });
    const { camera, controls, shots } = cameraModule;

    // View offset manager (Plan 2 §4.1 C1)
    const viewOffset = createViewOffsetManager({
        camera,
        invalidate: (ms) => loop && loop.invalidate(ms)
    });
    let storedMapPose = null;
    let currentTransition = null;

    // 4. Inspection Lamp & Lighting
    const lamp = createLamp({
        scene,
        invalidate: (ms) => loop && loop.invalidate(ms)
    });

    const isEditorPlaceMode = typeof window !== 'undefined' && window.location.search.includes('place=1');
    if (isEditorPlaceMode) {
        document.body.style.cursor = 'crosshair';
        console.log('[Editor Helper ?place=1] Click any point on the relief to copy position & surface rotation');
    }

    const isRegisterDebug = typeof window !== 'undefined' && window.location.search.includes('debug=register');
    if (isRegisterDebug) {
        console.log('[Debug ?debug=register] Registration check active');
    }

    // 5. Post-Processing Pass (PLAN.md §3.2 & Phase 8)
    const post = createPostProcessing({
        renderer,
        scene,
        camera,
        store
    });

    const uiRoot = document.getElementById('ui-root');
    function updatePanelWidthVar(view) {
        if (!uiRoot) return;
        if (view === 'entry' || view === 'about') {
            const isMobile = window.innerWidth <= 720;
            const panelW = isMobile ? '0px' : `${Math.min(720, window.innerWidth * 0.46)}px`;
            uiRoot.style.setProperty('--panel-w', panelW);
        } else {
            uiRoot.style.setProperty('--panel-w', '0px');
        }
    }

    window.addEventListener('resize', () => {
        if (post) post.setSize(window.innerWidth, window.innerHeight);
        const currentView = store.get().view;
        updatePanelWidthVar(currentView);
        if (currentView === 'entry' || currentView === 'about') {
            const freeRect = getFreeRect({ isRTL: store.get().lang === 'ar' });
            const offset = calcViewOffset(freeRect, window.innerWidth, window.innerHeight);
            viewOffset.setImmediate(offset.px, offset.py);
        }
    });

    // 6. Render Loop
    let pointerNeedsRaycast = false;
    let processPointerRaycast = () => {};

    loop = createLoop({
        renderer,
        scene,
        camera,
        post,
        onUpdate: (delta, now) => {
            if (store.get().isReadingMode) {
                return false;
            }
            processPointerRaycast();
            const controlsActive = controls.update(delta);
            const lampActive = lamp.update(delta, now);

            // Plan 2 §2 A5: Compute zoom weight from controls.distance (1.6 to 15.0)
            const zoomT = THREE.MathUtils.clamp((15.0 - controls.distance) / (15.0 - 1.6), 0.0, 1.0);
            const zoomWeight = THREE.MathUtils.lerp(0.7, 1.3, zoomT);

            const glyphsActive = glyphsManager.update({
                elapsedSeconds: now / 1000,
                lampPos: lamp.targetObj.position,
                zoomWeight
            });

            const currentView = store.get().view;
            const isCanvasVisible = currentView === 'map' || currentView === 'entry' || currentView === 'about';

            return isCanvasVisible || controlsActive || lampActive || pointerNeedsRaycast || glyphsActive;
        }
    });

    // 7. UI Root, Custom Cursor & Threshold
    const cursor = createCursor(document.body);
    const threshold = createThreshold({
        container: uiRoot || document.body,
        router,
        store,
        shots
    });

    // 7. 3D Relief (Proxy -> Full Swap)
    const relief = createRelief({
        scene,
        assetsDir,
        invalidate: loop.invalidate,
        onLoaded: (mesh, isFull) => {
            console.log(`[Relief] Loaded ${isFull ? 'full model' : 'proxy'}`);
            if (glyphsManager) glyphsManager.alignToRelief(relief.getHitMesh());
            loop.invalidate(500);
        },
        onProgress: (pct, label) => {
            if (threshold) threshold.updateProgress(pct, label);
        }
    });

    // 8. Postcard (About)
    const postcard = createPostcard({
        scene,
        assetsDir,
        invalidate: loop.invalidate
    });

    // 9. Glyphs Manager
    const glyphsManager = createGlyphsManager({
        scene,
        invalidate: loop.invalidate,
        isRead: (id) => store.isRead(id)
    });

    // 10. Hover Chip, Entry Panel, Index View, About View & Chrome
    const hoverChip = createHoverChip(uiRoot);
    const entryPanel = createEntryPanel({
        container: uiRoot,
        router,
        store,
        glyphsManager
    });

    const aboutView = createAbout({
        container: uiRoot,
        router,
        store
    });

    const indexView = createIndexView({
        container: uiRoot,
        router,
        store,
        glyphsManager,
        lamp
    });

    const chrome = createChrome({
        container: uiRoot,
        store,
        router
    });

    const navControls = createNavControls({
        container: uiRoot,
        controls,
        shots,
        store
    });

    let hasPlayedIntro = false;

    // 11. Fetch Data
    try {
        const { glyphs, aboutPost } = await fetchGlossaryData(apiBase);
        store.setGlossary(glyphs);
        glyphsManager.populate(glyphs, relief.getHitMesh());
        glyphsManager.updateReadState(store.get().readEntries);

        if (isRegisterDebug) {
            controls.rotateTo(0, 0, false);
            controls.moveTo(0, 0, 0, false);
            controls.dollyTo(12.5, false);
            glyphsManager.glyphs.forEach(g => {
                g.material.uniforms.uAlpha.value = 1.0;
                g.material.uniforms.uWeight.value = 1.0;
                g.material.uniforms.uReveal.value = 1.0;
            });
            loop.invalidate(500);
        }

        if (aboutPost) {
            const postcardData = {
                title: aboutPost.title,
                author: aboutPost.author,
                post: aboutPost.content,
                URL: aboutPost.link
            };
            postcard.setData(postcardData);
            aboutView.setData(postcardData);
        }
    } catch (err) {
        console.error('[App] Failed to load glossary posts:', err);
    }

    // 11. Raycasting & Interaction (Throttled to 1/frame)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-999, -999);
    let hoveredGlyph = null;
    let isCameraDragging = false;

    let pendingPointerX = null;
    let pendingPointerY = null;

    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;
    const canvas = renderer.domElement;

    const onPointerMove = (e) => {
        if (store.get().isReadingMode) return;
        // Stop canvas raycasting and clear hover when over HTML UI (Plan 2 §5 D3)
        if (e.target !== canvas) {
            if (hoveredGlyph) {
                glyphsManager.setHovered(null);
                hoveredGlyph = null;
                if (hoverChip) hoverChip.hide();
            }
            cursor.setHovering(false);
            pointerNeedsRaycast = false;
            return;
        }

        pendingPointerX = e.clientX;
        pendingPointerY = e.clientY;
        pointerNeedsRaycast = true;
        loop.invalidate(120);
    };

    processPointerRaycast = () => {
        if (store.get().isReadingMode) return;
        if (!pointerNeedsRaycast || pendingPointerX === null) return;
        pointerNeedsRaycast = false;

        // Plan 2 §2 A6: Suppress hover entirely while a drag is in progress
        if (isCameraDragging) {
            if (hoveredGlyph) {
                glyphsManager.setHovered(null);
                hoveredGlyph = null;
                if (hoverChip) hoverChip.hide();
            }
            cursor.setHovering(false);
            return;
        }

        const rect = canvas.getBoundingClientRect();
        pointer.x = ((pendingPointerX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((pendingPointerY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);

        const currentView = store.get().view;
        const hitMesh = relief.getHitMesh();

        // Raycast against relief for inspection lamp target
        if (hitMesh && (currentView === 'map' || currentView === 'threshold')) {
            const hits = raycaster.intersectObject(hitMesh, true);
            if (hits.length > 0) {
                lamp.setPointerTarget(hits[0].point);
            }
        }

        // Raycast against glyphs with relief occlusion check (PLAN.md §3.4)
        if (currentView === 'map' || currentView === 'threshold') {
            const hitGlyph = glyphsManager.testHit(raycaster, hitMesh);
            if (hitGlyph) {
                if (hoveredGlyph !== hitGlyph) {
                    hoveredGlyph = hitGlyph;
                    glyphsManager.setHovered(hoveredGlyph);
                    if (hoverChip) hoverChip.show(hoveredGlyph.glyphData, { x: pendingPointerX, y: pendingPointerY });
                    if (!store.get().activeId) {
                        lamp.setGlyphEmission(hoveredGlyph.position, 2.8, false);
                    }
                }
                if (hoverChip) hoverChip.updatePos(pendingPointerX, pendingPointerY);
                cursor.setHovering(true);
            } else {
                if (hoveredGlyph) {
                    glyphsManager.setHovered(null);
                    hoveredGlyph = null;
                    if (hoverChip) hoverChip.hide();
                    if (!store.get().activeId) {
                        lamp.setGlyphEmission(null, 0, false);
                    }
                }
                // Check postcard hit
                const pMesh = postcard.getMesh();
                if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
                    cursor.setHovering(true);
                } else {
                    cursor.setHovering(false);
                }
            }
        } else if (hoveredGlyph) {
            glyphsManager.setHovered(null);
            hoveredGlyph = null;
            if (hoverChip) hoverChip.hide();
            if (!store.get().activeId) {
                lamp.setGlyphEmission(null, 0, false);
            }
            cursor.setHovering(false);
        }
    };

    const onPointerDown = (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        pointerDownTime = performance.now();
    };

    const onPointerUp = (e) => {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dt = performance.now() - pointerDownTime;

        // Click definition: moved < 5px and held < 400ms (PLAN.md §3.4)
        if (dist < 5 && dt < 400) {
            handleClick(e);
        }
    };

    const handleClick = (e) => {
        // Stop canvas clicks from firing on HTML UI chips or panels (Plan 2 §5 D3)
        if (e && e.target !== canvas) return;
        const currentView = store.get().view;

        raycaster.setFromCamera(pointer, camera);

        if (currentView === 'entry') {
            // Plan 2 §4.3 C3: Clicking empty paper (not a drag) closes the entry; clicking another glyph navigates
            const hitGlyph = glyphsManager.testHit(raycaster, relief.getHitMesh());
            if (hitGlyph && hitGlyph.glyphData) {
                router.navigate(`#/e/${encodeURIComponent(hitGlyph.glyphData.slug || hitGlyph.glyphData.id)}`);
            } else {
                router.navigate('#/map');
            }
            return;
        }

        // 0. Editor helper mode (?place=1)
        if (isEditorPlaceMode && relief.getHitMesh()) {
            const rHits = raycaster.intersectObject(relief.getHitMesh(), true);
            if (rHits.length > 0) {
                const hit = rHits[0];
                const pt = hit.point;
                const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
                const eul = new THREE.Euler().setFromQuaternion(q);
                const rx = THREE.MathUtils.radToDeg(eul.x).toFixed(1);
                const ry = THREE.MathUtils.radToDeg(eul.y).toFixed(1);
                const rz = THREE.MathUtils.radToDeg(eul.z).toFixed(1);
                const snippet = `position: { x: "${pt.x.toFixed(2)}", y: "${pt.y.toFixed(2)}", z: "${(pt.z + 0.05).toFixed(2)}" }\nrotation: { x: "${rx}", y: "${ry}", z: "${rz}" }`;
                console.log(`[Editor Helper ?place=1]\n${snippet}`);
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(snippet).catch(() => {});
                }
            }
        }

        // 1. Check glyphs with occlusion check (PLAN.md §3.4)
        const hitGlyph = glyphsManager.testHit(raycaster, relief.getHitMesh());
        if (hitGlyph) {
            const data = hitGlyph.glyphData;
            if (data) {
                if (hoverChip) hoverChip.hide();
                router.navigate(`#/e/${encodeURIComponent(data.slug || data.id)}`);
            }
            return;
        }

        // 2. Check postcard
        const pMesh = postcard.getMesh();
        if (pMesh) {
            const postHits = raycaster.intersectObject(pMesh, true);
            if (postHits.length > 0) {
                router.navigate('#/about');
            }
        }
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointerup', () => { pointerDownTime = 0; }, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Plan 2 §3.2 B2: Prevent browser context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Plan 2 §3.2 B2: Double-click on paper zooms in one step toward hit point
    canvas.addEventListener('dblclick', (e) => {
        if (store.get().view !== 'map') return;
        const rect = canvas.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(px, py), camera);
        const hitMesh = relief.getHitMesh();
        if (hitMesh) {
            const hits = raycaster.intersectObject(hitMesh, true);
            if (hits.length > 0) {
                const pt = hits[0].point;
                controls.moveTo(pt.x, pt.y, pt.z, true);
                controls.dollyTo(Math.max(controls.minDistance, controls.distance * 0.55), true);
            }
        }
    });

    // Plan 2 §3.4 B4: Hint dismisses only after both first drag AND first zoom
    let hasDragged = false;
    let hasZoomed = false;
    const checkHintDismiss = () => {
        if (hasDragged && hasZoomed) {
            const hint = document.getElementById('chrome-hint');
            if (hint) {
                hint.style.opacity = '0';
                setTimeout(() => { hint.style.display = 'none'; }, 1000);
            }
        }
    };

    controls.addEventListener('controlstart', () => {
        isCameraDragging = true;
        cursor.setDragging(true);
        hasDragged = true;
        checkHintDismiss();
    });

    controls.addEventListener('controlend', () => {
        isCameraDragging = false;
        cursor.setDragging(false);
    });

    controls.addEventListener('dolly', () => {
        hasZoomed = true;
        checkHintDismiss();
    });

    // Plan 2 §3.2 B2: Full keyboard navigation
    const onKeyDown = (e) => {
        if (e.target && e.target.matches('input, textarea, select, [contenteditable]')) return;
        const currentView = store.get().view;
        if (currentView !== 'map') return;

        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            navControls.setMode('turn');
            cursor.setRotating(true);
            return;
        }

        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            if (e.shiftKey) {
                controls.rotate(-THREE.MathUtils.degToRad(5), 0, true);
            } else {
                controls.truck(-0.6, 0, true);
            }
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            if (e.shiftKey) {
                controls.rotate(THREE.MathUtils.degToRad(5), 0, true);
            } else {
                controls.truck(0.6, 0, true);
            }
        } else if (e.code === 'ArrowUp') {
            e.preventDefault();
            if (e.shiftKey) {
                controls.rotate(0, -THREE.MathUtils.degToRad(5), true);
            } else {
                controls.truck(0, 0.6, true);
            }
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            if (e.shiftKey) {
                controls.rotate(0, THREE.MathUtils.degToRad(5), true);
            } else {
                controls.truck(0, -0.6, true);
            }
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            controls.dolly(1.2, true);
            hasZoomed = true;
            checkHintDismiss();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            controls.dolly(-1.2, true);
            hasZoomed = true;
            checkHintDismiss();
        } else if (e.code === 'KeyQ') {
            e.preventDefault();
            controls.rotate(-THREE.MathUtils.degToRad(30), 0, true);
        } else if (e.code === 'KeyE') {
            e.preventDefault();
            controls.rotate(THREE.MathUtils.degToRad(30), 0, true);
        } else if (e.code === 'KeyR' || e.code === 'Digit0') {
            e.preventDefault();
            shots.overview(true);
        }
    };

    const onKeyUp = (e) => {
        if (e.code === 'Space') {
            navControls.setMode('move');
            cursor.setRotating(false);
        }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 13. Store Subscriptions & View Transitions
    store.subscribe((state, key, val) => {
        if (key === 'view') {
            if (lamp) lamp.setView(val);
            if (val === 'threshold') {
                threshold.show();
                shots.threshold(true);
                entryPanel.close(false);
                viewOffset.clear(0.3);
                indexView.hide();
                aboutView.hide();
            } else {
                threshold.hide();
                updatePanelWidthVar(val);
                if (val === 'map') {
                    lamp.setGlyphEmission(null, 0, false);
                    entryPanel.close(false);
                    viewOffset.clear(0.5);
                    indexView.hide();
                    aboutView.hide();

                    // Plan 2 §3.5 B5: Restore saved map pose or return to overview
                    if (storedMapPose) {
                        Promise.all([
                            controls.moveTo(storedMapPose.target.x, storedMapPose.target.y, storedMapPose.target.z, true),
                            controls.rotateTo(storedMapPose.azimuth, storedMapPose.polar, true),
                            controls.dollyTo(storedMapPose.distance, true)
                        ]);
                        storedMapPose = null;
                    } else {
                        shots.overview(true);
                    }

                    if (!hasPlayedIntro) {
                        hasPlayedIntro = true;
                        glyphsManager.playIntro();
                    }
                } else if (val === 'index') {
                    indexView.show();
                    aboutView.hide(false, true);
                    entryPanel.close(false, true);
                    viewOffset.clear(0.3);
                } else if (val === 'about') {
                    aboutView.show();
                    indexView.hide(false, true);
                    entryPanel.close(false, true);
                    const isRTL = store.get().lang === 'ar';
                    const freeRect = getFreeRect({ isRTL });
                    const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
                    const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
                    const offset = calcViewOffset(freeRect, W, H);
                    viewOffset.animateTo(offset.px, offset.py, 0.5);
                    shots.about(true);
                } else if (val === 'entry') {
                    indexView.hide(false, true);
                    aboutView.hide(false, true);
                }
            }
            loop.invalidate(800);
        }

        if (key === 'active') {
            glyphsManager.setActiveId(val?.id || null);
            if (val && val.id) {
                // Save current map pose before zooming into glyph (Plan 2 §3.5 B5)
                if (state.view === 'map' && !storedMapPose) {
                    const curTgt = new THREE.Vector3();
                    controls.getTarget(curTgt);
                    storedMapPose = {
                        target: curTgt.clone(),
                        azimuth: controls.azimuthAngle,
                        polar: controls.polarAngle,
                        distance: controls.distance
                    };
                }

                const target = glyphsManager.glyphs.find(g => g.glyphData && g.glyphData.id === val.id);
                if (target) {
                    const isRTL = store.get().lang === 'ar';
                    const dims = calcGlyphDimensions(target.glyphData.aspect, GLYPH_SIZE);

                    // Plan 2 §4.1 C1: View offset shifts projection to centre target in free rect
                    const freeRect = getFreeRect({ isRTL });
                    const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
                    const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
                    const offset = calcViewOffset(freeRect, W, H);
                    const pOffset = viewOffset.animateTo(offset.px, offset.py, 0.5);

                    // Plan 2 §4.2 C2: Fit glyph in free rect
                    const pShot = shots.glyph(target.position, { isRTL, width: dims.width, height: dims.height }, true);
                    currentTransition = Promise.all([pOffset, pShot]);
                    lamp.setPointerTarget(target.position);
                    lamp.setGlyphEmission(target.position, 6.5, true);

                    entryPanel.open(target.glyphData, store.get().glossary);
                    loop.invalidate(800);
                }
            } else if (!val?.id && state.view !== 'entry' && state.view !== 'about') {
                lamp.setGlyphEmission(null, 0, false);
                entryPanel.close(false);
                currentTransition = viewOffset.clear(0.5);
            } else if (!val?.id) {
                lamp.setGlyphEmission(null, 0, false);
            }
        }

        if (key === 'read') {
            glyphsManager.updateReadState(state.readEntries);
        }

        if (key === 'readingMode') {
            if (val) {
                // Plan 3 §3: Reading mode active: tween camera view offset to 0, pause render loop once covered
                viewOffset.clear(0.5).then(() => {
                    if (store.get().isReadingMode) {
                        loop.stop();
                    }
                });
            } else {
                // Reading mode collapsed: resume render loop and tween offset back to side panel
                loop.start();
                loop.invalidate(800);
                if (state.view === 'entry' && state.activeId) {
                    const target = glyphsManager.glyphs.find(g => g.glyphData && g.glyphData.id === state.activeId);
                    if (target) {
                        const isRTL = store.get().lang === 'ar';
                        const freeRect = getFreeRect({ isRTL, isExpanded: false });
                        const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
                        const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
                        const offset = calcViewOffset(freeRect, W, H);
                        viewOffset.animateTo(offset.px, offset.py, 0.5);
                    }
                }
            }
        }

        if (key === 'lang') {
            document.documentElement.lang = val;
            document.documentElement.dir = val === 'ar' ? 'rtl' : 'ltr';
            if (state.view === 'entry' && state.activeId) {
                const target = glyphsManager.glyphs.find(g => g.glyphData && g.glyphData.id === state.activeId);
                if (target) {
                    const isRTL = val === 'ar';
                    const dims = calcGlyphDimensions(target.glyphData.aspect, GLYPH_SIZE);
                    const freeRect = getFreeRect({ isRTL });
                    const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
                    const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
                    const offset = calcViewOffset(freeRect, W, H);
                    const pOffset = viewOffset.animateTo(offset.px, offset.py, 0.4);
                    const pShot = shots.glyph(target.position, { isRTL, width: dims.width, height: dims.height }, true);
                    currentTransition = Promise.all([pOffset, pShot]);
                    entryPanel.open(target.glyphData, store.get().glossary);
                    loop.invalidate(800);
                }
            } else if (state.view === 'about') {
                const isRTL = val === 'ar';
                const freeRect = getFreeRect({ isRTL });
                const W = (typeof window !== 'undefined' && window.innerWidth) || 1440;
                const H = (typeof window !== 'undefined' && window.innerHeight) || 900;
                const offset = calcViewOffset(freeRect, W, H);
                viewOffset.animateTo(offset.px, offset.py, 0.4);
                loop.invalidate(800);
            } else if (state.activeId) {
                const target = glyphsManager.glyphs.find(g => g.glyphData && g.glyphData.id === state.activeId);
                if (target) {
                    entryPanel.open(target.glyphData, store.get().glossary);
                }
            }
        }
    });

    // Initialize Router
    router.init();

    console.log('[App] Al-Khatib Glossar Phase 6 threshold & core initialized');

    const app = {
        store,
        router,
        stage,
        loop,
        camera,
        controls,
        shots,
        viewOffset,
        lamp,
        post,
        relief,
        postcard,
        glyphsManager,
        chrome,
        navControls,
        threshold,
        indexView,
        aboutView,
        cursor,
        THREE,
        getFreeRect,
        calcViewOffset,
        waitForRest: async () => {
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 6000));
            if (currentTransition) {
                try {
                    await Promise.race([currentTransition, timeoutPromise]);
                } catch {}
            }
            if (!controls._hasRested) {
                await new Promise(resolve => {
                    const onRest = () => {
                        controls.removeEventListener('rest', onRest);
                        resolve();
                    };
                    controls.addEventListener('rest', onRest);
                    setTimeout(resolve, 6000);
                });
            }
            if (loop) loop.invalidate(100);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    };

    if (typeof window !== 'undefined') {
        const isDebug = window.location.search.includes('debug=1') || window.location.search.includes('debug=register');
        if (isDebug) {
            window.__akg = app;
            window.THREE = THREE;
        }
    }

    return app;
}
