## Content fundamentals

- Voice: plain, literal, researcher to researcher. State what the evidence shows and how strong it is; never praise, never market. Address the user as "you" only in instructions (for example "Run the study to see a verdict"); results speak about the factor, not about the user.
- Casing: sentence case everywhere (buttons, tabs, headings). Verdict words are capitalised as fixed terms: Supported, Inconclusive, Could not be tested, Not tested. There is no Refuted state: a verdict comes only from Core, and the UI never invents one.
- One wording per state. Use the catalogue in DESIGN.md "Copy and state catalogue" verbatim; do not paraphrase a state on a second page.
- Numbers: set in `value` (mono, tabular, right-aligned in tables and grids). Keep the sign, keep the precision Core returns (never round for looks), unit after the number with a thin space. Long ids and expressions truncate with an ellipsis in a row and wrap in a detail view; the full text is always reachable by copy.
- Punctuation: no exclamation marks, no emoji. A disabled control always carries a visible reason sentence.
- Real copy from the product: "Supported", "Inconclusive", "Could not be tested", "No evidence in this Project", "End of list".

## Visual foundations

- Colour: tokens only. Ground `bg`, surfaces `raised`, text `text` / `muted` / `faint`. The only chromatic colour is signal orange (`signal` for text, `signal-graphic` for marks) and it appears only on state: failure, Could not be tested, a changed-count badge. Never colour a value for being up or down. The primary action is the inverted fill (`text` on `bg`), also used for the selected state; it is not orange.
- Type (decided 2026-11-04, direction B one step smaller): Inter Variable with a CJK sans fallback for all prose and UI; IBM Plex Mono only for numbers, ids, hashes, code and commands, always tabular. `page-title` 18/26 600, `section` 14/20 600, `body` 13/20 400, `small` 12/18 400, `label` 11/16 400 muted (column headers, metadata keys, chip text), `value` 13/20 500 mono, `value-focal` 22/28 600 mono for the headline numbers of an answer strip; a library row's focal metric is `value` at 600. Weights 400/500/600 only; nothing below 11px.
- Spacing: only 4 / 8 / 12 / 16 / 24 / 32 (`space-1`, `-2`, `-3`, `-4`, `-6`, `-8`). 4 inside a cell or label to value, 8 between items of a group, 12 between rows of a group and pane padding, 24 between sections, 32 page top and bottom.
- Layout: desktop 1280 to 1920 only, no mobile. Shell maximum `page-max-width`. Two-pane workbench is 40fr / 60fr (editor left, result right).
- Lines, borders and radii: lines instead of boxes. A `line` hairline between rows, one `line-strong` rule under a section heading, toolbar or answer strip. No border around a group that already sits in a pane, no box in a box; one outer border only on a surface that must separate from the ground (pane, popover, dialog). The rail is flat with a right hairline. Radius `radius-control` 6px for controls and pane edges; `radius-float` 8px for menus, popovers and dialogs. The large rounded floating-card look is rejected by the owner.
- Depth: none. Elevation is a fill step (`bg` to `raised` to `selected`), never a shadow, blur or gradient.
- States: hover is the `hover` wash; focus is a 2px `text` outline (never removed); disabled is `faint` text plus a dashed border plus a visible reason; selected is `selected` fill and weight 600.
- Motion: see MOTION.md. Short eases, no decoration, all off under prefers-reduced-motion.
- Responsive: designed for 1280 to 1920; below 1000px the two panes stack and the page scrolls.

## Iconography

Built-in line icons only (the product's existing glyph set), 16px, stroke follows `muted` or `text`. No brand logo and no logo asset: the product has none. Verdict glyphs are paired with a word and never carry meaning alone. No emoji, no icon taken from a reference product.
