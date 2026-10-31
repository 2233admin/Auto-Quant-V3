# PandaAI QUBE frontend design study

Status: research note, 2026-11-01. Read-only study of the live PandaAI QUBE web
app (the `agent_quant` section) with the owner's authorisation. No code was
copied, no asset was copied, and no write action was taken in the app. Nothing
here is implemented by this document.

Related: [[docs/design/pandaai-reference-notes]],
[[docs/design/panda-display-gap-matrix]],
[[docs/design/shinka-frontend-parity]],
[[docs/design/studio-observation-surface]],
[[docs/design/factor-evidence-explorer]].

The owner likes the current Studio look (tokens, colours, fonts). This study
therefore recommends layout and density changes only. Every PandaAI colour or
font below is recorded as a measurement to explain a layout effect, not as a
palette to adopt.

## Method and caveats

- Tool: Browser Bridge (`bbx`), one private tab, read-only calls only:
  navigation, scrolling, opening a run selector, switching result tabs,
  reading computed styles and geometry through `bbx eval`, and screenshots.
  The page stored data was viewed; no analysis, backtest, tuning run, save,
  create, delete, publish or message was started.
- Viewport: every number is measured at 1440x900 (the tab was resized before
  each read, because a screenshot resets the emulated size). Dark theme as
  served. Screenshots of each page are in `D:/tmp/panda/study/`.
- "Measured" means read from computed style or bounding boxes. "Read from
  screenshot" means estimated from pixels and is marked with a tilde.
- Our own screenshots in `D:/tmp/orca-shots` were captured at a reduced scale
  (about 0.58 to 0.64 of 1440 wide), so our numbers are CSS values from
  `studio-app/src` where one exists, otherwise screenshot estimates divided by
  that scale and marked with a tilde.
- The PandaAI account holds one stock strategy (one stored backtest of 8
  stages and one 58-combination tuning run), two stock factors, no
  simulated-trading accounts, and four chat conversations. That is the data
  every first screen below shows.
- Colour convention: PandaAI uses the China A-share convention, red for up and
  green for down. Our Studio does not use red/green for returns; this is a
  semantic difference, not a layout one, and is out of scope here.

## 1. Page by page

Common shell (every page except the chat and market variants), measured:

- Floating sidebar card: x 8, y 8, 240 wide, 884 tall (viewport minus 16),
  radius 21.6, border 1px white at 10 percent, fill one step lighter than the
  page. Page background and sidebar are separate layers with an 8px gutter.
- Main column: starts at x 256, 1176 wide, y 8 to 892. List pages have a
  floating header card 56 tall (radius 21.6, padding 0 16) and content from
  y 72 (8px gap). Detail pages put the two panes at y 72 to 892.
- The page itself never scrolls (document height equals viewport, 900).
  Scrolling happens inside panes (measured scroll containers on every page).
- No content max-width: panes fill the column. On a 1920 window the strategy
  detail simply widens its metric grid from 2 to 6 columns.

### 1.1 Strategy library, `/agent_quant/strategies`

First-screen inventory: sidebar with nav (6 entries at 40px pitch) and a
"new session" dashed button plus 4 recent chats; header card with icon, title
"Strategy library" and a one-line description; toolbar row with 3 primary
create buttons, a segmented filter with counts (all / stock / futures / ETF),
a search field, a sort select and a direction toggle; then the card grid
(1 card here) and an end-of-list caption "all loaded".

```
 8                     256                                               1432
 +--------------+      +---------------------------------------------------+ y8
 | QUBE brand   |      | [icon] Strategy library  one-line description     | h56
 | -----------  |      +---------------------------------------------------+ y64
 | Chat bench   |      [+Stock][+Futures][+ETF] (seg: All 1|Stock|Fut|ETF)   y72 h32
 | [+ new chat] |      [ search 280 ............ ][sort 152][v 32]
 |  4 recents   |      +--------387-------+ +--387--+ +--387--+              y112
 | Strategies * |      | title 14/600  tag |                  card h137-188
 | Factors      |      | desc 12 x2 lines  |      3 columns, gap 8
 | Run history  |      | +22.4% 1.41 336 ~~sparkline~~   |
 | Tuning       |      | code icon   last updated time   |
 | Simulation   |      +-------------------+
 | Market       |            "all loaded"  (12px muted, centred)
 | ...footer    |
 +--240x884-----+
```

Measured: toolbar buttons 32 tall, radius 21.6, label 12.8/500; segmented
control 283x32 with 2px padding, items 69x26; search 280x30 inside a 32 tall
pill; card 387 wide, padding 16, internal gap 12, radius 21.6, border white
10 percent; card title 14/600, description 12, metric line 11 (return coloured
by sign, Sharpe, trade count) with a 150x30 area sparkline right aligned, a
hairline, then a footer with a code icon and the last-updated time at 11.
Card gap is 8 both ways. Content starts at y 112, which is 12 percent of the
viewport height.

