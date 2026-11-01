# FloatingShell

The page frame: a left rail, then the page area on the `bg` canvas, all separated by 8px gaps and 1px hairlines.

The consumer provides the rail items and the page content. Use it once per page. Panes and cards inside use `radius-control` (6px). The current code (studio-app floating.css) gives the rail, header and page 22px radii; the owner rejected the large rounded floating-card look, so those radii must be replaced by `radius-control`. The rail is 240px wide expanded and 68px collapsed in the current build. States: rail item default, hover (`hover` wash), selected (`selected` fill, weight 600). Don't put a shadow or a gradient behind the shell.
