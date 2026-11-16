/**
 * Custom inspection lamp cursor:
 * 6px paper dot + 28px ring following the pointer with lerp.
 * Contracts and turns red over glyph traces.
 */

export function createCursor(container = document.body) {
    const el = document.createElement('div');
    el.id = 'custom-cursor';
    el.innerHTML = `
        <div class="cursor-dot"></div>
        <div class="cursor-ring"></div>
    `;
    container.appendChild(el);

    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;
    let animId = null;

    const tick = () => {
        const dx = targetX - currentX;
        const dy = targetY - currentY;

        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
            currentX += dx * 0.25;
            currentY += dy * 0.25;
            el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            animId = requestAnimationFrame(tick);
        } else {
            currentX = targetX;
            currentY = targetY;
            el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            animId = null;
        }
    };

    const onPointerMove = (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        if (!animId) {
            animId = requestAnimationFrame(tick);
        }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return {
        setHovering: (isHovering) => {
            el.classList.toggle('is-hovering', isHovering);
        },
        setDragging: (isDragging) => {
            el.classList.toggle('is-grabbing', isDragging);
        },
        setRotating: (isRotating) => {
            el.classList.toggle('is-rotating', isRotating);
        },
        cleanup: () => {
            window.removeEventListener('pointermove', onPointerMove);
            if (animId) cancelAnimationFrame(animId);
            if (el.parentElement) el.parentElement.removeChild(el);
        }
    };
}
