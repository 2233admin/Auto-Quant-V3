---
version: alpha
name: AutoQuant Studio
description: Dark-instrument research workbench; one focal point per screen, state colour only on state, sign colour only on the focal row of numbers.
colors:
  bg: "#0a0a0b"
  rail: "#0e0e10"
  raised: "#16161a"
  hover: "#1c1c21"
  selected: "#232329"
  line: "rgba(255, 255, 255, 0.08)"
  line-strong: "rgba(255, 255, 255, 0.16)"
  text: "#ededef"
  muted: "#a1a1aa"
  faint: "#8a8a93"
  signal: "#f2622e"
  signal-graphic: "#f2622e"
  stroke: "#6d6d76"
  grid: "#34343b"
  notice-error-bg: "#262626"
  ramp-0: "#606066"
  ramp-1: "#f1f1f3"
  ok: "#9cd1ac"
  warn: "#e5c06f"
  err: "#ffa095"
  primary: "#ededef"
typography:
  page-title:
    fontFamily: "'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 26px
  section:
    fontFamily: "'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  body:
    fontFamily: "'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
  small:
    fontFamily: "'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
  label:
    fontFamily: "'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
  value:
    fontFamily: "'IBM Plex Mono', 'Noto Sans SC', 'Microsoft YaHei', monospace"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
  value-focal:
    fontFamily: "'IBM Plex Mono', 'Noto Sans SC', 'Microsoft YaHei', monospace"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
rounded:
  radius-control: 6px
  radius-float: 8px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-6: 24px
  space-8: 32px
---

# AutoQuant Studio

