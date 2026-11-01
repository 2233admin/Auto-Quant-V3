# Tabs

A tab list with a 3px underline on the selected tab and optional count badges.

The consumer provides tab ids, labels and panels. Selected tab: `text`, weight 600, underline; others `muted`. A badge uses `signal` and appears only for a count that needs attention. The strategy workbench inspector uses Tabs for its multi-tab inspector (params, versions, runs, tuning, notes). Keyboard: arrow keys move, the panel receives focus. Don't use Tabs for a two-way choice: use SegmentedToggle.