Empty state: none shown (data exists); end-of-list caption "all loaded".

### 1.2 Factor library, `/agent_quant/factors`

Identical frame to 1.1 with 2 create buttons (stock, futures), a 3-way
segmented filter and a full-width search (680 wide) because there is no sort
control. Two cards, 387x137, 3 columns, gap 8. The card metric line reads
"latest factor return, Sharpe, annualised" in 11px with a small sparkline
(green when negative, red when positive in their convention) and a
"stock . formula" tag top right. The factor card is 51px shorter than the
strategy card because it has no two-line description.

### 1.3 Factor detail, `/agent_quant/factors/<id>` (stored analysis history)

First-screen inventory, left pane: back arrow and editable name, editable
description line, tag "stock" at the far right of the header; params card with
tab pair (Parameters, Versions), Save (grey, secondary) and Run analysis
(primary light pill), a 2-column parameter grid of 6 labelled controls with
help icons (period start and end, rebalance period, group count, direction,
universe), a Formula/Python toggle with a "validated" badge and the formula in
a rounded code box. Right pane: run selector, action row, stage progress row,
then the first result card (cumulative group returns chart) and the top of the
core-metrics card.

```
 256                439 (38%)           711                 721 (62%)             1432
 +-----------------+ y72             +--------------------------------------+ y72
 | [Params][Vers]  [Save][Run]      | [v] 2026/10/31 23:27:42            v | h28 y94
 | 6 controls, 2 cols (24px rows)   | [This run's params][AI opt][Save as   | h28 y127
 | [Formula|Python]  validated      |  version][Build strategy][Export PDF] |
 | +---------------------------+    | (ok) Done . 9 stages . 7 s ====100% v | y196
 | | LOG(CLOSE/DELAY(...      |    | +----------------------------------+ y239
 | |  rounded code box        |    | | Group cumulative returns   h2 14/500
 | +---------------------------+    | | legend row (7 dots, 12px)        |
 |   (rest of pane is empty)        | | canvas 645x360                   |
 |                                  | +----------------------------------+ y665
 |                                  | | Core metrics (3 col x N rows)    |
 |                                  | |  tile 211x34  label L  value R   |
 +-----------------+ y892           +--------------------------------------+ y892
```

Header: 56 tall at the left, title 18/600 with a pencil icon, description 11
muted under it. Panes are cards (radius 21.6, padding 12, gap 12).

Result pane scroll: the pane scrolls internally (scroll height about 4700 for
652 visible), and the run selector, action row and stage row stay at the top
of the pane in the measured screenshots while cards scroll under them.

Result cards in order: group cumulative returns (canvas 645x360 with a legend
row of 7 swatches), core metrics (3 columns), latest factor values (table,
5 rows with paging "20 total, 1 2 3 4 >", columns time, code, name, value),
group returns table (10 columns, 7 rows, scrolls horizontally inside the card
at 760 inside 645), IC decay (canvas 645x280, title 12/500 muted), IC
autocorrelation (line chart with confidence band and dotted legend), Rank IC
decay. Each card is separated by 12px.

Run selector opened: a full-width combobox 669x28 (value shows timestamp and a
green check), the list opens inline over the pane, each option 32 tall, 12px,
a check icon on every succeeded run, selected option inverted (light fill,
dark text). Three stored runs listed, newest first, timestamps only.

Versions tab (left pane): empty state is a single centred 14px muted sentence
("no versions yet") with no icon and no button.

### 1.4 Strategy detail, `/agent_quant/strategies/<id>`

Same two-pane frame as 1.3 but the split is 560 left, 600 right (the factor
page is 439 / 721); the split is page specific, not a draggable divider that
was observed. Left: params card (date range, initial capital, benchmark index,
slippage, fee multiplier, frequency in 3 rows of controls), then a code editor
card 534x672 with title "Strategy code", a "validated" badge top right, line
numbers, syntax colouring, 13px mono, 18px line pitch. Loading state: a
spinner with "loading" centred in the editor card until the code arrives.

Right pane tabs (segmented, 3): Backtest history, Tuning history, AI repair.

