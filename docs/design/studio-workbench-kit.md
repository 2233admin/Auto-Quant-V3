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
`components/workbench` (`index.ts`). It adds no colours, fonts or sizes: every
rule in `workbench.css` reads the CSS variables in `design/tokens.css`. It
computes no statistic; values arrive formatted from Core, as everywhere else
in Studio (see [[docs/design/studio-observation-surface]]).

## Components

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
  first disabled reason is shown as one truncated line under the row, with the
  full text as a tooltip. Disabled buttons stay focusable through
  `aria-disabled` and point at the reason with `aria-describedby`.
- `VerdictBar` shows a tone pill (word and glyph, `bad`, `ok` or `warn`) and
  one sentence truncated to one line. "More" shows the whole sentence and the
  `reasons` list. It uses the same tones as `VerdictBand` and `HeroLine`.
- `StatusLine` is one slim line: state glyph, text, a percent bar (or an
  indeterminate bar when `percent` is `null`), elapsed time, an optional
  Cancel and a `details` disclosure for stages or the command.
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
3. Tokens only. A new colour, font or size goes into `design/tokens.css`
   first, never into a component.
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
