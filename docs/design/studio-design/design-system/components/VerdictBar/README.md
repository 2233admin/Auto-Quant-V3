# VerdictBar

One line that states the verdict word, one sentence of evidence and a link to the details.

The consumer provides the verdict state from Core (never computed in the UI), the sentence and the details. Left rule: `text` for Supported, dashed `stroke` for Inconclusive, `signal-graphic` for Could not be tested. The word sits in a pill; only Could not be tested uses `signal` text. There is no Refuted state. States: Supported, Inconclusive, Could not be tested, Not tested (no rule colour, muted word). Don't colour the whole bar and don't use green.