```
 256                560                832                   600            1432
 +-----------------+ y72            +----------------------------------+ y72
 | [Params][Vers] [Save][Run backtest] | [BT hist|Tuning hist|AI repair]  y85
 | time  from -> to  capital       | [v] 2026/10/31 23:33:57 +22.42%  Sharpe 1.41  ann 50.87%
 | benchmark  slippage  fee        | [Params][Rerun][AI opt][Save ver] y173 h28
 | freq                            | [Export PDF]   (wraps at 1440)    y209
 | +--- Strategy code ---valid-+   | (ok) Done . 8 stages . 12 s ==100% v y277
 | | 1  import panda_data    |   | metric tiles 2 cols x 5 rows (tile ~277x34, pitch 40)
 | | ...  18px pitch, 13px   |   | +--------------------------------+
 | | mono, gutter numbers    |   | | Net value curve  h2           |
 | +-------------------------+   | | canvas 524x280, dual axis      |
 |                               | |  left: value, right: percent    |
 +-----------------+ y892         | +--------------------------------+
                                  | Holdings table, trade log (paged)
                                  +----------------------------------+
```

Run selector is richer here: one row holds timestamp, total return, Sharpe
and annualised return inline (coloured), so a run is judged without opening
it. Action row has 5 buttons 28 tall (12/500): outline for repeatable
actions, light primary for "Save as version", and AI optimise carries a
sparkle icon.

Metric tiles: measured 4 columns at 1920, 2 columns at 1440 (grid reflows
with the pane width, tile height stays 34). Net value chart: card 550x345,
canvas 524x280, buy/sell markers as small triangles and diamonds, dual y axis
(absolute and percent). Below: "Holdings and returns" card with its own search
and paging, and a "Strategy log" card (INFO lines in mono 11/12px, paged,
"438 total, 1 2 ... 44").

Tuning history tab: run selector row with a "Re-launch" button to its right,
a "Concurrent tuning complete" progress card (title 12/600, caption 10,
percentage right, a 6px bar), then a multi-line chart "Net value per
combination" (canvas 804x280, 58 faint lines, best highlighted), then a
parameter-combination table: 7 columns, header 33, row 37, 12/500, sortable
by total return (arrow), rows paged only by scroll, 58 rows with a check icon
per row.

AI repair tab (read only view): a title, two lines of explanation, a card
reading "No quality-gate errors detected", and a grey disabled action button.

### 1.5 Run history, `/agent_quant/backtests`

Master-detail. Header (56) holds title, then the selected strategy name and
run count inline ("1 run"). Left list pane 288 wide (padding 8): a segmented
All / Strategy / Factor (32), search (26), second segmented All / Stock /
Futures, a section label "Strategy list, 1 total", then selection cards
(270x100, padding 16, inverted fill when selected) with name, a type tag, run
count and last time. Right pane 876 wide: a grid table with sortable
headers (total return, Sharpe, max drawdown, trades, status, curve, +more).

Measured grid: header row 33 tall (padding 8, 12px muted), body rows 59 tall
(padding 12 8, two lines in the first column: label plus date range), numeric
cells centred, status as an outlined green pill, curve as an 80x30
sparkline. Table is 1330 wide inside an 864 wide card, so the right columns
sit under a horizontal scrollbar; this is a defect to avoid, not copy.

### 1.6 Tuning tasks, `/agent_quant/optimizations`

Same master-detail frame; list is 288 wide, with the strategy selection card
(270x100) and a stock/futures segmented filter. Right pane (876, padding 12):
run selector row 28 tall plus "Re-launch" button; progress card 830x94
(percentage right, expand chevron, 6px bar); chart card 830x342 with the
multi-line chart (canvas 804x280, titled "Net value per combination" with a
caption "normalised to 1, 58 of 58 done"); parameter table below the fold
starting y 593 with header 33 and 37px rows, and a per-row secondary button
"Apply these params" in the last column. First screen therefore holds the
selector, the progress, the full chart and the first 5 table rows.

### 1.7 Simulated trading, `/agent_quant/trading`

Header 56 with title, a caption "sorted by latest update" and a primary
"New" pill right aligned (the only primary action on the page sits at the
header's right edge). Two panes: list 288 (caption "0 accounts", muted hint
"click New to create the first account") and a detail pane 880 wide with a
single centred 14px sentence "pick an account on the left or click New".
Pure empty state: no illustration, no button inside the pane, the action is
named in the text and stays in the header.

### 1.8 Market, `/agent_quant/market`

No header card: the page is three columns inside the 1440 viewport, sidebar
240, instrument list 288 (x 256, full height 884), chart workspace 880 wide.

```
 +--240--+ +-----288------+ +---------------880-----------------------+
 | rail  | | Market  5,223| | +--255x98-----+ +---571x98------------+ |
 |       | | [Stock|Fut]  | | | Name 30/700  | | open  prev close    | |
 |       | | [Equity|ETF] | | | price 30/700 | | high  avg price     | |
 |       | | search 32    | | | code, change | | low   amplitude     | |
 |       | | rows 36 tall | | +--------------+ +---------------------+ |
 |       | |  name | code | | [Time|1m|5m|15m|60m|D|W|M] [Main (1)][Sub (2)]
 |       | |  ...         | | +--chart 1037x529 (OHLC readout inside)--+ |
 |       | |              | | | crosshair label, average line, area    | |
 |       | |              | | +--volume 1037x160 (MA5/10/20 legend)----+ |
 +-------+ +--------------+ +------------------------------------------+
```

