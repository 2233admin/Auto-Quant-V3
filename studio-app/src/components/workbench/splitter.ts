/**
 * Pure layout rules of the workbench splitter, kept apart from the component so the keyboard behaviour is testable
 * without a DOM. The split is the left pane's share, in percent of the track width (shell width minus the handle).
 */
export const SPLIT = { minLeft: 320, minRight: 480, handle: 17, step: 2, bigStep: 10, reset: 40 } as const

/** Allowed percent range for a shell of `width` px; when the shell is too narrow for both minimums the range collapses to the left minimum. */
export function splitBounds(width: number): { min: number; max: number } {
  const track = Math.max(1, width - SPLIT.handle)
  const min = (SPLIT.minLeft / track) * 100
  const max = 100 - (SPLIT.minRight / track) * 100
  return max < min ? { min, max: min } : { min, max }
}

export function clampSplit(percent: number, width: number): number {
  const { min, max } = splitBounds(width)
  return Math.min(max, Math.max(min, Number.isFinite(percent) ? percent : SPLIT.reset))
}

/** Left-pane percent after a pointer at `clientX` (relative to the shell's content box) drags the handle. */
export function splitFromPointer(offsetX: number, width: number): number {
  const track = Math.max(1, width - SPLIT.handle)
  return clampSplit(((offsetX - SPLIT.handle / 2) / track) * 100, width)
}

/**
 * Next percent for a key on the focused separator, or null when the key is not a splitter key. Arrows move by 2 points
 * (10 with Shift), Home snaps to the left minimum, End to the right minimum, Enter resets to 40/60.
 */
export function splitKey(percent: number, key: string, width: number, shift = false): number | null {
  const step = shift ? SPLIT.bigStep : SPLIT.step
  const { min, max } = splitBounds(width)
  switch (key) {
    case 'ArrowLeft': case 'ArrowUp': return clampSplit(percent - step, width)
    case 'ArrowRight': case 'ArrowDown': return clampSplit(percent + step, width)
    case 'Home': return min
    case 'End': return max
    case 'Enter': return clampSplit(SPLIT.reset, width)
    default: return null
  }
}

export const splitStorageKey = (id: string) => `aq-studio-split:${id}`

export function readSplit(id: string, fallback: number): number {
  try {
    const raw = Number(localStorage.getItem(splitStorageKey(id)))
    return Number.isFinite(raw) && raw > 0 && raw < 100 ? raw : fallback
  } catch { return fallback }
}

export function writeSplit(id: string, percent: number): void {
  try { localStorage.setItem(splitStorageKey(id), String(Math.round(percent * 10) / 10)) } catch { /* In-memory choice remains active. */ }
}

/** grid-template-columns for `[left] [handle] [right]`; the clamp keeps both minimum widths whatever the stored percent. */
export function splitColumns(percent: number): string {
  return `clamp(${SPLIT.minLeft}px, calc((100% - ${SPLIT.handle}px) * ${(percent / 100).toFixed(4)}), calc(100% - ${SPLIT.handle}px - ${SPLIT.minRight}px)) ${SPLIT.handle}px minmax(0, 1fr)`
}
