# Studio workbench component kit

The Factor, Run and Portfolio pages each hand-built their own two-column
layout, toolbar, chart card and tabs, so they looked different and every
layout change had to be repeated page by page. The workbench kit is the shared
set of building blocks for a result workbench: two cards at viewport height,
each with a sticky header row of tabs and buttons and its own scroll, one
primary button, a one-line status, a chart that fills its card and a compact
metric grid. It follows the shape of the PandaAI result workbench studied in
[[docs/design/pandaai-frontend-study]].

The kit lives in `studio-app/src/components/workbench/` and is imported from
`components/workbench` (`index.ts`). It reuses colours and fonts from
`design/tokens.css`. Shared controls use token spacing; measured layout geometry
in `floating.css` and the Idea composition may specify pixel dimensions.
Panes and controls use the confirmed 6px radius; floating layers use 8px.
The owner-confirmed [[docs/design/studio-design/DESIGN]] governs hierarchy,
sign roles and figure anatomy. It
computes no statistic; values arrive formatted from Core, as everywhere else
in Studio (see [[docs/design/studio-observation-surface]]).

## Components

- `FloatingShell` gives every app route the same 8px canvas margin and gap,
  rounded sidebar and main surface. The sidebar places brand, a dashed
  New factor action, three recent factors and library navigation in that order; collapse,
  Attention, Settings and Search occupy the bottom block. Navigation rows are
  40px high. At narrower desktop widths the rail contracts to 180px; the
  existing compact and phone navigation remain available. The Idea title
  replaces the ordinary top bar; other pages retain their content and tools.
- `TitleCard` is the measured 56px heading surface: return link, title,
  single-line subtitle and a type badge. It spans both workbench columns.
- `ParamGrid` renders labelled, read-only Study inputs in two columns, with
  22px controls, 4px row gaps, lock icons and full-value tooltips. It never
  changes authority or infers missing parameters.
- `WorkbenchShell` places a `left` and a `right` slot side by side. From 1000px
  up it is exactly the viewport height under the 52px app header, the page does
  not scroll, and each column is its own scroll container. `ratio` is the left
  share in percent (default 40, clamped to 30 to 70). Below 1000px the slots
  stack in normal flow and the page scrolls as usual.
- `PaneCard` is a card with a header and a body. The header holds a `tabs` slot,
  an `actions` slot and a `status` slot and never scrolls away. The body fills
  the remaining height and scrolls on its own. `flush` removes the padding and
  the scroll for bodies that manage both, such as a code editor or a chart.
- `Tabs`, `TabList` and `useHashTab` re-implement the ones in
  `pages/FactorWorkbench.tsx` with the same keyboard behaviour (arrows, Home,
  End, roving tab index) and the same `#tab-<id>` hash handling that keeps the
  job id. `Tabs` has the same props as the old one, so a page can switch by
  changing its import path. `TabList` is the tablist alone, for the `tabs` slot
  of a `PaneCard` header; the page then renders the active panel itself.
- `SegmentedToggle` is a two to four option radio group, for example Group
  return or Rank IC. Arrow keys move and select.
- `ActionRow` has one `primary` button, any number of quiet `secondary` buttons
  and a trailing `chip`. `primary` is a single object, so a second primary does
  not type-check. A button that is `disabled` must carry `disabledReason`; the
  disabled reasons are shown together under the row and wrap without clipping.
  Disabled buttons stay focusable through
  `aria-disabled` and point at the reason with `aria-describedby`.
- `VerdictBar` shows a tone pill (word and glyph, `bad`, `ok` or `warn`) and
  one sentence truncated to one line. "More" shows the whole sentence and the
  `reasons` list. It uses the same tones as `VerdictBand` and `HeroLine`.
- `StatusLine` is one slim line: state glyph, text, a percent bar (or an
  indeterminate bar when `percent` is `null`), elapsed time, an optional
  Cancel and a `details` disclosure for stages or the command. A completed
  line retains its supplied progress bar; completion does not invent stages.
- `ChartCard` has a header (title, an `Info` "?", a `toggle` slot and a
  `legend` slot) and a body that fills the remaining height. Its child is a
  render prop `(size) => ReactNode` with the measured `width` and `height`;
  the width comes from `design/useFitWidth`.
- `MetricGrid` takes `groups` (heading plus `CompactTile` props) and renders
  them with `CompactTileGrid`. Labels wrap to two lines instead of being cut.
  `hiddenNote` is the slot for the note that the test split is hidden.
- `FactChips` is a compact read-only two-column key/value grid. With `locked`
  it shows a lock icon, and `info` adds a "?" that explains why the values
  cannot be edited here, for example parameters locked by the Study.

A separate scroll hook was not needed: plain `overflow: auto` on each column
body gives independent scrolling.

## Rules

1. One primary button per card. Everything else is secondary or quiet.
2. A disabled button always says why, on the line under the row.
3. Colours and font families stay on existing tokens. The type roles are
   page title 20/28 at 600, section 15/22 at 590, body 13/20, small 12/18,
   label 11/16, value 13/20 mono at 500 and focal value 20/28 mono at 600.
   The older headline and title tokens remain reserved, unused on these templates.
4. State is carried by words and glyph shapes, never by colour alone.
5. Every control is reachable and operable from the keyboard, and a scroll
   container that has no focusable child is itself focusable.
6. English copy. Below 1000px the layout stacks; there is no separate mobile
   layout.

## Composing a page

Put a `PaneCard` in each slot of a `WorkbenchShell`:

