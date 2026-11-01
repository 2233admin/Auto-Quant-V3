# StatusLine

One line that says what the run is doing: a short word, an optional progress bar, a percentage and a time.

The consumer provides the state (running, done, failed, stale) and the text. Progress is `text` on a `selected` track; indeterminate shows a moving segment. A failed state turns the word `signal`. States: running, done, failed, stale session (word "Stale session", with a Refresh button). Don't stack more than one status line in a pane head.
