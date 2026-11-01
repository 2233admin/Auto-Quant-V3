# MetricGrid

A label-left, value-right grid, three columns from 1280px, two below, the last row closed with empty cells.

The consumer provides label-value pairs. Labels in `label` (muted), values in `value` mono; signed values follow DECIDED option C: only the focal row (the verdict-area numbers, such as the headline stats beside the run selector and the long-short headline numbers) takes `sign-positive` / `sign-negative` / `sign-neutral`, on the VALUE only, never a fill, always with a leading + or minus glyph; all other numbers are neutral, including HAC t, p-values, observation and trial counts and hit rates. The up/down convention is a Settings switch (default red up / green down), see SignConventionSetting; `preview.html` shows both, `preview-considered.html` keeps the rejected options A and B. A hidden test split shows "Hidden" in the value cell, not a number. Long values truncate with an ellipsis and carry the full text in a title. States: default, long value, hidden.
