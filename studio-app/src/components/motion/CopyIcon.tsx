/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/buttons/copy, the copy icon swaps to a check mark for a moment after a successful copy;
 * changed it to two inline SVGs cross-faded by a CSS transition (no Motion icon-swap), with the strokes in currentColor.
 */
import './motion.css'

/** Copy glyph that turns into a check mark while `copied` is true. Decorative: the button's text and status line carry the meaning. */
export function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <span className="mo-copy-icon" data-copied={copied ? '' : undefined} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mo-copy-icon-copy">
        <rect x="5.5" y="5.5" width="8" height="8" />
        <path d="M10.5 3.5v-1h-8v8h1" />
      </svg>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="mo-copy-icon-check">
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    </span>
  )
}
