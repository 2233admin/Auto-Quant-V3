/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the idea of one shared "should we animate" check that every effect consults; changed it from a Motion/React
 * context to a plain read of the viewer's Motion setting (motion/motion.ts), so no animation library is needed.
 */
import { motionPlays } from '../../motion/motion'

/** True when effects must not play: the Motion setting is off, or it follows the system and the system asks for less. */
export function prefersReducedMotion(): boolean {
  return !motionPlays()
}
