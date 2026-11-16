import { t } from '../i18n.js';

/**
 * Audio Player with Waveform Visualization
 * PLAN-3-entry-content.md §4 C5
 *
 * Features:
 * - Decodes audio waveform peaks (~160 bars) and caches in sessionStorage
 * - Canvas waveform scrubber: played portion in --trace, unplayed in --ink-3
 * - Audio-only mode: 56px round play button, large 48px waveform
 * - Audio+text mode: 40px round play button, sticky under header while playing
 * - Focus-scoped seeking: Space toggles, Left/Right seek 5s ONLY when player has focus
 * - Fallback to 1px line if audio decoding fails or file > 25MB
 */

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Decodes audio waveform peaks via Web Audio API, caching in sessionStorage.
 */
async function getWaveformPeaks(audioSrc, peakCount = 160) {
    if (!audioSrc || typeof window === 'undefined' || !window.AudioContext && !window.webkitAudioContext) {
        return null;
    }

    const cacheKey = `akg_peaks_${audioSrc}`;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {}

    try {
        const resp = await fetch(audioSrc);
        const len = resp.headers.get('content-length');
        if (len && parseInt(len, 10) > 25 * 1024 * 1024) {
            return null; // Skip if > 25 MB
        }
        const buffer = await resp.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(buffer);
        const channel = audioBuffer.getChannelData(0);
        const step = Math.floor(channel.length / peakCount);
        const peaks = [];

        for (let i = 0; i < peakCount; i++) {
            let max = 0;
            const start = i * step;
            for (let j = 0; j < step; j++) {
                const val = Math.abs(channel[start + j]);
                if (val > max) max = val;
            }
            // Normalize peak to [0.08, 1.0] for aesthetics
            peaks.push(Math.max(0.08, Math.min(1.0, Math.round(max * 100) / 100)));
        }
        ctx.close();

        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(peaks));
        } catch {}

        return peaks;
    } catch (err) {
        console.warn('[Player] Waveform decoding failed, using fallback:', err);
        return null;
    }
}

