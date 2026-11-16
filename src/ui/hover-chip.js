/**
 * Floating hover label chip following cursor over glyphs.
 * Displays title, category type, and available language flags.
 * PLAN.md §3.4
 */

export function createHoverChip(container = document.getElementById('ui-root')) {
    if (!container) return null;

    let el = document.getElementById('glyph-hover-chip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'glyph-hover-chip';
        el.innerHTML = `
            <span class="chip-title"></span>
            <span class="chip-type"></span>
            <span class="chip-langs"></span>
        `;
        container.appendChild(el);
    }

    const titleEl = el.querySelector('.chip-title');
    const typeEl = el.querySelector('.chip-type');
    const langsEl = el.querySelector('.chip-langs');

    let isVisible = false;

    const show = (glyphData, pointerPos) => {
        if (!glyphData) return;

        // Decode HTML entities if any in title
        const tmp = document.createElement('div');
        tmp.innerHTML = glyphData.title || '';
        titleEl.textContent = tmp.textContent || tmp.innerText || '';

        typeEl.textContent = glyphData.type ? glyphData.type.toUpperCase() : '';

        const langs = [];
        if (glyphData.langs?.de) langs.push('DE');
        if (glyphData.langs?.en) langs.push('EN');
        if (glyphData.langs?.ar) langs.push('AR');
        langsEl.textContent = langs.join(' · ');

        if (pointerPos) {
            updatePos(pointerPos.x, pointerPos.y);
        }

        if (!isVisible) {
            el.classList.add('is-visible');
            isVisible = true;
        }
    };

    const hide = () => {
        if (isVisible) {
            el.classList.remove('is-visible');
            isVisible = false;
        }
    };

    const updatePos = (clientX, clientY) => {
        if (!isVisible && !el.classList.contains('is-visible')) return;

        const w = el.offsetWidth || 180;
        const h = el.offsetHeight || 28;
        let x = clientX + 16;
        let y = clientY + 16;

        if (x + w > window.innerWidth - 16) {
            x = clientX - w - 16;
        }
        if (y + h > window.innerHeight - 16) {
            y = clientY - h - 16;
        }

        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    return {
        el,
        show,
        hide,
        updatePos,
        cleanup: () => {
            el.remove();
        }
    };
}