Measured: instrument rows 36 tall, name 14 left, code 12 muted right, selected
row inverted fill; segmented controls 28 tall; quote block name 30/700 and
price 30/700 in the sign colour, two bordered stat cards (fill one step darker
than the pane, radius 21.6, border white 7 percent) of 98 tall; period
toggles 28 tall as a pill row, then two ghost buttons for main and sub
indicators that carry a count badge; main chart canvas 1037x529, volume
canvas 1037x160 beneath it (22 percent of chart height) sharing the x axis;
OHLC and moving-average readouts are drawn inside the chart top-left, the
crosshair shows an axis label. The chart area is 690 of 884 px, which is 78
percent of the page height.

### 1.9 Chat workbench, `/agent_quant/chat` and `/agent_quant/chat/<id>`

Home: a centred column (content x 300 to 1396) with a 20/600 greeting and a
one-line caption, then three groups (futures, stock, ETF strategies) each with
a 14/600 title, a 12 caption and a 3-column card grid: card 357x116, padding
12, gap 12 both ways, a 32px icon chip top left, a market tag chip top right,
title 15/600, one line of description 12 muted. The composer is pinned to the
bottom with a quick-prompt chip "Strategy rewrite" above it. Cards fade out
at the bottom edge above the composer.

Conversation view (split workspace):

```
 256       420 (chat)        684            748 (result workspace)         1432
 +--------------------+ +--------------------------------------------------+
 | [Strategy x][Factor x] chips (artifacts)   | title, editable, desc, tag  | y8 h48/56
 +--------------------+ +--------------------------------------------------+
 |  user bubble (right, rounded 21.6,       ||[Params|Versions|Backtest|Tuning|AI repair]
 |   padding 16, 14px)                       || full width 5-way segmented, y85
 |  "done . 33 s"  12 muted                  || [v] run selector + metrics inline
 |  assistant text 15px, 28px line pitch     || action row (5 buttons)
 |  "ran thinking and 1 action  >" 12 muted  || stage progress row
 |   (fold line, 28 tall, expandable)        || metric tiles 2 col x 5
 |                                  [<] 28px || net value chart 672x280
 |  [Strategy rewrite] chip 82x32            || ...scrolls
 |  +-composer 416x97, radius 21.6--------+ ||
 |  | textarea 14/20                      | ||
 |  | [model v][effort v][mode v]    (o)  | ||
 |  +-------------------------------------+ ||
 +--------------------+ +--------------------------------------------------+
```

Measured: chat pane 420 wide with its own header card of 48 tall that
carries one chip per attached artifact (178x26 and 90x26, with a close icon);
the result pane header is 56 tall and repeats the object name. The split
toggle is a 28x28 round button on the seam (x 666, y 436). Message list
scrolls independently (scroll height 3800); the result pane scrolls
independently (1889). Assistant text is 15px with a 28px line pitch;
tool activity is folded to one 12px muted line (28 tall) with a chevron,
copy / like / dislike icon buttons 24x24 below the last message. The
composer is a 416x97 rounded container (fill white 4.5 percent, border white
15 percent) holding a 14/20 textarea and a 32 tall control row (model select
208 wide, effort select, mode select, circular send button 28).

Empty or loading: a conversation with no result shows the right pane empty;
no other state was observed.

## 2. Shared patterns, measured

Colour tokens actually used (dark), written as OKLCH or computed values:

| Role | Value | Where |
| --- | --- | --- |
| Page ground | oklch(0.145 0) | main background |
| Card / sidebar / header | oklch(0.205 0) | all cards and panes |
| Control fill | white at 4.5 percent | inputs, outline buttons, chips |
| Selected / segmented fill | oklch(0.269 0) | tab pair background |
| Border (container) | white at 10 percent | cards |
| Border (control) | white at 15 percent | inputs, outline buttons |
| Text levels | 0.985, 0.8, 0.7, 0.6 alpha steps, and muted 0.708 | headings, labels, captions |
| Primary button | fill oklch(0.922), text oklch(0.205) | Run, Save as version, New |
| Selected list item | same light fill as primary | nav, instrument and strategy rows |
| Positive return | rgb(224,106,130) | up |
| Negative return | rgb(91,208,160) | down |
| Progress fill | oklch(0.696 0.17 162) | stage bar and success checks |
| Code | text rgb(197,200,206), numbers rgb(86,90,99), keyword accents gold and orchid | editor |

