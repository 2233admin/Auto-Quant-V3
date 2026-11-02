# Studio localization

Studio supports English and Simplified Chinese through its sidebar language
control and narrow-screen navigation. The choice is retained in the browser's
`aq-language` storage entry and applied to `html.lang`. Switching language
rerenders the shell and its current research page without issuing a research
action or rewriting an artifact.

`studio-app/src/i18n.ts` owns locale state, source-copy lookup and parameterized
copy. `studio-app/src/locales/zh-CN.json` contains the Chinese catalog. Static
copy uses `uiText`; parameterized copy uses `uiTemplate` so values remain
distinct from prose. Components that receive source-authored display metadata
use `uiValue`. Stable route names, action ids, filter keys, verdict enums and
scientific predicates retain their canonical values.

Project names, research questions, descriptions, code, commands, hashes, asset
ids, numbers, downloadable evidence and raw diagnostic output retain their
original content. Unknown external diagnostics receive a Chinese summary and
an explicit expandable original; Studio never guesses their scientific meaning.
This is a presentation feature, not a change to the research protocol or an
automatic translation of user-authored research.

Metric definitions are the one exception to the single Chinese catalog: they
are authored as English/Chinese pairs in `studio-app/src/metrics/catalogue.ts`
so each definition stays one reviewable unit, and the UI test requires both
sides of every entry (see [[docs/STUDIO]]).

Localization covers the shell, Assistant and contextual drawer, Factor and
Strategy libraries, Run history and comparison, Tuning, Settings, Attention,
Project research, Factor editing and evidence, Portfolio, Book Risk, Path
Stress, Allocation, governed RL, Event Study, shared charts, dialogs and the
component gallery. Scientific symbols such as IC, HAC, Sharpe and Python may
remain recognizable technical notation alongside translated labels.

## Verification

- `pnpm check:i18n` uses the TypeScript parser to inventory remaining raw
  English JSX copy and display attributes. Code blocks and explicitly
  untranslated content are excluded. This is a static gate, not a browser
  acceptance claim for arbitrary runtime data.
- `pnpm test:ui` checks the existing evidence gates and presentation, plus
  Chinese/English lookup, interpolation, authored JSX entities, original user
  names and commands, numerical fidelity and canonical verdict states.
- `pnpm build` checks types and creates the bundle served by `aq studio serve`.
- Browser acceptance checks both languages, language persistence, available
  sample research pages, read-only dialogs, evidence tabs and narrow layouts.
  Empty-state pages are explicitly distinguished from pages with populated
  sample evidence; no research trial is created for presentation acceptance.

See [[docs/design/studio-observation-surface]] for the read-model boundary and
[[docs/design/studio-assistant]] for action and provider limitations.
