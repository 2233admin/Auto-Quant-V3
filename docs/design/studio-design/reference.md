# reference.md - PandaAI (QUBE) structure study for AutoQuant Studio

Status: reference stage. Observation only; nothing is built. Measured with PIL from the screenshots at native size, no resampling.

Owner constraint (intake): our colour tokens stay unchanged; QUBE colours, fonts and icons are never adopted. Only structure, density, hierarchy and function distribution are borrowed. Colour numbers below describe roles, not values to copy.

## 1. Source inventory and provenance

All files were copied into the project (originals untouched). All resolve to file paths.

| Id | Project path | Origin | Size | Role |
| --- | --- | --- | --- | --- |
| R1 | reference/panda-factor-workbench.png | D:\tmp\panda\factor-result2.png | 1534x847 | primary-target (registered in reference-evidence.json) |
| R2 | reference/panda-factor-library.png | D:\tmp\panda\study\factors.png | 1440x900 | supporting |
| R3 | reference/panda-strategy-library.png | D:\tmp\panda\study\strategies-list.png | 1440x900 | supporting |
| R4 | reference/panda-backtest-result.png | D:\tmp\panda\bt1.png | 1920x911 | supporting |
| R5 | reference/panda-tuning.png | D:\tmp\panda\tune1.png | 1920x911 | supporting |
| C1 | reference/current-factor-workbench.png | D:\tmp\orca-shots\g-final-momentum.png | 829x518 | current state, comparison only |
| C2 | reference/current-factor-library.png | D:\tmp\orca-shots\g-factors-lib.png | 975x920 | current state, comparison only |

The schema holds one source per document, so only R1 is in `source`; R2-R5 and C1-C2 are supporting evidence recorded here with their sha256 (end of file). The page body is Chinese; I read it, labels below are translated.

## 2. Observable composition, type, colour, material, lighting, motion

### 2.1 Layout rhythm (px, native resolution)

- Outer margin 8 (canvas visible around everything). Panels are 1px-bordered rounded rectangles; no shadow.
- Gap between panels: 8 (sidebar to main column, header to body, library header to toolbar). Gap between the two body panels in the workbench: 16 (x 695-710).
- Sidebar: x 8-247, 240 wide, full height (8 to H-8). Brand block ends at y~65 (divider). Nav row pitch 40, row height ~36, selected row is an inverted full-width pill.
- Header bar: y 8-63, 56 tall, full width of the main column. Toolbar row under it (library pages): y 72-103, 32 tall. Card grid starts y 112 (8 under toolbar).
- Library cards: 387 wide x 137 tall (R2/R3), 3-column grid over 1176 px content width, column gap 8-9. Card padding 16 left/right, ~16 top. A 1px rule separates the card footer line.
- Workbench body (R1, 1534 wide): left param panel x 256-694 (439 = 34.6% of main column 1270), right result panel x 711-1525 (815 = 64.2%). Panels run y 72 to H-8.
- Workbench inner padding ~13-14 (param panel content starts x 270; result cards start x 740, i.e. 28 in from the panel edge, card padding 13). Parameter grid row pitch 26. Metric grid: 3 columns x 3 rows, cell ~244x34, vertical pitch 40, horizontal gap 8-9.
- Backtest (R4, 1920 wide): sidebar 240, chat panel x 256-1127 (~871, 45%), result panel x 1136-1912 (~776, 40%). Result panel: tab bar y 85-112 (5 equal segments), run selector row, action chip row, progress row, 2-column x 5-row metric table at pitch 40, then a chart card (~y 493-837) and a holdings table that continues below the fold.

### 2.2 Region proportions

- Sidebar 240 px fixed = 15.6% of 1534, 12.5% of 1920.
- R1: header 56 of 847 tall (6.6%); body 767 (90.5%). Right result panel is almost 2x the left param panel.
- R4/R5: three columns 240 / 871 / 776. The right panel is a detail inspector of the object named in its header.
- The empty main area in R2/R3 is intentionally dark: two cards occupy about 40% of the width, the rest is canvas. The list view does not stretch cards.