Fonts: one sans (Geist Variable) for all UI, one system mono for numbers,
tables and code. Sizes by role: page title 18/600, card title 14/600 (list
cards) or 14/500 (section h2 inside result cards), small section title 12/500
muted, table header 10 (factor tables) or 12 (tuning tables), table cell 12
(sans or mono), metric label 10, metric value 14/500 mono, caption 10 to 11,
button 12/500 (12.8 for toolbar creates), body 14, chat message 15/28, market
quote 30/700, chat greeting 20/600.

Radius scale: containers and pills 21.6, metric tiles 16.8, list options 7.2,
small icon buttons 4, help icons full round. Every control is a pill.

### Shell

Floating sidebar 240 (margin 8, radius 21.6), nav items 36 tall on a 40 pitch,
14px, selected item is an inverted light pill; a dashed "new chat" button 28
tall with 4 recent chats at 12px; footer block with collapse (36), notifications
with a count badge, credit balance, settings, user (each 36 tall). Header card
56 tall (list pages) with icon, title and description on one line. Detail
header is two lines (title with pencil, description) inside the same 56.

### Cards and panes

Padding 12 for panes and result cards, 16 for list cards; gap 12 inside a
pane, 8 between sibling cards and panes; no shadows (shadow value is empty);
radius 21.6; one border weight. Cards are always flat, one level deep: a pane
holds cards, a card never holds another card except metric tiles and stat
blocks.

### Metric tiles

Inline tile: 211x34 (3 columns in a 645 pane), radius 16.8, border white 10
percent, padding 6 10, label 10 muted at left with a help icon (14x14 button),
value 14/500 mono right aligned and sign coloured. Row pitch 40 (gap 6).
Twelve metrics occupy 4 rows, about 160px. In a 1920 window the same grid
shows 4 to 6 columns. In the market quote header the equivalent block is
label left, value right in a 571x98 card, 3 rows.

### Chart frame

Card with 12 padding, title row (14/500 left), optional caption (10 to 11
muted), legend row inside the card above the plot (7 coloured dots with 12px
labels, clickable to toggle), then a canvas that spans the card width. Heights
measured: 360 (hero chart), 280 (secondary charts, tuning chart, net value),
529 plus 160 (market). Axis labels 10 to 11px, grid lines faint, y axis on the
left, an optional second axis on the right (percent). The canvas width is not
capped; it follows the pane (645, 672, 804, 1037). No range toggles on result
charts; range and indicator toggles only on the market chart. Tooltips and
crosshair are canvas drawn.

### Tables

Result tables: header 26 (factor) or 33 (strategy), body row 29 (factor) or 37
(strategy), body 12, header 10 or 12 muted regular weight, no zebra, hairline
at 2 to 10 percent white between rows, numeric columns centred (not right
aligned), in-card horizontal scroll. Paging sits in the card header
("20 total, 1 2 3 4 >") with a small search field beside it where relevant.
Row actions are small outline buttons in the last column.

### Tab strip

Pill segmented control: 2px padding inside a 1px bordered pill; items 24 to 26
tall, 12/500; active item is the light fill with dark text, inactive items at
60 percent. Two forms: compact pair at the left of a pane (Params, Versions)
and full-width 5-way segmented control at the top of a pane (chat workspace).

### Dialogs and overlays

The select popup is the only overlay opened in this study: padding 4, options
32 tall radius 7.2, 12px, selected option inverted, check icons per item,
opens directly under the trigger at the trigger width. Confirmation dialogs
were not opened (they sit behind write actions).

### Progress

A stage row at the top of the result pane: a 28px green ring with a check,
"Analysis done . 9 stages complete . 7 s", a 6px full-radius bar (track
oklch 0.269, fill emerald) that is about 260 wide, the percentage in 10px
mono and an expand chevron that reveals the stage list. Tuning uses the same
bar full width inside a titled card with a 10px caption "state comes from each
independent backtest task, 58/58 reached a final state".

### Empty and loading

- List: one centred 12px muted line, with the next action named in the text
  and the action itself in the header (trading).
- Pane: one centred 14px muted sentence, no icon, no button.
- Versions: one centred 14px muted sentence.
- Loading: spinner plus the word "loading" centred inside the card that will
  hold the content, the card keeps its final size so nothing shifts.
- End of list: "all loaded" caption, 12px, centred.

## 3. Interaction patterns worth copying

1. Run selector as the first control of the result pane: one full-width
   select showing the timestamp, a status check and, in the strategy case, the
   three headline numbers inline. Switching it swaps the whole result pane.
   Our equivalent is a list at the bottom of a left column.
