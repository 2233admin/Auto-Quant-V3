/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the idea of one shared "should we animate" check that every effect consults; changed it from a Motion/React
 * context to a plain matchMedia read, so no animation library is needed.
 */

/** True when the user asks the system for less motion. Read at call time so a changed setting applies at once. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