### 2.3 Type scale (estimated from glyph bounding boxes; CJK glyph em is about the glyph width)

| Role | Estimate | Weight | Evidence |
| --- | --- | --- | --- |
| Page title (library header) | ~18 px | semibold | 因子库: 3 chars, 53 px wide |
| Detail page title | ~16-17 px | semibold | 新股票因子 (#968): glyph height 16 |
| Section heading in card | 14 px | bold | 分组累计收益 6 chars 84 px; 核心指标 4 chars 56 px |
| Card title (library) | 14 px | bold | 新股票因子 5 chars 70 px |
| Body / nav / buttons / run selector | 13-14 px | regular, buttons medium | nav 因子库 3 chars 41 px; chip text 12-13 |
| Form labels, descriptions, meta | ~12 px | regular | 分析区间 4 chars 46 px; description line height 13 |
| Metric label | ~10-11 px | regular | 因子收益 4 chars 39 px |
| Metric value | ~12-13 px | monospace, medium | digit height 10 px (3.67%), width 37 for 5 glyphs |
| Subtitle / hint | ~10-11 px | regular | 暂无描述 4 chars 42 px |

Heading 14 vs label 10-11 vs value 12-13 gives the "label small and quiet, value mono" pairing. Only about 4 size steps appear on a page: 16-18 title, 14 heading, 12-13 body, 10-11 label.

### 2.4 Colour roles as observed (not to be adopted)

- Canvas #0a0a0a; panel/card surface #171717; inset input and code editor #212121; chip / tag fill #262626-#292929; segmented-tab track #262626.
- Border 1px #2e2e2e on panels, ~#262626 on inner cards.
- Text: primary ~#e5e5e5 to #fafafa; secondary ~#989898/#b6b6b6; tertiary ~#666.
- Primary action: light pill (#e5e5e5 fill, dark text); secondary action: mid-grey fill (#7e7e7e save button) or outlined chip. Selected nav and selected tab use the same inverted light pill, so "selected" and "primary" share one look.
- State colour: green #00bc7d for progress and the "validated" chip (dark green tint fill #152821); signed numbers use red #e06a82 for gains and green #5bd0a0 for losses (CN market convention), applied to value text only, never a cell background. Red badge on notifications.
- No gradients, no shadows; one light-on-dark inversion is the only strong contrast device.

### 2.5 Material, lighting, motion

Flat, matte. No blur, glow or depth cues. Motion is not observable from stills: a progress bar reads 100%, a spinner appears next to a running chat session (R5), a model selector is dimmed while generating (R5). Hover, focus, transition timing, chart animation: unseen.

### 2.6 Per-region structure (R1 factor workbench)

| Region | Rows | Columns | Contents left to right | Breaks from |
| --- | --- | --- | --- | --- |
| sidebar | 3 | 1 | brand block; nav list (chat sessions then 6 destinations); footer utilities (collapse, notifications, compute balance, settings, user) | none |
| page-header | 1 | 3 | back arrow; title with edit pencil over a description line; asset-type tag at far right | sidebar |
| param-panel | 3 | 1 | tab pills (params, versions) left and save and run actions right; 2x2 grid of date range, rebalance period, group count, direction, stock pool; formula editor with formula/Python toggle and validation chip | none |
| result-panel | 5 | 1 | run selector with timestamp; secondary action chips (this run's params, AI optimise, save as version, build strategy, export PDF); one-line progress with 100%; large chart card; core-metrics card | sidebar |
| metrics-grid | 3 | 3 | label with help glyph at left, mono value at right, nine cells | sidebar |

Uniform structure across regions? **No.** The page-header is a single three-column row, the result panel is a five-row stack and the metrics grid is a 3x3 table; only sidebar and param-panel share the 3x1 structure.

Other pages (supporting, not in the JSON composition block):

| Region | Rows | Columns | Contents left to right | Breaks from |
| --- | --- | --- | --- | --- |
| R2 library header | 1 | 2 | page icon and title; one-line description | none |
| R2 toolbar | 1 | 4 | two create buttons; segmented filter with counts; search field (R3 adds a third create button, a sort select and a direction button) | R2 library header |
| R2 card | 3 | 2 | row 1 title and type tag; row 2 headline numbers and sparkline; row 3 type label and last-updated time | none |
| R4 chat column | 3 | 1 | tab strip of open objects; scrolling conversation; composer with model selector and send | none |
| R4 inspector | 6 | 1 | title and description; 5-segment tab bar; run selector with headline numbers; action chips; progress; 2-column metric table then chart then table | R4 chat column |

## 3. Spatial evidence for and against 3D

For: none. Against: every edge is axis-aligned, no foreshortening, no occlusion, no depth effects, no camera control; charts are 2D plots. Glow and blur are absent. Nothing activates a spatial route.

## 4. Selected route

Route `2d`, camera none, interaction none (ordinary hover and tab controls only), output screen-space UI. Confidence 0.95; the only uncertainty is unseen hover or transition states, which cannot change the route.

## 5. Hierarchy (single focal point and eye path)

- Workbench (R1): focal point is the result panel's chart card with the metrics card under it. The strongest contrast sits on the inverted "run analysis" pill and the selected nav item, so the eye goes: selected nav, title, run action (top right of the left panel), then across to the run status line, the chart, the core metrics. The chart is the largest area (about 50% of the result panel).
- Factor library (R2): no single focus; the first card, scanned left to right then top to bottom. The toolbar's inverted create buttons carry the strongest contrast, so create-new outranks content.
- Strategy library (R3): same as R2; the card carries a description sentence, so it is about 50 px taller.
- Backtest (R4): focal point is the net-value curve with headline numbers (return, Sharpe, annual) in the run selector line; metrics table second; chat is the quiet side column.
- Tuning (R5): focal point is the centred empty-state message and its single run button; the rest is chrome.

## 6. Function distribution

- Sidebar (all pages): brand top; session list and "new session"; the 6 destinations (strategy library, factor library, run history, tuning, simulation, market) plus the conversation workbench; bottom utilities (collapse, notifications, compute balance, settings, user). Navigation never moves between pages.
- R1 header: back, title (editable), description (editable), asset type. R1 param panel: tabs, save and run at the top-right of the left panel, parameters above the formula. R1 result panel: run selector, derived-action chips (save as version, build strategy, export), progress, chart, metrics. The primary action (run) is in the left panel top-right; the output is in the right panel.
- R2/R3 libraries: header (title + one sentence of purpose), toolbar (create actions left, filter + search + sort right), card grid; a card shows name, type tag, 1-line headline metrics, sparkline, object type, update time; footer line "all loaded".
- R4: the result panel is tabbed (params, versions, backtest history, tuning history, AI fix); one object has all five lives in one inspector.
- R5: the tab content area shows an empty state with one action.

## 7. First screen versus hidden

- On first screen: nav, selected object's name, parameters, formula, run action, the latest result with progress and chart, metrics, derived actions.
- Hidden or below the fold: older runs (dropdown), progress stages (chevron expands), holdings table (R4 below fold), card-level actions. Metric help glyphs hide explanations. No confidence or evidence-strength cue is shown anywhere: QUBE shows signed numbers only.

## 8. Current state versus reference (C1, C2)

- C1: our workbench already has the same 3-column frame (sidebar 140, params 240, result 440 at 829 wide), panels #16161a on #0a0a0b with 1px borders, so the shell structure matches. Differences: our result panel starts with a status strip then a chart then a metrics card, no separate action-chip row; param fields are denser and truncated; the title is ~11 px against 16-17 in the reference, so the page title does not anchor the page.
- C2: our library uses a header bar plus a nested page panel with 2-column cards; page title ~18 px; card title ~14 px; headline number ~16 px mono. Cards carry verdict chip, evidence line and trial counts, more than QUBE's one line; spacing between sections inside the card is looser.

These are reads from different viewport widths (829 and 975 versus 1440-1920); comparisons are proportional, not absolute.

## 9. Fidelity invariants (structure, density, hierarchy only)

1. A fixed 240-class sidebar plus bordered panels on a darker canvas, 8 px outer margin, 8 px between panels, 16 px between the two body panels.
2. Page header bar 56 px tall with title, one description line and a type tag, separated from the body.
3. Library: toolbar of 32 px (create left; filter, search, sort right) above a 3-column card grid, 8 px gaps; card padding 16.
4. Workbench: two panels (about 35/65), parameters and formula left, run action at the top-right of the left panel, results (status, chart, metrics) right.
5. Metrics as a label-left value-right grid, 3 columns, 40 px row pitch; labels smaller than values; values monospace.
6. About four type steps per page (title, heading 14, body 12-13, label 10-11).
7. One inverted treatment for selected and primary; state colour only on values and progress.
8. Empty state: one sentence and one action, centred in the panel.

Do not adopt: QUBE colours, fonts, icons, red-up and green-down colour semantics (our tokens decide), logo, copy.

## 10. Uncertain or missing evidence, and how it will be tested

- Hover, focus, active, disabled transitions and animation timing: not visible in stills; test on the built page and compare in owner review.
- Real font identity and sizes: estimated from glyph boxes with CJK width equal to em; Latin text may differ by about 1 px. Test by overlaying our rendered type scale on the references.
- Narrow widths: only 1440, 1534 and 1920 seen; behaviour at 1280 unseen. Test at 1280 in the graybox.
- Long values (ids, expressions), error, stale, read-only, test-split-hidden states: none appear in the screenshots, so QUBE cannot guide them. They come from the owner brief and our own state matrix.
- Scrolling behaviour, sticky regions, whether the right panel scrolls independently: unseen (R4 shows a cut-off table, which implies inner scroll).
- QUBE has no uncertainty or evidence-strength display; our product needs one, so that part has no reference.

## 11. Resulting artifact requirements

- reference.md (this file) and reference-evidence.json, both written.
- graybox.png: layout-only render of our factor workbench and factor library at 1440 wide, produced in the deliver stage; `reference check` stays blocked until a graybox block is recorded.
- The extract stage (owner-locked) turns these measurements into DESIGN.md.

### Supporting evidence digests

- reference/panda-factor-library.png sha256 5791b35da9b5031eba045771379b14ee6882ed5a65c24ad89e82984ea73b9e5b
- reference/panda-strategy-library.png sha256 92e1e9578cca5efbbce462b2b11a0daefac3252b1e6eb38dae0a05a74141ba2e
- reference/panda-backtest-result.png sha256 0c068ea463e1c353c43c87d6b1d5d7d5346f4d37d66a428a5edd9606e3a54dcf
- reference/panda-tuning.png sha256 44bd8119ed180f77bcc7fa4b7940dc3a1605181e417647f3eb1b1b92ae06f2b7
- reference/current-factor-workbench.png sha256 7b633d5fc415c0cb1e61345222125d4e1c546a2eb5c3fa4466fe3391d200c3c7
- reference/current-factor-library.png sha256 cd64c883cad6b074152cb32b6909a26bb0507246f413c2c8cc3ab984d606e618

## 12. Additional references added after the owner's rejection (supporting evidence)

Both are structure and pattern references only. Never borrow imagery, game assets, mascots, colours, fonts, copy or logos. They are supporting evidence in this file (the evidence JSON still holds one primary source). The Endfield captures were made read-only with the Orca browser CLI on 2026-11-01, no login, nothing clicked that changes state, tab closed afterwards. The code-review captures were supplied by the coordinator (public page, read-only).

### 12.1 Arknights: Endfield wiki, Bilibili Wiki (https://wiki.biligame.com/zmd)

| Id | Project path | What it shows | Size |
| --- | --- | --- | --- |
| E1 | reference/endfield-wiki-home.png | home page: title block, two-level menu, catalog tiles, activity calendar (right half is duplicated, a capture rendering artefact) | 1440x900 |
| E2 | reference/endfield-wiki-roster.png | roster page (干员图鉴): breadcrumb, meta line, two navigation tiers, facet filter table | 1043x920 |
| E3 | reference/endfield-wiki-roster-grid.png | roster scrolled: sticky section bar, last facet row, dense tile grid with corner attribute chips | 1043x920 |
| E4 | reference/endfield-wiki-blocked.png | the site's security block page (567) returned for the detail page and then for every page | 1043x920 |

Not captured: the detail page. /zmd/莱万汀 returned the site's own security block page, then the roster and home returned it too after repeated loads. The block was not worked around. The requested roster name 干员一览 does not exist (the roster is 干员图鉴). The roster captures are 1043 wide although the viewport was set to 1440x900; no claim is made about wider layouts.

Borrow (structure and patterns only): filter bar with labelled facet rows and a reset chip; roster tile density with corner attribute chips; two-tier navigation with breadcrumb and meta line; sticky section navigation; numbers in labelled cells and chips. Recorded in DESIGN.md "Dense data patterns".

### 12.2 Anthropic code-review blog (owner's favourite page for looking at data)

| Id | Project path | What it shows | Size |
| --- | --- | --- | --- |
| D0 | reference/code-review-top.png | page top | 829x518 |
| D1 | reference/code-review-fig1.png | figure "The life of a change" | 829x518 |
| D2 | reference/code-review-fig2.png | figure 2 | 829x518 |
| D3 | reference/code-review-fig3.png | figure 3, a table | 829x518 |
| D4 | reference/code-review-fig4.png | figure 4 | 829x518 |
| D5 | reference/code-review-fig5.png | paired bar chart "Review that converges" (sticky tree table of contents with progress visible) | 829x518 |
| D6 | reference/code-review-fig6.png | figure 6 | 829x518 |

Borrow (patterns only): figure panel with a one-sentence takeaway caption, paired bars with baseline grey and one subject accent, value labels at bar ends, mono uppercase group labels, tree table of contents with reading progress, metadata block, borderless tables. Recorded in DESIGN.md "Data figure anatomy". The captures were not all re-inspected by me individually: only D5 was viewed; the other observations come from the coordinator's brief.

### Supporting evidence digests (additional)

- reference\code-review-fig1.png sha256 a81855bdbcf115137b9a4de23bc6ac2289ae28fb0ca276960abfebac662efee2
- reference\code-review-fig2.png sha256 4b18ff08304e2cc668e745505822d54dd0b0391dad12cc2f26f367845e624cf5
- reference\code-review-fig3.png sha256 7500aa24cd43bb82e91753de055d0424f95753aa4c293547c18cb9f9cb4081b4
- reference\code-review-fig4.png sha256 16721bee4842994f37a150ad8b8a2c65ccd68dd3633112ad008e5ed61a2c490f
- reference\code-review-fig5.png sha256 17036d06bfd9b2fb6db955345a8e9c613b6b6a5d757235ec47a2e3c142012779
- reference\code-review-fig6.png sha256 cddc26c2d81cfa37a050c777339da26b054d788381fa6807fe93ee6374ce25b6
- reference\code-review-top.png sha256 e4d5b8961cc2761c2040612a42c4b55c230cbdc5958171982e96944a51dd48dd
- reference\endfield-wiki-blocked.png sha256 79c9677ef35a00bb3217f212c58e18b78573c0bf133f440f84774eb74ce80144
- reference\endfield-wiki-home.png sha256 ff5f51b987fde0d28fc237f5de3be8796f4b8f18fc2d7815f9ffad8c53a1e58f
- reference\endfield-wiki-roster-grid.png sha256 fe9d70980bf538e9d7f7eeab933a994ac45faf5b957097155f96d3b6d0eb1b7c
- reference\endfield-wiki-roster.png sha256 5c4fd34a2f9defc2db6e507e8ec30c66164ff07bc0cf7833ac3e08250b9c02af