2. Sticky result header: selector, action row and stage progress stay in view
   while the cards below scroll, so "which run, what can I do, did it finish"
   is always visible.
3. Independent pane scroll with a non-scrolling page: parameters and code stay
   on screen while the long result column scrolls.
4. Action row grouped by weight: outline buttons for repeatable verbs, one
   light primary for the committing verb ("Save as version"), a download at the
   end. Primary sits in the pane header (Run) or the page header (New), never
   inside a card.
5. Stage progress as a single line with an expandable detail, not a separate
   block.
6. Split chat and result workspace: artifact chips in the chat header choose
   what the right pane shows, a seam toggle collapses the chat, the right
   pane keeps its own tabs.
7. Folded tool activity in chat: one muted line "ran thinking, 2 actions"
   with a chevron instead of a transcript of tool calls.
8. Master-detail for libraries: 288 list with search and segmented filters,
   detail on the right, selected row inverted.
9. Card grid with a built-in verdict line: each library card shows the latest
   result (return, Sharpe, trades) with a sparkline, so the list answers "which
   one is good" before opening.
10. Inline metric tiles with help icons: label and value on one line, 34 tall.
11. Row-level secondary action in tables (apply these parameters).
12. Count badges on segmented filters and on ghost buttons (indicator count).

## 4. Side-by-side with our Studio

Our numbers are CSS from `studio-app/src` unless marked with a tilde. Our
reference screens: `fx-final-dark.png` (Factor evidence), `new-pf.png`
(Portfolio), `new-project.png` (Project), `new-projects.png` (Projects),
plus `new-runs.png` and `new-fl.png` for the library tables.

| Aspect | PandaAI (measured) | Ours | Gap |
| --- | --- | --- | --- |
| Rail | 240 floating card, items 36 on 40 pitch | 232 flat, items 32, padding 12x10 | rail is fine; ours is already denser |
| Top bar / header | 56 card with icon, title 18/600, description inline | 52 top bar (breadcrumb and theme) plus page head h1 28/40 and lede below (~100 to 140 tall) | ours spends about 90px more on the head |
| Content start (y) | 72 to 112 | ~160 (Portfolio), ~125 (Projects, 28 padding plus 40 h1 plus lede) | first content about 50 to 90px lower |
| Content width | no max, fills 1176 | max 1360 gutters 28 (1152 at 1440 viewport, so fills), but charts capped | charts do not fill |
| Page scroll | page fixed, panes scroll | page scrolls, side column sticky | context and results scroll together |
| Section spacing | 12 between cards | 32 between sections, 24 between blocks, 12 under headings | 2.7x looser |
| Card style | radius 21.6, padding 12, no square panels | square panels, hairline, controls radius 6 | style differs by owner choice; keep |
| Hero chart | 645x360 (factor), 672x280, 804x280, 1037x529 | Factor 760 wide viewBox, 320 high, `.chart` max 860; Portfolio 980 wide, `.pf-chart` max 1000; Project trajectory ~680x210 (~) | ours is 15 to 30 percent narrower on a 1152 column and Project chart is about 40 percent shorter |
| Chart share of first screen | 30 to 78 percent of pane height | Portfolio chart ~360 of 900 (40 percent), Factor evidence ~330 (37 percent), Project ~210 (23 percent) | Project and Factor evidence charts are small, and the verdict band takes about 180 above the chart |
| Metric tiles | 211x34, 10px label left, 14/500 value right, 6 gap, 12 tiles in 160px | `.pf-tile` min 190 wide, padding 12 16, 22px mono value on a 30 line, label above, sub caption (~85 to 90 tall), 4 to 6 per row; Factor evidence tiles ~75 tall, 2 rows | tiles are about 2.5x the height; 12 metrics take 3 rows of 85 (~260px) vs 160 |
| Tables | row 29 to 37, header 26 to 33, centred numbers, in-card scroll, paged in header | `.tbl` row 7+20+7 = 34, header 11 mono caps 16 plus padding (~30), run history rows ~48 (~) | density is comparable for plain tables, run history rows are 30 to 60 percent taller |
| Filters | one 32 tall toolbar row: segmented with counts, search, sort | label-above form fields, each ~60 tall (Search, Lane, Status, Project, From, To) | ours uses 2x the height and has no counts |
| Control placement | Save and Run at the pane header right, actions row under run selector, create buttons in header or toolbar | Run analysis in the left column under the title, the actions-off note under it, run list at the bottom (~y 730 on 900) | primary action is not near the result it produces |
| Run selection | full-width select at the top of the result pane with inline numbers | list of run cards at the bottom of the context column plus a Run select in the page top on some pages | selector is 400px lower |
| Verdict / status | green or red inline in run row, stage line | full-width verdict band 180 tall with 4 bullets (Factor evidence), 30 tall on Portfolio | informative, but pushes the chart; needs a collapsed form |
| Tab strip | segmented control at the top of the pane | text tab list below the first chart (y ~868 on Portfolio, ~560 on Project) | tabs are at or below the fold |
| Empty states | one centred sentence | `.empty p` block and Notice component | similar; no spinner pattern |
| Progress | one line with 6px bar | StagePipeline block / JobPanel | larger, separate block |
| First screen inventory | selector, actions, progress, hero chart, first metrics (factor); selector, 4 actions, 10 metrics, chart (strategy) | Portfolio: head, verdict, chart, 6 tiles, tab strip; Project: head, banner, chart, 6 tiles, "Next move" | Portfolio is near parity; Project and Factor evidence trail |

