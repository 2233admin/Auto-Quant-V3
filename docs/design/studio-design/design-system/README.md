## Content fundamentals

- Voice: plain, literal, researcher to researcher. State what the evidence shows and how strong it is; never praise, never market. Address the user as "you" only in instructions (for example "Run the study to see a verdict"); results speak about the factor, not about the user.
- Casing: sentence case everywhere (buttons, tabs, headings). Verdict words are capitalised as fixed terms: Supported, Inconclusive, Could not be tested, Not tested. There is no Refuted state: a verdict comes only from Core, and the UI never invents one.
- One wording per state. Use the catalogue in DESIGN.md "Copy and state catalogue" verbatim; do not paraphrase a state on a second page.
- Numbers: set in `value` (mono). Keep the sign, keep the precision Core returns (never round for looks), unit after the number with a thin space. Long ids and expressions truncate with an ellipsis in a row and wrap in a detail view; the full text is always reachable by copy.
- Punctuation: no exclamation marks, no emoji. A disabled control always carries a visible reason sentence.
- Real copy from the product: "Supported", "Inconclusive", "Could not be tested", "No evidence in this Project", "End of list".

## Visual foundations

- Colour: tokens only. Ground `bg`, surfaces `raised`, text `text` / `muted` / `faint`. The only chromatic colour is signal orange (`signal` for text, `signal-graphic` for marks) and it appears only on state: failure, Could not be tested, a changed-count badge. Never colour a value for being up or down. The primary action is the inverted fill (`text` on `bg`), also used for the selected state; it is not orange.
- Type: Inter Variable (sans) and IBM Plex Mono (values). One focal point per screen: `page-title` 20 for the page, `section` 15 for blocks, `body` 13, `small` 12, `label` 11 muted for metric labels, `value` 13 mono for numbers, `value-focal` 20 mono for the single headline number of a card. Fonts stay as they are; the owner did not choose a different set.
- Spacing: 4px baseline. `space-3` (12px) between cards and as pane body padding, `space-4` between sections.
- Layout: desktop 1280 to 1920 only, no mobile. Shell maximum `page-max-width`. Two-pane workbench is 40fr / 60fr (editor left, result right).
- Borders and radii: 1px hairlines (`line` inside, `line-strong` on the outside of a pane). Radius `radius-control` 6px for panes, cards, controls; `radius-float` 8px for menus and dialogs. The large rounded floating-card look is rejected by the owner.
- Depth: none. Elevation is a fill step (`bg` to `raised` to `selected`), never a shadow, blur or gradient.
- States: hover is the `hover` wash; focus is a 2px `text` outline (never removed); disabled is `faint` text plus a dashed border plus a visible reason; selected is `selected` fill and weight 600.
- Motion: see MOTION.md. Short eases, no decoration, all off under prefers-reduced-motion.
- Responsive: designed for 1280 to 1920; below 1000px the two panes stack and the page scrolls.

## Iconography

Built-in line icons only (the product's existing glyph set), 16px, stroke follows `muted` or `text`. No brand logo and no logo asset: the product has none. Verdict glyphs are paired with a word and never carry meaning alone. No emoji, no icon taken from a reference product.
