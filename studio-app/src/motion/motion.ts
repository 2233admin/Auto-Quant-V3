/* Studio's own motion layer (direction H). Hand-written CSS keyframes plus this small module; nothing here is taken
   from the animate-ui based kit in components/motion.

   The Motion setting (动效 / Motion) is a viewer preference stored like the language setting:
     on      play every effect, even when the OS asks for reduced motion (the owner's Windows has animation effects
             off, MinAnimate=0, so prefers-reduced-motion is "reduce" there and Studio used to never move)
     system  follow prefers-reduced-motion
     off     show every final state at once
   It is mirrored to <html data-motion="on|system|off"> and resolved to <html data-fx="1|0"> (1 = play). CSS keys
   off data-fx; script asks motionPlays(). */

export type MotionSetting = 'on' | 'system' | 'off'
export const MOTION_KEY = 'aq-motion'

const listeners = new Set<() => void>()
let current: MotionSetting = 'on'

export function storedMotion(): MotionSetting {
  try {
    const v = localStorage.getItem(MOTION_KEY)
    return v === 'system' || v === 'off' ? v : 'on'
  } catch {
    return 'on'
  }
}

const reduceQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)

function resolve(setting: MotionSetting): boolean {
  return setting === 'on' ? true : setting === 'off' ? false : !(reduceQuery()?.matches ?? false)
}

function write(setting: MotionSetting) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.motion = setting
  root.dataset.fx = resolve(setting) ? '1' : '0'
  listeners.forEach((l) => l())
}

/** Applies the setting to <html>, remembers it, and keeps `system` in step with the OS preference. */
export function applyMotion(setting: MotionSetting, remember = true): void {
  current = setting
  if (remember) {
    try { localStorage.setItem(MOTION_KEY, setting) } catch { /* In-memory choice remains active. */ }
  }
  write(setting)
}

export function getMotion(): MotionSetting {
  return current
}

if (typeof window !== 'undefined') {
  reduceQuery()?.addEventListener?.('change', () => { if (current === 'system') write('system') })
}

/** True when effects should play right now. */
export function motionPlays(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.fx === '1'
}

/** Subscribe for React: fires when the setting or the OS preference changes. */
export function subscribeMotion(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
