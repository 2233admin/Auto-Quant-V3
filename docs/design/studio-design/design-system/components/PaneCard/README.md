# PaneCard

A bordered surface with an optional head row (tabs left, actions right) and a body that scrolls on its own.

The consumer provides the head content and the body. Use for each of the two columns of the factor and strategy workbenches. Surface `raised`, outline `line-strong`, radius `radius-control`, body padding `space-3`, head minimum height `pane-head-height`. States: default; flush body (no padding, for a chart that fills). Don't nest a PaneCard inside a PaneCard: use a ChartCard or a plain hairline group inside.