Notes on what we do better and should keep: our evidence-first verdict band,
the explicit data table under every chart, the sticky section nav idea, and
dense mono numerals are all stronger than PandaAI for honesty. The gaps are
in space allocation, not in content.

## 5. Fifteen layout changes, prioritised

Priority order is by expected effect on the first screen per unit of effort.
Files are under `studio-app/src` and are the likely touch points, not a
design for the code itself.

1. **Let charts fill their column and give them a height budget.** Remove the
   860 and 1000 caps and render SVG at the container width with heights
   280 (secondary) to 360 (hero). Files: `pages/factor.css` (`.chart`),
   `pages/portfolio/portfolio.css` (`.pf-chart`), `pages/lanes/lanes.css`,
   `pages/project/project.css` (`.pj-fig`), `pages/FactorCharts.tsx` (W = 760),
   `pages/portfolio/PortfolioChart.tsx` (W = 980). Effect: hero chart goes from
   about 733 to about 1150 wide on a 1440 screen (+57 percent area) with no
   new data. Effort M (viewBox to responsive width, label scaling).
2. **Add a compact metric tile variant.** Label left, value right, 34 to 40
   tall, 3 to 4 columns, value 14/500 mono, help icon at the label. Keep the
   22px tile for the 4 headline numbers only. Files:
   `components/MetricTile.tsx`, `components/HeadlineMetrics.tsx`,
   `components/components.css`, `pages/portfolio/portfolio.css`
   (`.pf-tile`), `pages/FactorEvidence.tsx`. Effect: 12 metrics fit in about
   160px instead of about 260px, and more of them reach the first screen.
   Effort M.
3. **Move the run selector to the top of the result column.** One full-width
   select with timestamp, status glyph and the primary number, replacing the
   run list at the bottom of the side column. Files: `pages/run/RunSelect.tsx`,
   `pages/FactorWorkbench.tsx`, `pages/workbench.css` (`.runlinks`). Effect:
   selector moves from about y 730 to about y 100, switching runs no longer
   needs scrolling the side column. Effort S to M.
4. **Put the primary action next to the result, in a sticky action row.**
   Run analysis, export and AI-style actions go in a row directly under the
   run selector (28 tall, outline buttons plus one primary); fold the
   "actions are off" note into a disabled tooltip and a one-line hint. Files:
   `actions/RunAnalysisButton.tsx`, `actions/actions.css`,
   `pages/workbench.css` (`.wb-side .runbtn`). Effect: primary action and its
   output are on the same eye line; the left column loses about 90px.
   Effort M.
5. **Make the result header sticky and collapse stage progress to one line.**
   Selector, action row and a 6px progress line with percent stay at the top
   of the scrolling result area. Files: `actions/StagePipeline.tsx`,
   `actions/JobPanel.tsx`, `actions/actions.css`, `pages/workbench.css`.
   Effect: status never scrolls away; the pipeline block shrinks from a
   block to about 36px. Effort M.
6. **Shrink the page head.** On Projects, Project and library pages use a
   20/28 title with the lede on the same line (muted 12 to 13), and fold the
   top bar breadcrumb into it. Files: `design/layout.css`, `pages/pages.css`
   (`.pg-head`, `.pg` padding 28), `shell/TopBar.tsx`. Effect: first content
   starts about 70 to 90px higher (about 8 to 10 percent of the viewport).
   Effort S.
7. **Tighten the vertical rhythm inside workbench pages.** Section gap
   `--space-8` (32) becomes 16, block gap 24 becomes 12, heading rule stays.
   Scope it to `.wb-main` and Project so long reference pages can keep their
   air. Files: `pages/pages.css`, `design/layout.css`, `pages/workbench.css`.
   Effect: roughly 16 px saved per section boundary, about 150px over a
   Project page. Effort S.
