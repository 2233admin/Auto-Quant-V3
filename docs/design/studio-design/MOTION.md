---
schema: design-pipeline.motion-foundation.v0.1
name: AutoQuant Studio motion language
posture: minimal
primitiveRegistry: design-pipeline.motion-primitives.v1
---

## Motion Thesis

Motion in AutoQuant Studio confirms what just happened and never decorates. A researcher is judging evidence; nothing may move to attract attention, delay a result or imply a verdict. Motion is short, eased out, and always optional: every effect is off under prefers-reduced-motion and the product is complete without it. The reference product is read from stills only, so it contributes a static posture and no motion parameters.

## Motion Principles

- Confirm, never decorate: an effect exists only to show a state change (selected, opened, copied, progress, theme).
- Never delay: the state changes at once and the animation follows; no control waits for an animation to finish.
- One ease for everything: ease-out with a gentle settle, cubic-bezier 0.22, 1, 0.36, 1.
- One default duration, 0.26 s; faster (0.14 to 0.18 s) for hover washes and icon swaps, slower (0.6 s) only for progress fill.
- Numbers may count for about 0.5 s when a value changes, never on first paint, and the final value is always exact.
- Colour and state never animate to imply a verdict: a verdict word and its rule change without easing flourish.
- Interruptible: a new state replaces a running animation from its current position.

## Motion Vocabulary

Selected from the registry:
- primitive: reveal.trim-line. Used for the progress bar fill and, where a chart line is drawn on first load, a linear reveal of the line. Runtime: CSS transform scale on the bar is a documented approximation (degraded); the chart reveal is optional.

Authored product vocabulary (not in the registry; these are measured from the existing motion kit in studio-app/src/components/motion and are authored, not borrowed):
- Sliding highlight: the hover wash and the selected underline slide between tabs or rows, 0.26 s ease, wash opacity 0.14 s linear.
- Collapse: a section opens by animating grid rows from 0 to 1fr, 0.26 s; hidden content is removed from the accessibility tree while closed.
- Counting number: a headline value counts from the old to the new value for about 0.5 s.
- Progress ease: determinate fill eases 0.6 s; indeterminate uses a 1.8 s shimmer.
- Copy confirm: the copy icon swaps to a check, opacity 0.18 s and transform 0.22 s.
- Theme fade: colours cross-fade 0.3 s when the theme changes.
- Pop: an info popover appears with a 0.16 s small rise.

## Procedural Motion

None. No generator, seed, noise, path equation or particle field is used. The only repeating motion is the indeterminate progress shimmer, a fixed 1.8 s loop with no parameters to author. Canvas, WebGL and SVG filters are not used for motion.

## Runtime Policy

CSS transitions and keyframes only, with a small requestAnimationFrame loop for the counting number. No Anime.js, GSAP or PixiJS. Each effect preserves interruption and accessibility semantics: collapsed content is hidden from assistive technology, the copy confirm updates an accessible label, progress exposes its value. Any adapter that cannot do this is unsupported for Studio. Performance budget: transform and opacity only where possible; no layout-thrashing animation of width except the progress fill.

## Reduced Motion

Under prefers-reduced-motion the substitute for every effect is the final state shown at once: the highlight jumps, collapse opens and closes instantly, numbers show the new value without counting, the copy icon swaps without fade, the theme changes without cross-fade, and the pop appears without rise. The indeterminate progress shimmer falls back to a static muted bar. Progress fill is the one fallback that still updates its width, without easing.

## Source Decisions

Adopted: the existing Studio motion kit as authored vocabulary, its single ease and 0.26 s default duration, the reduced-motion behaviour, and the registry primitive reveal.trim-line for progress. The reference study contributes a static posture because its motion is not observable from stills.
Rejected: any motion from the reference product, decorative or ambient motion, procedural motion, and heavy runtimes. Licence decision (owner, option 2): all animate-ui-derived motion is rewritten by us before open sourcing. The motion kit files in studio-app/src/components/motion were adapted from animate-ui, whose licence is recorded in the files as MIT plus Commons Clause. The open-source release will contain no animate-ui code and no animate-ui structure (file layout, component API shapes, naming); the current kit counts as interim and is not to be published. The rewrite is built from the vocabulary in this file (own CSS transitions and keyframes, one ease, one default duration) and must not be derived by reading the animate-ui source. No code is copied into this document.

## Motion visibility

The owner currently sees no animation. Most likely cause: the operating system has animation effects turned off. On Windows, Animation effects off maps to prefers-reduced-motion: reduce, which the kit honours (see Reduced Motion), so every effect shows its final state at once. This is an assumption to verify, not a confirmed diagnosis; a kit bug is not ruled out.

How to check:
- Windows: Settings > Accessibility > Visual effects > Animation effects. If Off, turn it On and reload the page.
- Browser devtools: Rendering panel > Emulate CSS media feature prefers-reduced-motion; set no-preference (or reduce, to test the fallback) and reload. `matchMedia('(prefers-reduced-motion: reduce)').matches === true` means the page is in the reduced state.

The design must still read correctly with all motion off: every state change is visible as a final state (selected fill, open section, new number, verdict word and rule), nothing depends on seeing an animation, and no information is carried by motion alone.