Status: DECIDED for type, spacing and lines. On 2026-11-04 the owner chose visual direction B ("dense terminal, clear layers", one of three rendered directions compared for issue #22) and asked for it one size step smaller; the type scale, spacing scale and line rules below replace the DRAFT values. Colour, sign option C and the Settings convention switch are unchanged. The values live in `design-system/tokens.json`; the usage rules live in `design-system/README.md`. This file holds product identity, hierarchy, templates and wording, and points at the package instead of repeating it.

## Overview

AutoQuant Studio has one job: a quantitative factor researcher puts a factor idea in and honestly sees whether it holds, how strong the evidence is, what is uncertain and what the next step is. Verdicts come only from Core; the interface never invents one and there is no Refuted state.

The posture is a dark instrument: flat matte panes, hairline borders, no shadow, no gradient, no decoration. The page earns trust by being quiet and exact. Signal orange is the only chromatic hue and it means state. The one other use of colour is sign colour on the focal row of numbers (option C), mapped onto existing tokens.

Hierarchy and tension rules, and the page templates, are below and are the main new decisions of this extraction.

## Colors

The colour system is the existing Studio token set (dark default, light theme), recorded unchanged in `design-system/tokens.json`: ground `bg`, surfaces `rail` / `raised` / `hover` / `selected`, hairlines `line` / `line-strong`, text `text` / `muted` / `faint`, state `signal` (text) and `signal-graphic` (marks), `stroke` and `grid` for chart marks, plus `notice-error-bg`, the lineage ramp and the legacy `ok` / `warn` / `err`. No colour was added, removed or changed. The primary action and the selected state share one inverted treatment (`text` fill on `bg`), not an orange fill. Sign colour is allowed on focal numbers only, through the roles in "Signed numbers" below; this reverses the first draft, which forbade it. Nothing is added to the token set: the sign roles are aliases of existing tokens.

## Typography

DECIDED (owner, 2026-11-04): direction B, one step smaller than the mock. Prose and UI are set in Inter Variable with a CJK sans fallback (`'Inter Variable', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif`). IBM Plex Mono is used ONLY for numbers, ids, hashes, code and commands, always with `font-variant-numeric: tabular-nums`; never for prose, labels, buttons or headings. Weights in use: 400, 500 and 600 only (590 is retired). Nothing renders below 11px.

| Step | Size / line | Weight | Role |
| --- | --- | --- | --- |
| page-title | 18 / 26 | 600 | page header title, the anchor of each page |
| section | 14 / 20 | 600 | section and pane headings; the verdict word of an answer strip |
| body | 13 / 20 | 400 | default text |
| small | 12 / 18 | 400 | secondary lines, captions, the split/state line under a row name |
| label | 11 / 16 | 400 | column headers, metadata keys, chip text; muted |
| value | 13 / 20 mono | 500 | numbers in tables and metric grids; a library row's focal metric uses weight 600 |
| value-focal | 22 / 28 mono | 600 | the headline numbers of an answer strip |

The former headline (28/40) and title (26/34, weight 590) steps are retired; the page title is the largest text on a page except the answer strip's focal numbers.

## Lines instead of boxes

DECIDED with direction B. Structure comes from a column grid, alignment and type contrast, not from boxes.

- A hairline (`line`) separates rows of a list, table or key/value table.
- One `line-strong` rule sits under a section heading, a toolbar or an answer strip.
- No border around a group that already sits in a pane; no box in a box (chips inside cards inside panes). Chips and tags inside a pane are text.
- One outer border only where a surface must separate from the ground: a pane, a popover, a dialog. The rail is flat with one right hairline; library pages sit directly on the ground.
- Radius `radius-control` 6px on controls and pane edges; `radius-float` 8px on popovers and dialogs only.
- Alignment: numbers right-aligned in tables and metric grids, labels left, consistent column widths, header row in `label`.

## Layout

Desktop only, 1280 to 1920 wide, no mobile. Spacing uses only 4 / 8 / 12 / 16 / 24 / 32 (`space-1`, `space-2`, `space-3`, `space-4`, `space-6`, `space-8`; the 20px and 40px steps and every 5/7/9/10px literal are retired): 4 inside a cell or between a label and its value, 8 between items of one group, 12 between rows of a group and as pane padding, 24 between sections, 32 at the page top and bottom where there is room. The shell is a left rail (240 expanded, 68 collapsed) and a page area on `bg`, 8px outer margin and 8px gaps. Workbenches are two panes, 40fr left (minimum 340px) and 60fr right. Maximum width 1800px, centred beyond. Below 1000px the panes stack and the page scrolls.

## Elevation & Depth

None. Depth is a fill step (`bg` to `raised` to `selected`) and a 1px hairline. No shadow, blur or gradient. The only decoration is the 1px dashed outline of an empty state and the dashed rule of an Inconclusive verdict.

## Shapes

Radius `radius-control` 6px for controls and pane edges; `radius-float` 8px for menus, popovers and dialogs only. The reference's large rounded floating-card look is rejected by the owner and is removed: since direction B (2026-11-04) the rail, the top bar and library pages are flat on the ground with hairlines, and workbench panes are separated by one column hairline instead of an outer box. No shadow, no gradient.

## Components

The kit is recorded in `design-system/components/`: FloatingShell, PaneCard, Tabs, SegmentedToggle, ActionRow, VerdictBar, StatusLine, ChartCard, MetricGrid, FactChips, ProjectCard (the library card) and StateBlock (empty, loading, error). Each has a README with states and a live preview. The `ProjectCard` layout (name, small tag, one headline metric line, sparkline, footer with object type and update time) is the card structure adopted from the reference; it is a proposal to be built, not the current card. Since direction B (2026-11-04) the Factor and Strategy libraries render aligned rows (`LibraryRow` in a `LibraryTable`), not cards; the row keeps the same content (name, small tag line, focal metric, sparkline, update time) in columns.

## Hierarchy and tension rules

1. One focal point per screen. Everything else recedes. The focal point is the thing the researcher came to decide.
2. What may be the focal point, by page type:
   - Library: the list as a whole has no single focus; within a row the focal point is the focal metric (validation rank IC for a factor, net return for a strategy) in `value` at weight 600, the only number of the row that takes sign colour. The page title anchors the page; the create action is the only inverted button in the toolbar.
   - Factor workbench: the verdict line, then the chart. On a fresh factor with no run, the Run action in the left pane head.
   - Strategy workbench: the verdict line and the headline metrics bar of the selected run; the inspector tabs are chrome.
   - Evidence page: the verdict word and its one-sentence reason, then the evidence strength.
   - Settings: none; a plain list with the page title as the only anchor.
3. What must recede: navigation, tabs not selected, derived actions (save as version, export), labels (`label`, muted), hairlines, provenance facts, the second and later runs.
4. Tension is made by size and weight steps, not by colour. Allowed contrast devices: the inverted primary or selected treatment (once per region) and one step of type size. Not allowed: a second accent colour, a fill behind a coloured number, filled coloured badges, sign colour outside the focal row (rule 5a).
5. Two colour roles exist and never merge. State colour appears only on state: `signal` on Could not be tested and on failure words, a tab badge for a count needing attention. A normal number, label or chart series is never state-coloured, and state colour never colours a number for its sign.
5a. Sign colour (option C, decided) appears only on the focal row of numbers in the verdict area, with a +/- glyph on each; every other number is neutral. See "Signed numbers".
6. A uncertain result must look uncertain: Inconclusive uses a dashed rule and the word, never a softer green. Evidence strength is shown as a sentence and facts, not as a score badge that looks like a verdict.
7. At most one primary (inverted) button per card or pane head.

## Signed numbers

DECIDED (owner): option C, hybrid. Sign colour appears only on the focal row of numbers in the verdict area, for example the headline stat chips next to the run selector and the long-short headline numbers. All other numbers are neutral. The paired-figure pattern (see "Data figure anatomy") applies to figures: baseline grey, subject one accent, value labels at bar ends, a caption stating the takeaway. This replaces the first draft's rule that values are never coloured by sign, and it narrows the owner's earlier choice of colouring every signed number: only the focal row is coloured. State colour (verdict words, failure) is a separate role and stays as before.

Sign roles (aliases of existing tokens in `tokens.css`; no hue is added):

| Role | Meaning | Applies to (focal row only) |
| --- | --- | --- |
| `sign-positive` | value above zero | headline return, excess return, rank IC, long-short spread, delta vs leader in a figure caption |
| `sign-negative` | value below zero | headline drawdown, negative return, negative IC or spread, negative delta |
| `sign-neutral` | zero, or no sign | exact zero; maps to `text` |

Rules:
1. Colour the VALUE text only. Never a cell, row, badge, bar or card fill.
2. Sign-independent cue (accessibility): every coloured number carries a leading `+` or a leading minus glyph (−, U+2212), so the sign reads without colour. Colour never carries the sign alone. Zero shows `0.00` with no sign. Non-focal signed numbers keep their glyph and stay neutral.
3. Statistics without a direction stay neutral (`text`) everywhere, including inside the focal row's neighbours: HAC t, p-values, observation counts, trial counts, hit rates, turnover, ids, dates.
4. Coloured numbers must never imply certainty. Development evidence keeps its "development" tag (or the "development evidence" caption) next to the numbers; a sign colour does not replace the verdict line, and the verdict word (state colour role) is never derived from a number's colour.
5. Sign colour never combines with state colour on one value. A failed or hidden value is "Hidden" or absent, not a coloured number.
6. Chart series and bars are not coloured by sign; only printed focal values are.
7. A card headline number (`ProjectCard` `value-focal`) is the card's focal number and takes the sign role; other numbers on the card stay neutral.

### DECIDED: up/down convention is a Settings switch

The mapping of sign to hue is a setting with the default red up / green down (A-share convention). A Settings-page switch flips it to green up / red down. The switch changes presentation only, never data: values, the +/- glyphs, copied text, exports and API payloads are identical in both settings.

| Role | Default: red up / green down | Switched: green up / red down |
| --- | --- | --- |
| `sign-positive` | `err` (dark `#ffa095`, light `#b3261e`) | `ok` (dark `#9cd1ac`, light `#2f7a4a`) |
| `sign-negative` | `ok` | `err` |
| `sign-neutral` | `text` | `text` |

Settings control spec (component `SignConventionSetting`): one row in a "Display" group on the Settings page. Label "Price colours"; a `SegmentedToggle` with "Red up, green down" (default, selected on first run) and "Green up, red down"; helper sentence "Changes colours only. Numbers, signs and exports stay the same." A per-user preference, applied at once without reload or confirm, implemented as `data-sign-convention="red-up" | "green-up"` on the document root, which re-maps `sign-positive` and `sign-negative` in `bundle.css`. Read-only session: the control stays visible and disabled with a reason line. Keyboard: arrow keys move, space or enter selects. The design-system previews render both: `MetricGrid/preview.html` and `FigureCard/preview.html` show the two conventions side by side, `MetricGrid/preview-c-red-up.html`, `MetricGrid/preview-c-green-up.html`, `FigureCard/preview-c-red-up.html`, `FigureCard/preview-c-green-up.html` show each alone, `SignConventionSetting/preview.html` has a live toggle, and `?convention=red-up|green-up` on any preview URL switches it.

Assumptions flagged: `ok` and `err` are the existing legacy state colours in `tokens.css` and are the only existing green-family and red-family tokens, so they are reused instead of adding hues; their contrast on `bg` and `raised` is checked at 4.5:1 in both themes. Which numbers count as "the focal row" per page is listed in "Hierarchy and tension rules" (the verdict-area numbers); the exact list per template is for the build to follow.

### Considered and not chosen (appendix)

Option A (colour every signed value, two convention variants) and option B (neutral grey plus one subject accent, sign by glyph only, no red or green) were prototyped for comparison: `MetricGrid/preview-a-red-up.html`, `MetricGrid/preview-a-green-up.html`, `MetricGrid/preview-b.html`, the same names under `FigureCard/`, and all together with option C in `preview-considered.html` of each. They are kept as record only. The tension that was weighed: the owner's favourite data-reading page is neutral grey plus one accent and never red/green by sign, while the QUBE-style reference colours signed numbers; option C takes sign colour on the focal row and the grey-plus-accent figure pattern elsewhere.

## Data figure anatomy

Source: the owner's favourite data-reading page, the Anthropic code-review blog post (captures `reference/code-review-*.png`). Structure and patterns only. Never borrow its mascot, imagery, copy, fonts, colours or logo. Observations and the Studio use of each:

1. A figure is a quiet bordered panel: bold title plus a muted one-line subtitle, the data, a small mono `FIG A` label whose caption states the takeaway in ONE sentence, and a tiny `PNG` export tag. Studio: evidence figure cards (`FigureCard`) on the factor workbench and run pages; the caption sentence is the takeaway, with the "development" tag when the data is development evidence.
2. Paired comparison bars: baseline in neutral grey, subject in ONE accent, value labels at the bar ends, no gridlines or axes, the key number bold, a minimal two-item legend. Studio: candidate vs leader, validation vs test, trial N vs N-1. Baseline `stroke`, subject `text` (not orange: `signal` is state).
3. Small uppercase mono group labels with generous spacing instead of boxes; each row is a bold name plus a muted description in a second column. Studio: grouping on the evidence page and in the metadata block instead of nested cards.
4. A terminal-style tree table of contents with a reading-progress bar and a "MIN READ" line, sticky on the left. Studio: the section navigation of the evidence page (sticky left, current section marked, progress bar; "MIN READ" not needed).
5. A metadata block with tiny mono labels (AUTHOR / CATEGORY / PUBLISHED) and tree glyphs. Studio: the run and study metadata block (study id, split, trial count, data window, created).
6. Tables with no borders between cells, only a header row and group spacing. Studio: evidence tables and the library list view; `MetricGrid` keeps its hairlines (a grid of cells, not a table).
7. Tension: neutral by default, ONE accent for the thing being claimed, bold only on the number that matters. Studio: the library card headline line takes the single bold focal number; this is the same logic as option C.

Mapping summary: evidence/figure cards (1, 2, 7), run/study metadata block (5), evidence-page section navigation (4), library card headline line (7).

## Dense data patterns

Source: the Arknights: Endfield wiki on Bilibili Wiki (https://wiki.biligame.com/zmd), captured read-only (`reference/endfield-wiki-*.png`). Structure and patterns only, for the library and evidence pages. Never borrow its imagery, game assets, colours, fonts, copy or logos. Only what the captures show is recorded:

- Filter bar with facets: the roster page puts a full-width facet table above the list. Each facet is a labelled row (rarity, class, element, weapon) of toggle chips, plus a "view all" reset chip and a collapsible "more options" row. Studio: library filter bar with one labelled row per facet (object type, verdict, split, status) and a reset chip. Counts: the captures show no facet counts; the Studio toolbar keeps its counts (a Studio addition, not borrowed).
- Roster density: a tight grid of compact tiles, each with small attribute chips on a corner (class glyph and element glyph). Studio: card or table row with attribute chips (object type, split, verdict) in a corner or a fixed column.
- Two-tier navigation: a global section row and a second row of siblings of the current catalog, with a breadcrumb and a meta line (reads, updated date, last editor). Studio: breadcrumb plus a meta line (updated, editor) on library and evidence pages.
- Sticky section navigation: the section bar re-appears fixed at the top after scrolling (visible in the scrolled capture). Studio: sticky evidence-page section navigation.
- Many numbers without losing legibility: chips and small tiles instead of prose; numbers in labelled cells. Studio: label-left value-right cells (`MetricGrid`) and chips for attributes.
- NOT captured: a detail page. The detail URL (https://wiki.biligame.com/zmd/莱万汀) returned the site's own security block page (567) in this session, and so did the roster and home on later loads (`reference/endfield-wiki-blocked.png`). The block was not worked around. The detail-page section order, sticky section navigation and number tables are therefore unobserved and are NOT recorded as borrowed patterns. The guessed roster URL 干员一览 does not exist; the roster is 干员图鉴.

## Page templates

Each template lists regions in reading order and what is on the first screen (1440x900 reference) versus folded.

1. Library (factors, strategies, runs), direction B: title (page-title with its one description line beside it), then one toolbar row (create primary and secondary actions left; verdict or state tabs as text with counts and an underline on the active one; split select; search right-aligned; reset only while a filter is set) closed by one `line-strong` rule, then an aligned list with one row per object and `label` column headers: name with a `small` split/state line, verdict, focal metric, the neutral numbers, overlap, sparkline (or "No curve"), last update; numbers right-aligned and tabular; hairlines between rows; the count of shown objects at the foot. The Factor library lists only Factor objects: a Project that publishes a strategy projection (a derived strategy or the multi-lane sample desk) belongs to the Strategy library even when it carries its inherited Factor Study. First screen: title, toolbar and the first rows. Run history leads each row with the Project name.
2. Factor workbench: header (back, page-title with description, object-type tag). Left pane (editor): tabs (Definition, Versions) with the Run action top-right, parameter grid, then the expression editor with formula or Python toggle and a validation chip. Right pane (result): run selector with headline stats, status line, verdict line, chart card, metric grid. First screen: definition, the Run action, verdict, chart, first metric row. Folded: older runs, progress stages, versions, provenance facts, derived actions. Issue #7 adds the explicitly requested Build strategy action and its visible refusal reason to the answer action row; the remaining proposed action-chip layout is not adopted wholesale.
Result pages (factor evidence, factor idea answer, strategy backtest), direction B: the run line (Run selector left, result actions right), the status line, then the answer strip: verdict word in `section` weight with its reason on the left and the headline numbers in `value-focal` on the right, one rule under it (dashed for Inconclusive); then the chart (8 columns) and the metric list (4 columns) side by side when the pane is at least 700px wide, stacked otherwise; provenance (a desk's "Built from a standalone Factor" facts) moves below them as a quiet two-column key/value table with `label` keys; detail tabs last. Nothing is removed; only order, weight and grouping change.
3. Strategy workbench (issue #7 implementation): title card with the Project definition and published lifecycle, then one evidence pane with Backtest, Versions, Tuning and Analyses. Backtest keeps the Portfolio run selector, verdict, focal net headline row, FigureCard and metric catalogue. Versions reuses history/compare; Tuning exposes only the base-family adjustment and neighborhood scope; Analyses links Project-owned evidence. First screen: title, tabs, selected evidence. Folded: holdings tables, details and older runs. This task-specific layout follows [[docs/design/studio-information-architecture]].
4. Evidence page: title bar, verdict line (focal), evidence-strength sentence, uncertainty list, the test-split status, the next step, then the full metric grid and provenance facts. Single column up to 960px, centred. Folded: raw tables.
5. Settings: title bar, grouped lists of label-and-control rows under section headings, one primary button per group at most. No cards.

## Copy and state catalogue

One wording per state, used on every page. Verdict words are fixed terms, sentence case elsewhere.

| State | Word or sentence | Notes |
| --- | --- | --- |
| Supported | "Supported" | pill; the sentence after it names the evidence |
| Inconclusive | "Inconclusive" | pill with dashed rule; sentence says what is missing |
| Could not be tested | "Could not be tested" | pill in `signal`; sentence says why the run failed |
| Not tested | "Not tested" | muted word, no rule colour; action "Run study" is offered |
| Stale session | "Stale session" | status line word; body: "This view was loaded before the workspace changed." Action: "Refresh" |
| Read-only | "Read-only session" | actions stay visible but disabled, reason line: "Read-only session: actions are off." |
| Hidden test split | "Hidden" | in the value cell; line: "Test split is hidden until the study is frozen." |
| Empty | "No evidence in this Project" | one next-step sentence, no icon |
| Loading | "Loading…" | box already at content size; no skeleton and spinner together |
| Error | "Could not load this Project" + cause + "Retry" | outline `signal-graphic` on `notice-error-bg` |
| Long values | truncate with ellipsis in rows, wrap in detail, full text copyable | ids and expressions |

The wording for stale session, read-only, hidden test split and the error title is proposed here (the existing code has "No evidence in this Project", "Loading…", "End of list" and the verdict words). Treat the proposed sentences as drafts for the owner.

## Interaction conventions

- One primary button per card or pane head; others are outline or quiet.
- A disabled control keeps its label and shows a visible reason sentence next to it; a tooltip is not a reason.
- Trial counting: any action that spends a trial (a run on a held-out split) asks for a confirm that states how many trials will be counted; cancelling spends nothing.
- A frozen question cannot be edited: its fields are read-only with the lock glyph and the sentence "This question is frozen"; the way forward is "Start a new question".
- No dead buttons: every enabled control produces a visible change or a visible refusal reason. A control that cannot work yet is not rendered.
- Motion confirms an action and never delays it (see `MOTION.md`).

## Do's and Don'ts

- Do keep one focal point per screen and the type tiers to four.
- Do use only tokens from `design-system/tokens.json`; do set numbers, ids, hashes, code and commands in mono (tabular) and everything else in the sans; do give every coloured number a leading + or minus glyph; do keep the up/down convention a Settings switch.
- Do show the reason beside every disabled control.
- Don't colour a number for anything but its sign, and only on the focal row; don't fill a cell or badge with sign colour; don't signal sign by colour alone; don't colour HAC t, p-values, counts or hit rates; don't add an accent colour or a new hue.
- Don't use shadows, gradients, blur or the large rounded floating-card look.
- Don't use any colour, font, icon, copy or brand mark from a reference product.
- Don't show a Refuted state or compute a verdict in the interface.
- Don't ship a screen without its empty, loading, error, stale, read-only, hidden-split and long-value states.

## Product Context

- Product: AutoQuant Studio, a research workbench for quantitative factors.
- Audience: the owner and their agent first; planned open source for external users.
- Surface: desktop browser 1280 to 1920 wide, dark primary with a light theme, no mobile.
- Content: real verified Workspace snapshot data; verdicts only from Core.
- Required states: empty, loading, error, stale session, read-only (actions off), test split hidden, long values (ids and expressions).
- Assets: no brand logo, built-in line icons, existing fonts (Inter + IBM Plex Mono), colour tokens unchanged.
- Intake record: `brief.md` and `.design-pipeline/state.json`. Real brands: none.

## Source Decisions

Change id: `studio-design-foundation` (design/changes/studio-design-foundation). Reference: `reference.md` and `reference-evidence.json` (PandaAI structure study, role primary-target, fidelity directional-inspiration). Owner decisions recorded in the reference approval.

Adopted (the owner answered yes to all three):
- (a) Hierarchy and type-scale gradient: a large title, a medium section heading, a small metric label, one focal point per screen. Applied as the type table and the hierarchy rules above, with our own sizes.
- (b) Page skeleton and function distribution: left editor plus right result for the factor workbench; library pages with title bar, toolbar and compact cards; strategy workbench with a multi-tab inspector; the first-screen versus folded split. Applied as the page templates above.
- (c) Card internal structure: name, small tag, one headline metric line, sparkline, footer with object type and update time. Applied as `ProjectCard`.

Rejected (first extraction):
- The reference's content (all text and data), copy, colours, fonts, icons, brand marks and logos.
- The large rounded-corner floating-card look: the owner does not want rounded corners; our existing smaller radius stays.
- Red-up and green-down colour semantics: the first draft rejected them; the owner has since decided sign colour on the focal row with a Settings switch, default red up / green down (see "Signed numbers"). The QUBE hues themselves are still not adopted.

The original action-chip row was not adopted wholesale. Issue #7 explicitly
requests Build strategy on the Factor answer action row and in the Strategies
library; this one action now follows the confirmed local-action rules, with
visible refusal and CLI guidance when Core cannot perform the conversion.
Other undecided actions remain outside this change. Fonts remain Inter and
IBM Plex Mono. Screenshots are technical review evidence, not owner visual
acceptance.

Existing system: colour, spacing and radius tokens are recorded unchanged from `studio-app/src/design/tokens.css`; the workbench kit is recorded from `studio-app/src/components/workbench`. The design-system package is `design-system/`. The graybox comparison and Spec Reconciliation are deliver-stage work (they need a running build with a graybox mode).

Revision after owner rejection: (1) type scale and radii confirmed unchanged; (2) number colouring changed to sign colour (first chosen as every signed number, then decided as option C: focal row only), with the red-up / green-down convention a Settings switch (default red up); (3) two further references added as supporting evidence: the Arknights: Endfield wiki (dense data patterns; detail page not capturable, blocked by the site) and the Anthropic code-review blog (data figure anatomy), structure and patterns only; (4) motion licence: see MOTION.md Source Decisions.
