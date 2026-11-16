/**
 * Visibility and pointer interaction helper for overlay layers (Plan 3 §2 A2).
 * Ensures hidden layers leave the hit-test tree, cannot take focus ('inert'),
 * and transition smoothly without blanket pointer-events hacks.
 */

export function showLayer(el) {
    if (!el) return;

    if (el._hideTimeout) {
        clearTimeout(el._hideTimeout);
        el._hideTimeout = null;
    }
    if (el._onTransitionEnd) {
        el.removeEventListener('transitionend', el._onTransitionEnd);
        el._onTransitionEnd = null;
    }

    el.removeAttribute('hidden');
    el.removeAttribute('inert');
    void el.offsetWidth; // Force reflow so transition triggers cleanly
    el.classList.add('is-open');
    el.classList.remove('is-hidden');
}

export function hideLayer(el, { immediate = false } = {}) {
    if (!el) return;

    if (el._hideTimeout) {
        clearTimeout(el._hideTimeout);
        el._hideTimeout = null;
    }
    if (el._onTransitionEnd) {
        el.removeEventListener('transitionend', el._onTransitionEnd);
        el._onTransitionEnd = null;
    }

    el.classList.remove('is-open');
    el.setAttribute('inert', '');

    const finish = () => {
        if (el._hideTimeout) {
            clearTimeout(el._hideTimeout);
            el._hideTimeout = null;
        }
        if (el._onTransitionEnd) {
            el.removeEventListener('transitionend', el._onTransitionEnd);
            el._onTransitionEnd = null;
        }
        el.setAttribute('hidden', '');
        el.classList.add('is-hidden');
    };

    if (immediate || el.hasAttribute('hidden')) {
        finish();
        return;
    }

    el._onTransitionEnd = (e) => {
        if (e.target === el) {
            finish();
        }
    };
    el.addEventListener('transitionend', el._onTransitionEnd);
    el._hideTimeout = setTimeout(finish, 600);
}

export function isLayerOpen(el) {
    if (!el) return false;
    return el.classList.contains('is-open') && !el.hasAttribute('hidden');
}