export function createAudioPlayer(audioSrc, container, options = {}) {
    if (!audioSrc || !container) return null;

    const { isAudioOnly = false, lang = 'de' } = options;

    const wrapper = document.createElement('div');
    wrapper.className = `akg-audio-player ${isAudioOnly ? 'is-audio-only' : 'is-compact'}`;
    wrapper.innerHTML = `
        <div class="akg-player-controls">
            <button type="button" class="akg-player-toggle" aria-label="${t(lang, 'play')}">
                <span class="play-icon" aria-hidden="true">▶</span>
                <span class="pause-icon" aria-hidden="true" style="display: none;">❚❚</span>
            </button>
            <div class="akg-player-time">
                <span class="time-current">00:00</span>
                <span class="time-divider">/</span>
                <span class="time-total">00:00</span>
            </div>
        </div>
        <div class="akg-player-track" role="slider" aria-label="Audio scrubber" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <canvas class="waveform-canvas"></canvas>
            <div class="track-fallback-line" style="display: none;">
                <div class="track-progress"></div>
            </div>
        </div>
    `;

    container.appendChild(wrapper);

    const audio = new Audio(audioSrc);
    audio.preload = 'metadata';

    const toggleBtn = wrapper.querySelector('.akg-player-toggle');
    const playIcon = wrapper.querySelector('.play-icon');
    const pauseIcon = wrapper.querySelector('.pause-icon');
    const currentSpan = wrapper.querySelector('.time-current');
    const totalSpan = wrapper.querySelector('.time-total');
    const track = wrapper.querySelector('.akg-player-track');
    const canvas = wrapper.querySelector('.waveform-canvas');
    const fallbackLine = wrapper.querySelector('.track-fallback-line');
    const fallbackProgress = wrapper.querySelector('.track-progress');

    let isPlaying = false;
    let isSeeking = false;
    let peaks = null;

    // Draw waveform canvas
    const drawWaveform = (pct = 0) => {
        if (!canvas) return;
        const width = track.clientWidth || 300;
        const height = isAudioOnly ? 48 : 28;
        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        if (!peaks || peaks.length === 0) {
            // Fallback plain line
            fallbackLine.style.display = 'block';
            fallbackProgress.style.width = `${pct}%`;
            canvas.style.display = 'none';
            return;
        }

        fallbackLine.style.display = 'none';
        canvas.style.display = 'block';

        const barCount = peaks.length;
        const barSpacing = width / barCount;
        const barWidth = Math.max(1, barSpacing - 1);
        const progressX = (pct / 100) * width;

        for (let i = 0; i < barCount; i++) {
            const x = i * barSpacing;
            const barHeight = Math.max(2, peaks[i] * (height - 4));
            const y = (height - barHeight) / 2;

            if (x < progressX) {
                ctx.fillStyle = '#e26041'; // var(--trace)
            } else {
                ctx.fillStyle = '#23262f'; // var(--ink-3)
            }
            ctx.fillRect(x, y, barWidth, barHeight);
        }
    };

    // Load peaks asynchronously
    getWaveformPeaks(audioSrc, isAudioOnly ? 180 : 140).then(p => {
        peaks = p;
        drawWaveform(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    });

    const updatePlayState = (playing) => {
        isPlaying = playing;
        playIcon.style.display = isPlaying ? 'none' : 'inline';
        pauseIcon.style.display = isPlaying ? 'inline' : 'none';
        toggleBtn.setAttribute('aria-label', t(lang, isPlaying ? 'pause' : 'play'));
        toggleBtn.classList.toggle('is-playing', isPlaying);

        // In compact mode: sticky while playing (Plan 3 §4 C5)
        if (!isAudioOnly) {
            wrapper.classList.toggle('is-sticky-playing', isPlaying);
        }
    };

    const togglePlay = () => {
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(err => {
                console.warn('[Player] Play prevented:', err);
            });
        }
    };

    toggleBtn.addEventListener('click', togglePlay);

    // Audio lifecycle events
    audio.addEventListener('play', () => updatePlayState(true));
    audio.addEventListener('pause', () => updatePlayState(false));
    audio.addEventListener('ended', () => {
        updatePlayState(false);
        audio.currentTime = 0;
        currentSpan.textContent = '00:00';
        track.setAttribute('aria-valuenow', '0');
        drawWaveform(0);
    });

    audio.addEventListener('loadedmetadata', () => {
        totalSpan.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        if (isSeeking) return;
        currentSpan.textContent = formatTime(audio.currentTime);
        const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        track.setAttribute('aria-valuenow', Math.round(pct).toString());
        drawWaveform(pct);
    });

    // Scrubber click & drag interaction
    const seekToPoint = (e) => {
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        if (audio.duration) {
            audio.currentTime = norm * audio.duration;
            currentSpan.textContent = formatTime(audio.currentTime);
            track.setAttribute('aria-valuenow', Math.round(norm * 100).toString());
            drawWaveform(norm * 100);
        }
    };

    const onSeekStart = (e) => {
        isSeeking = true;
        seekToPoint(e);
        const onSeekMove = (moveEv) => seekToPoint(moveEv);
        const onSeekEnd = () => {
            isSeeking = false;
            window.removeEventListener('pointermove', onSeekMove);
            window.removeEventListener('pointerup', onSeekEnd);
        };
        window.addEventListener('pointermove', onSeekMove);
        window.addEventListener('pointerup', onSeekEnd);
    };

    track.addEventListener('pointerdown', onSeekStart);

    // Keyboard controls: Left/Right seek 5s ONLY when player has focus (Plan 3 §4 C5)
    const onKeyDown = (e) => {
        const hasFocus = wrapper.contains(document.activeElement);
        if (!hasFocus) return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (audio.duration) {
                audio.currentTime = Math.max(0, audio.currentTime - 5);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (audio.duration) {
                audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            }
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // Resize observer to redraw waveform when panel width transitions
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
            drawWaveform(pct);
        });
        resizeObserver.observe(track);
    }

    return {
        audio,
        togglePlay,
        play: () => audio.play(),
        pause: () => audio.pause(),
        isPlaying: () => isPlaying,
        cleanup: () => {
            window.removeEventListener('keydown', onKeyDown);
            if (resizeObserver) resizeObserver.disconnect();
            audio.pause();
            audio.src = '';
            wrapper.remove();
        }
    };
}
