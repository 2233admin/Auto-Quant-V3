# StateBlock

The shared empty, loading and error blocks: a centred muted sentence, never an icon of its own.

The consumer provides the title (what is missing or loading) and optional body (what to do next). Empty is a dashed outline; loading is a solid outline in a box already at the size of the content so nothing shifts; error is a `signal-graphic` outline on `notice-error-bg` with the cause and a retry action. Each state has one wording (see DESIGN.md catalogue). Don't show a spinner and a skeleton together.