8. **Fix the Factor evidence verdict band.** Keep the 30px headline verdict;
   put the three reasons behind a disclosure (default closed on first view,
   open when the verdict is Fail and the user has not seen it). Files:
   `components/VerdictBand.tsx`, `pages/FactorEvidence.tsx`. Effect: about 110
   to 150px returned to the chart; hero chart reaches y ~330 instead of ~490.
   Effort S.
9. **Replace the label-above filter form with one toolbar row.** Segmented
   filter with counts, a search field and one or two selects, 32 tall, on a
   single line, date range behind a "more" button. Files:
   `library/library.css` (`.lib-field`, `.lib-counters`),
   `library/Library.tsx`, `library/parts.tsx`, `library/RunHistory.tsx`,
   `library/FactorLibrary.tsx`. Effect: filter area from about 90 to 32
   tall, 1 to 2 more table rows visible. Effort M.
10. **Bring the section tabs to the top of the page.** Make the Portfolio and
    Project tab strip (Verdict and metrics, Viability and cost, and so on) a
    sticky segmented bar under the head instead of text links below the
    chart. Files: `pages/portfolio/Portfolio.tsx`, `pages/project/Project.tsx`,
    `design/layout.css` (`.secnav`, already sticky at top 52). Effect: tabs
    visible on the first screen (from y ~868 and ~560 to about y 110);
    navigation is discoverable. Effort S to M.
11. **Collapsible side column.** Add a 28px seam toggle on the workbench
    context column (264 plus 24 gap) so the chart can use the full column
    when the context is already known. Persist per user in local storage.
    Files: `pages/workbench.css` (`.wb`), `pages/FactorWorkbench.tsx`,
    `pages/Factor.tsx`. Effect: +288px of width for charts and tables at
    1440 (hero chart reaches about 1150 to 1440). Effort S to M.
12. **Make workbench panes scroll independently.** On Factor and Run pages
    the page does not scroll: context column and result column each scroll
    inside a card whose height is viewport minus top bar. Files:
    `pages/workbench.css` (`.wb`, `.wb-side` currently sticky with
    `max-height: calc(100vh - 72px)`), `shell/shell.css` (`.main`). Effect:
    the sticky header from item 5 becomes possible and the context never
    scrolls out. Effort M (risk: print and mobile fallbacks).
13. **Convert library pages and Projects to a card grid with a verdict line.**
    3 columns (minmax about 360), gap 8 to 12, each card title, state tag,
    primary number with a sparkline and 3 key figures, so the list answers
    "which is good". Files: `components/ProjectCard.tsx`,
    `components/components.css` (`.pc-*`), `pages/Projects.tsx`,
    `library/StrategyLibrary.tsx`, `library/FactorLibrary.tsx`. Effect: the
    Projects screen, now about 55 percent empty beside one 385 wide card,
    scales to a grid; library rows get a visual answer. Effort M.
14. **One chart frame component.** Title row, caption, legend row with
    clickable dots, optional range toggle, optional data-table disclosure, a
    fixed height token (280, 360) and the same padding everywhere. Files:
    new shared component beside `components/`, then adopt in
    `pages/FactorCharts.tsx`, `pages/portfolio/PortfolioChart.tsx`,
    `pages/lanes/LaneChart.tsx`, `pages/allocation/AllocationChart.tsx`.
    Effect: consistent control placement around charts and one place to
    set sizes. Effort L.
15. **Standardise empty, loading and end-of-list states.** One centred muted
    sentence for empty (names the action), a card-sized spinner for loading
    that keeps the final height, and an "all loaded" caption. Files:
    `Notice.tsx`, `components/NotPublished.tsx`, `pages/factor.css`
    (`.empty`), `library/DataTable.tsx`. Effect: no layout shift while data
    loads, fewer bespoke empty blocks. Effort S.

Sequencing note: items 1, 2, 6 and 8 are independent and each moves the first
screen on its own. Items 3, 4 and 5 are one change set (the result header).
Items 11 and 12 should land after 5. Item 14 is the structural clean-up that
makes 1 stick.

## 6. What was not opened

- Confirmation dialogs and anything behind write actions: not opened by
  design.
- The strategy "history versions" tab (left pane) was not viewed (the factor
  one was). The AI-repair tab was opened for reading; its action was not
  clicked.
- A second stored run in the selectors: the dropdown was opened and left
  without selecting.
- Draggable pane divider: none was seen, the left/right splits (439/721,
  560/600, 420/748) differ per page; a divider could exist and was not tested
  by dragging.
- Simulated trading accounts: none exist in the account, so only the empty
  state was observed.
- Reading a conversation's tool-call expansion: folded lines were not
  expanded.
- Font sizes of the detail page title and description are read from
  screenshots (about 18/600 and 11), not from computed style.