```tsx
<WorkbenchShell
  left={
    <PaneCard
      label="Candidate"
      tabs={<TabList label="Candidate" tabs={LEFT} active={left} onSelect={setLeft} />}
      actions={<ActionRow primary={{ label: 'Run analysis', onClick: run }} />}
      status={<StatusLine state="running" text="Running stage 3 of 5" percent={60} />}
      flush
    >
      <CodeEditor />
    </PaneCard>
  }
  right={
    <PaneCard label="Results" flush tabs={...}>
      <ChartCard title="Group return" toggle={<SegmentedToggle ... />}>
        {({ width, height }) => <Plot width={width} height={height} />}
      </ChartCard>
    </PaneCard>
  }
/>
```

## Gallery

`/?view=kit` renders every component with sample content inside a live
`WorkbenchShell`. It is not in the sidebar. The code is
`components/workbench/Gallery.tsx`; `App.tsx` mounts it when `view=kit`.

## Added after the design review

- `StatChips`: headline numbers inside the run-selector row, driven from the published summary and the test gate.
- `FactsDialog`: read-only dialog behind a "Parameters" button, for Study-locked facts.
- `VerdictBar` takes an optional `detail` prop: the one-line clause stays on the bar; the full sentence and reasons sit behind "More".
- `MetricGrid` uses three columns from 1280px and two below, pads the last row, and keeps micro-hints inside each tile's "?".
- `WorkbenchShell` caps content at 1800px and accepts an omitted `left` slot for single-pane pages such as Portfolio.

## Motion kit (adapted from animate-ui)

This kit is interim. The owner requires an independent rewrite before open
sourcing; [[docs/design/studio-design/MOTION]] owns that release restriction.
The adaptation history below describes the retained implementation, not
permission to publish it.

`components/motion/` holds the kit's motion: sliding tab, toggle, rail and table-row highlight (`useSlidingHighlight`),
`Collapse` / `AutoHeight` / `AnimatedDetails` for height, `AnimatedValue` for numbers that count on change, `Progress`,
`CopyIcon`, and `startThemeTransition`. The `Motion` tab of `?view=kit` shows each one.

Adaptation rule. The behaviours come from [animate-ui](https://github.com/imskyleen/animate-ui) (MIT + Commons Clause). The
licence lets us use and modify it as part of an application but not redistribute the components in their original form, so:

- read their source for behaviour, then write our own version in plain CSS on our tokens (no Tailwind, Radix or Motion, no new
  dependency), never paste a file;
- start every adapted file with `Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton): <what we kept / what we changed>`;
- keep the entry and permission notice in `THIRD_PARTY_NOTICES.md` at the repo root current;
- every effect honours `prefers-reduced-motion: reduce` (CSS media query, or `prefersReducedMotion()` for script-driven ones),
  adds no colour, font or radius of its own, and leaves semantics, keyboard behaviour and hash behaviour unchanged;
- numbers keep their Core-formatted text: `AnimatedValue` only animates the display between two values of the same shape and
  leaves exactly the published string at rest.

## Confirmed foundation

`FigureCard` adds a muted subtitle, a development marker and a mono figure
label with a one-sentence takeaway to the measured `ChartCard` host. Group
growth, Rank IC and Portfolio growth/drawdown use it. Captions read a published
split summary, never endpoints spanning several splits. `exportAction` requires
a real callback; these figures have no PNG export, so no PNG tag appears.
`ComparisonFigure` uses neutral grey baseline bars, text-colour subject bars
and direct signed labels without axes. Candidate versus previous trial requires
both exact immutable Run summaries; validation versus test additionally requires
the shared audit gate. A missing comparison stays absent.

`foundation.css` applies the type roles across templates. Signed values use
explicit `sign-positive`, `sign-negative` and `sign-neutral` aliases. The default
maps positive to `err`, negative to `ok`, and neutral to `text`. Green-up exchanges
the first two aliases. Only library headlines and verdict-area headline rows opt
in. Labels, counts, HAC statistics, hit rates, comparison bars and ordinary metric
tiles stay neutral. Coloured numbers retain a leading plus or U+2212 minus;
rounded zero is unsigned. Chart series use neutral strokes.

`SignConventionSetting` lives in the plain Settings Display group. Its two
keyboard-operable options update `data-sign-convention` on the document root
and a guarded viewer-local browser preference. Denied storage leaves the
in-memory choice usable. A read-only server disables the control and shows the
catalogue reason. The preference changes no payload, export or numerical text.

`stateCopy.ts` owns fixed state wording. The hidden-split sentence is presentation
copy: freezing alone never grants access to test numbers. The existing audit plus
visible-diagnostic gate remains authoritative. Disabled `ActionRow` reasons are
always visible; the retained legacy `showReason` prop cannot hide them.
`?view=kit&catalogue=states` displays labelled component examples.

Libraries retain the measured tile dimensions and add counted facets and reset.
The Run evidence template is a reading column with sticky tree navigation,
reading progress and Study / Run / Dataset / Window metadata. Tables use headings
and spacing rather than cell borders. Settings uses plain groups instead of
two nested panes.

The native Edge investigation on 2026-11-01 reported reduced motion false.
The shared kit ran tab and collapse transitions at 260ms, copy opacity at 180ms
and scale at 220ms, theme transitions at 300ms and number updates for about 520ms.
Animated data-table disclosure uses the interim 220ms adapter. Earlier local
screenshot scripts explicitly requested reduced motion. The predicate did not
misread the native preference. The interim implementation remains unchanged;
the caller's selected-tab background was made transparent so it cannot cover
the existing indicator.
