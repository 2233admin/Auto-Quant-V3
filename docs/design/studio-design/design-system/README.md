## Content fundamentals

- Voice: plain, literal, researcher to researcher. State what the evidence shows and how strong it is; never praise, never market. Address the user as "you" only in instructions (for example "Run the study to see a verdict"); results speak about the factor, not about the user.
- Casing: sentence case everywhere (buttons, tabs, headings). Verdict words are capitalised as fixed terms: Supported, Inconclusive, Could not be tested, Not tested. There is no Refuted state: a verdict comes only from Core, and the UI never invents one.
- One wording per state. Use the catalogue in DESIGN.md "Copy and state catalogue" verbatim; do not paraphrase a state on a second page.
- Numbers: set in `value` (mono, tabular, right-aligned in tables and grids). Keep the sign, keep the precision Core returns (never round for looks), unit after the number with a thin space. Long ids and expressions truncate with an ellipsis in a row and wrap in a detail view; the full text is always reachable by copy.
- Punctuation: no exclamation marks, no emoji. A disabled control always carries a visible reason sentence.
- Real copy from the product: "Supported", "Inconclusive", "Could not be tested", "No evidence in this Project", "End of list".

## Visual foundations

- Colour (direction H, owner 2026-11-04): tokens only, black / white / grey. Ground `bg`, surfaces `raised`, text `text` / `muted` / `faint`. White is the contrast device: `signal` and `signal-graphic` are white, the primary action is the white `contrast` fill with `on-contrast` text and one 8px chamfer, the selected navigation item is white text with a white left bar. The only chromatic colour is the sign colour of option C (`up` red, `dn` green) on focal numbers only. Section bars use `bar` with a hatch strip.
- Type (direction H on direction B's scale): Chinese headings in Smiley Sans (`page-title` 18/26, `section` 14/20, `verdict` 24/32, weight 400: the face has one weight), body in Noto Sans SC (`body` 13/20, `small` 12/18, `label` 11/16 muted), every Latin label, number and id in 0xProto (`micro` 10/16 uppercase 0.16em, `value` 13/20, `value-lg` 20/28 for a library headline, `value-focal` 32/36 for the verdict block), always tabular. Nothing below 10px, and 10px only for the micro-label.
- Spacing: only 4 / 8 / 12 / 16 / 24 / 32 (`space-1`, `-2`, `-3`, `-4`, `-6`, `-8`). 4 inside a cell or label to value, 8 between items of a group, 12 between rows of a group and pane padding, 24 between sections, 32 page top and bottom.
- Layout: desktop 1280 to 1920 only, no mobile. Shell maximum `page-max-width`. Two-pane workbench is 40fr / 60fr (editor left, result right).
- Lines, borders and radii: lines instead of boxes. A `line` hairline between rows, one `line-strong` rule under a section heading, toolbar or answer strip. No border around a group that already sits in a pane, no box in a box; one outer border only on a surface that must separate from the ground (pane, popover, dialog). The rail is flat with a right hairline. Square corners everywhere (`radius-control` and `radius-float` are 0). The 8px `chamfer` appears only on the primary button, the verdict block, one card corner and the selected navigation marker.
- Depth: none. Elevation is a fill step (`bg` to `raised` to `selected`), never a shadow or blur. The only decoration is the 72px diagonal hatch strip on section bars and a 3-6 percent contour texture in at most two places.
- States: hover is the `hover` wash; focus is a 2px `text` outline (never removed); disabled is `faint` text plus a dashed border plus a visible reason; selected is `selected` fill and weight 600.
- Motion: see MOTION.md. Studio's own layer with a Motion setting (On / System / Off, default On); with Motion off every final state is shown at once.
- Responsive: designed for 1280 to 1920; below 1000px the two panes stack and the page scrolls.

## Iconography

Direction H: 21 original blocky filled pictograms on a 24-unit grid (`currentColor`), shown at 16px (utility glyphs 12 to 14px). Logo L4, the sealed block (3x3 squares, bottom-right cell an empty frame): the rail mark, the favicon and the wordmark lockup. Verdict glyphs are paired with a word and never carry meaning alone. No emoji, no icon taken from a reference product.
