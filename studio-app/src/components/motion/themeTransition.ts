/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the intent of primitives/effects/theme-toggler, switching theme should feel like one smooth change rather than a hard
 * cut; changed it from a View Transition clip-path wipe to a short colour cross-fade (class on <html>, CSS in motion.css), and it
 * is armed only by a user's toggle, so first load and stored-theme restore never animate.
 */
import { prefersReducedMotion } from './reducedMotion'
import './motion.css'

const CLASS = 'mo-theme-anim'
const DURATION = 320
let timer = 0

/** Call just before applying a theme the user chose. The class lives for the length of the fade and then goes away. */
export function startThemeTransition(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  const root = document.documentElement
  root.classList.add(CLASS)
  window.clearTimeout(timer)
  timer = window.setTimeout(() => root.classList.remove(CLASS), DURATION + 60)
}
