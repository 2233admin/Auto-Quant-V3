# Third-party notices

## Factor tear-sheet formula references

`autoquant/factor_tearsheet.py`, its numerical parity tests, and the Studio
metric catalogue use independently written implementations of the methods in
[JoinQuant/jqfactor_analyzer](https://github.com/JoinQuant/jqfactor_analyzer)
(`performance.py`, MIT) and [Alphalens / alphalens-reloaded](https://github.com/stefan-jansen/alphalens-reloaded)
(`performance.py`, Apache-2.0; original Alphalens Copyright 2017 Quantopian, Inc.).
No implementation source was copied or vendored and neither analyzer is a runtime
dependency. Group means, entrants/current-name turnover, rank autocorrelation
and per-horizon Spearman IC follow those reference formulas. Core deliberately
retains its ordinal bins, split purging, unannualized units, raw forward outcomes,
HAC inference and descriptive multi-bar compounding. Exact differences and
cost assumptions are documented in `docs/design/full-factor-tear-sheet.md`.

## animate-ui

Studio's motion kit (`studio-app/src/components/motion/`) is adapted from the behaviour of
[animate-ui](https://github.com/imskyleen/animate-ui) (sliding highlight and tabs, auto-height and collapsible, counting
number, progress, copy button, theme toggler). The source was read for how the components behave; the code in this
repository is hand-written for Studio (plain CSS on Studio's design tokens, small React hooks, the Web Animations API and
ResizeObserver). No animate-ui file is copied verbatim, no Tailwind, Radix or Motion dependency is added, and the
components are not redistributed in their original form. Every adapted file carries a header comment naming what was kept
and what was changed.

Licence: MIT + Commons Clause. Permission notice, as published in the project's `LICENSE.md`:

```
MIT + Commons Clause License Condition

Copyright (c) 2025 Elliot Sutton

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell or redistribute the components themselves in their original form—whether alone or in a bundle.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Files adapted: `reducedMotion.ts`, `useSlidingHighlight.ts`, `Collapse.tsx`, `AnimatedDetails.tsx`, `AnimatedValue.tsx`,
`Progress.tsx`, `CopyIcon.tsx`, `themeTransition.ts`, `motion.css`.

## Studio fonts (direction H, 2026-11-04)

All faces are licensed under the SIL Open Font License 1.1. Licence texts for the vendored files sit in
`studio-app/src/design/fonts/`; the Noto Sans SC licence ships in its npm package.

- **Smiley Sans 得意黑** (Chinese headings), Copyright (c) 2022-2024 atelierAnchor,
  [atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans), `SmileySans-Oblique.ttf.woff2`
  vendored unmodified (1.15 MB, no subsetting needed).
- **0xProto** (every Latin letter and number: labels, values, ids, code), Copyright (c) 0xType Project Authors,
  [0xType/0xProto](https://github.com/0xType/0xProto) release 2.502; `0xProto-Regular.woff2` and `0xProto-Bold.woff2`
  vendored unmodified.
- **Noto Sans SC** (body), Copyright (c) Google / Adobe, via the `@fontsource-variable/noto-sans-sc` npm package.
