import * as THREE from 'three';

/**
 * Navigation Controls Cluster (Plan 2 §3.3 B3):
 * Compass widget, Zoom In/Out, Rotate Left/Right, Tilt cycle, Move/Turn mode toggle, and Reset.
 */
export function createNavControls({ container, controls, shots, store }) {
    const root = document.createElement('div');
    root.id = 'akg-nav-cluster';
    root.className = 'akg-nav-cluster';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Map Navigation Controls');

    root.innerHTML = `
        <div class="nav-cluster-inner">
            <button class="akg-chip nav-compass-btn" id="nav-compass" aria-label="Reset orientation to North" title="Reset orientation (North)">
                <div class="compass-ring">
                    <div class="compass-needle" id="compass-needle"></div>
                </div>
            </button>
            <div class="nav-chip-col">
                <button class="akg-chip nav-chip" id="nav-zoom-in" aria-label="Zoom in" title="Zoom in (+)">+</button>
                <button class="akg-chip nav-chip" id="nav-zoom-out" aria-label="Zoom out" title="Zoom out (−)">−</button>
                <button class="akg-chip nav-chip" id="nav-turn-left" aria-label="Turn left 30 degrees" title="Turn left 30° (Q)">⟲</button>
                <button class="akg-chip nav-chip" id="nav-turn-right" aria-label="Turn right 30 degrees" title="Turn right 30° (E)">⟳</button>
                <button class="akg-chip nav-chip" id="nav-tilt" aria-label="Cycle tilt angle" title="Cycle tilt (0° / 32° / 60°)">Tilt</button>
                <button class="akg-chip nav-chip mode-toggle-chip" id="nav-mode-toggle" aria-label="Toggle drag mode between Move and Turn" title="Swap drag mode (Space)">
                    <span id="nav-mode-label">Move</span>
                </button>
                <button class="akg-chip nav-chip" id="nav-reset" aria-label="Reset view" title="Reset overview (R)">Reset [R]</button>
            </div>
        </div>
    `;

    container.appendChild(root);

    const needle = root.querySelector('#compass-needle');
    const modeLabel = root.querySelector('#nav-mode-label');
    const modeBtn = root.querySelector('#nav-mode-toggle');

    let currentMode = 'move';
    const tiltAngles = [
        THREE.MathUtils.degToRad(0),
        THREE.MathUtils.degToRad(32),
        THREE.MathUtils.degToRad(60)
    ];
    let tiltIndex = 1;

    const updateCompass = () => {
        if (!needle || !controls) return;
        const deg = THREE.MathUtils.radToDeg(controls.azimuthAngle);
        needle.style.transform = `rotate(${-deg}deg)`;
    };

    const setMode = (mode) => {
        currentMode = mode;
        if (modeLabel) modeLabel.textContent = mode === 'turn' ? 'Turn' : 'Move';
        if (modeBtn) modeBtn.classList.toggle('is-active', mode === 'turn');
        const CC = controls.constructor;
        if (mode === 'turn') {
            controls.mouseButtons.left = CC.ACTION.ROTATE;
        } else {
            controls.mouseButtons.left = CC.ACTION.TRUCK;
        }
    };

    // Click handlers
    root.querySelector('#nav-compass')?.addEventListener('click', () => {
        controls.rotateTo(0, controls.polarAngle, true);
    });

    root.querySelector('#nav-zoom-in')?.addEventListener('click', () => {
        controls.dolly(1.5, true);
    });

    root.querySelector('#nav-zoom-out')?.addEventListener('click', () => {
        controls.dolly(-1.5, true);
    });

    root.querySelector('#nav-turn-left')?.addEventListener('click', () => {
        controls.rotate(-THREE.MathUtils.degToRad(30), 0, true);
    });

    root.querySelector('#nav-turn-right')?.addEventListener('click', () => {
        controls.rotate(THREE.MathUtils.degToRad(30), 0, true);
    });

    root.querySelector('#nav-tilt')?.addEventListener('click', () => {
        tiltIndex = (tiltIndex + 1) % tiltAngles.length;
        controls.rotateTo(controls.azimuthAngle, tiltAngles[tiltIndex], true);
    });

    modeBtn?.addEventListener('click', () => {
        setMode(currentMode === 'move' ? 'turn' : 'move');
    });

    root.querySelector('#nav-reset')?.addEventListener('click', () => {
        shots.overview(true);
    });

    // Update compass needle on camera change
    controls.addEventListener('update', updateCompass);
    updateCompass();

    // Visibility subscription
    store.subscribe((state, key) => {
        if (key === 'view') {
            const isVisible = state.view === 'map';
            root.style.display = isVisible ? 'block' : 'none';
        }
    });

    return {
        root,
        setMode,
        getMode: () => currentMode,
        updateCompass,
        cleanup: () => {
            controls.removeEventListener('update', updateCompass);
            if (root.parentElement) root.parentElement.removeChild(root);
        }
    };
}
