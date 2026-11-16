/**
 * Render loop with dirty-flag (render on demand) and animation scheduling.
 * Pauses automatically when tab is hidden.
 */
export function createLoop({ renderer, scene, camera, onUpdate, post: initialPost = null }) {
    let animId = null;
    let isRunning = false;
    let dirtyUntil = performance.now() + 2000; // render on boot for at least 2s
    let lastTime = performance.now();
    let post = initialPost;

    const setPost = (p) => {
        post = p;
    };

    const invalidate = (durationMs = 0) => {
        const until = performance.now() + durationMs;
        if (until > dirtyUntil) {
            dirtyUntil = until;
        }
        if (!isRunning && !document.hidden) {
            start();
        }
    };

    const tick = (now) => {
        const delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        if (onUpdate) {
            const hasActivity = onUpdate(delta, now);
            if (hasActivity) {
                dirtyUntil = Math.max(dirtyUntil, now + 120);
            }
        }

        const needsRender = now <= dirtyUntil;

        if (needsRender || (onUpdate && onUpdate.hasActiveTweens)) {
            if (post && post.enabled) {
                post.render(delta);
            } else {
                renderer.render(scene, camera);
            }
        }

        if (now <= dirtyUntil) {
            animId = requestAnimationFrame(tick);
            isRunning = true;
        } else {
            isRunning = false;
            animId = null;
        }
    };

    const start = () => {
        if (!isRunning && !document.hidden) {
            lastTime = performance.now();
            isRunning = true;
            animId = requestAnimationFrame(tick);
        }
    };

    const stop = () => {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        isRunning = false;
    };

    const onVisibilityChange = () => {
        if (document.hidden) {
            stop();
        } else {
            invalidate(1000);
            start();
        }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    start();

    return {
        start,
        stop,
        invalidate,
        setPost,
        cleanup: () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        }
    };
}
