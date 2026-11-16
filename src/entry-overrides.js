/**
 * Explicit per-entry overrides for layout and kind classification.
 * Governed by PLAN-3-entry-content.md §8.
 */

export const ENTRY_OVERRIDES = {
    217: { verse: true },
    149: { verse: true },
    152: { verse: true },
    172: { verse: false },
    224: { verse: false, subhead: true },
    175: { verse: false },
    120: { verse: false },
    241: { transcript: true },
    115: { kind: 'audio-only' },
    251: { kind: 'video-only' },
    247: { kind: 'image-only' }
};
