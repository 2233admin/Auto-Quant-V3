# ActionRow

A row of buttons with at most one primary, and a reason line under it when anything is disabled.

The consumer provides the actions and, for each disabled one, the reason sentence. Rules: one primary button per card or pane head (inverted fill); the rest are outline or quiet. A disabled button keeps its label, turns `faint`, gets a dashed border (a disabled primary stays solid with weight 600) and the reason shows on the line below in `muted`. No dead buttons: every enabled button does something visible. Actions that count a trial ask for a confirm first. States: default, hover, focus, disabled with reason.
