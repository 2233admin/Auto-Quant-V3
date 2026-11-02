# Studio information architecture: objects and lifecycles

Status: build step 2 implemented for supervised visual acceptance, owner direction 2026-11-01. This document decides where each Studio function lives. It supersedes the
lane-per-page layout described in [[docs/design/studio-observation-surface]] for navigation purposes; evidence contracts
and visibility rules there stay in force.

## Problem

Studio was organised by Core research lane: Factor, Portfolio, Book Risk, Path Stress, Allocation, Governed RL and Event
Study each became a top-level page, and Factors, Strategies, Runs and Tuning became read-only lists of Core objects. A
user who wants to test a factor idea has to know which lane serves it, only the Factor page can act, and the same verdict
appears in three places with three wordings. The result is a tool whose layout follows the Core's internals instead of the
user's work.

The reference product organises by object and lifecycle: a factor library, a strategy library, a run history and tuning
tasks. Everything you can do to a factor happens inside that factor; everything you can do to a strategy happens inside
that strategy. Studio adopts the same allocation, because the product is a quantitative factor tool and the same job
sequence applies: state an idea, test it, build a strategy from it, backtest, tune.

## Principles

1. **One home per object.** Every object has a library list and one workbench page. Actions on the object live in its
   workbench, never on a different page.
2. **Actions follow lifecycle.** The workbench shows the next action the lifecycle allows and nothing else as primary.
3. **One verdict, one wording.** The verdict of an object is computed once on the server side and shown the same way in the
   library row, the workbench header and the Run header.
4. **Lanes are analyses, not destinations.** Book Risk, Path Stress, Allocation, Governed RL and Event Study are kinds of
   Run. They are reached from the object they analyse or from the Run history, not from the sidebar.
5. **Core rules stay visible where they bind.** The trial count sits next to the Run button; the frozen question sits at
   the top of the factor workbench; test numbers stay hidden until their audit exists.

## Objects and lifecycles

### Factor (an idea under test)

A Factor is one frozen question plus the candidate expressions tried against it. It maps to one Project with one
Hypothesis and one Factor Study.

Lifecycle, derived from published data only:

| State | How it is known | Primary action in the workbench |
| --- | --- | --- |
| Draft | Project exists, question frozen, no counted trial | Run analysis |
| Tested | At least one counted trial; answer is Supported, Inconclusive or Could not be tested | Edit the expression and run again (a new counted trial), or build a strategy |
| Has strategy | At least one Strategy was built from it | Open the strategy |

There is no Refuted state: Core has no falsification protocol for arbitrary questions. See
[[docs/design/idea-verdict-card]].

### Strategy (a portfolio built from one or more factors)

A Strategy maps to a Portfolio Project and its Studies. Lifecycle: Defined (construction parameters set), Backtested (a
net-of-cost Run exists), Tuned (a neighborhood or tuning task exists). Paper trading and live execution are outside
AutoQuant, so no state exists for them.

### Run (an immutable measurement)

Runs are not edited. The Run history lists every Run across objects and lanes with filters for object and lane; opening a
Run shows its lane page. Compare works on Runs of the same object kind.

### Tuning task (a bounded search over one object)

A Tuning task belongs to one Strategy or Factor. The list shows the search size, the trial count charged to the research
family and the selection-adjusted result; it never shows an unadjusted best.

## Navigation

Sidebar, top to bottom: a prominent **New factor** button, the most recent factors, then **Factors**, **Strategies**,
**Runs**, **Tuning**, and at the bottom **Attention** and **Settings**. The Ideas home page is replaced by the Factors
library; `?view=projects` keeps working as an alias.

| Route | Page |
| --- | --- |
| `?view=factors` | Default landing library: one compact card per Factor Project with verdict, validation headline, latest Run curve and retained trial count |
| `?view=factor&id=…` | Factor workbench: left editor (frozen question, locked parameters, expression, Run analysis), right result (run selector, action chips, status line, chart, metrics) |
| `?view=strategies` | Portfolio Project cards with Defined/Backtested state, validation net headline metrics and development net-growth curve |
| `?view=strategy&id=…` | Strategy workbench: tabs Backtest, Versions, Tuning, Analyses; `?view=portfolio&id=…` remains an alias |
| `?view=runs` | Run history across objects and lanes |
| `?view=run&id=…` | Run page, lane-aware |
| `?view=tuning` | Tuning tasks |

## Where each existing function goes

| Existing function | New home |
| --- | --- |
| Ideas home, New idea | Factors library and the sidebar New factor button |
| Factor page editor and answer card | Factor workbench, Test view |
| Factor evidence tabs (folds, horizons, stability, qualification, protocol) | Factor workbench, Evidence tab below the metrics |
| Session and trial history | Factor workbench, History tab |
| Portfolio page | Strategy workbench, Backtest tab |
| Parameter neighborhood, transitions, episodes | Strategy workbench, Tuning and Analyses tabs |
| Book Risk, Path Stress | Strategy workbench, Analyses tab; also listed in Run history |
| Allocation, Governed RL, Event Study | Run history with their lane page; linked from the object they were run against |
| Compare | Run history action on a selected pair |
| Settings, Attention | unchanged |

## Build order

1. Shell and factor workbench skeleton (in progress: floating-card shell, editor and result layout measured against the
   reference).
2. Implemented for supervised acceptance: Factors replaces Ideas and is the first-load route; `?view=projects` is an alias.
   The sidebar places New factor, three recent factors and the four object libraries below the brand. Attention, Settings
   and the search hint remain at the bottom. The factor editor now has complete expandable authority rows, persistent
   source tabs, a pinned trial note and a stale-session recovery action.
3. The Strategy workbench reuses the Portfolio pane under Backtest. Versions
   reuses the Run history and server-verified comparison, confined to this
   Project's Portfolio lane. Tuning shows the exact base Run's family adjustment
   and the fixed neighborhood scope; individual cells have no adjusted result
   and are not ranked there. Analyses lists only this Project's Book Risk, Path
   Stress, Allocation and governed RL Runs. The Factor answer and Strategies
   library expose the verified build route described below.
4. Run history gains object and lane filters; lane pages become reachable only from Runs and from their object.
5. Tuning tasks attach to objects.

## Library card contract

The desktop libraries use a 240px sidebar, a 56px full-width title card, a 32px toolbar, and a three-column grid with
8px gaps at 1440 by 900. Factor cards are 137px high; Strategy cards are 188px high to include the description. Wider
desktops can show four columns. The toolbar uses the one creation flow each object actually has, rather than copying
venue-specific creation buttons. English five-state Factor filters consequently occupy more width than the reference.

A Factor card's title is the Project name, never the generic Study name. Its badge uses Supported, Inconclusive,
Not tested or Could not be tested. Its one metric line names validation rank IC, HAC t and retained trials. The small
curve is the latest Run's published cumulative high-minus-low spread, not a history of scalar metrics across Runs.
The footer identifies Factor expression and the latest Run timestamp; missing timestamps say Not run. Search matches
the name, frozen question and authored expression. Filter counts describe the entire library, independently of search.

Strategy cards represent Projects with Portfolio Studies; RL and Allocation remain reachable through Runs. Their net return,
net Sharpe and maximum drawdown come from the Portfolio validation summary. The curve contains train and validation
net-growth observations. Defined means there is no verified current net-of-cost
Portfolio evidence. Backtested means that evidence exists; Tuned additionally
requires its published `parameterNeighborhood.available=true`. Neither implies
a positive result, successful optimization or independent confirmation. A newer
rejected attempt cannot replace the explorer's current Run or its lifecycle.

Build strategy follows the template fit contract: Factor-to-Portfolio work
belongs in `ohlcv-research-desk`. Standalone Factor Labs have no Core conversion
command, so the control stays disabled with its exact reason and a copyable
`aq project intake ... --template ohlcv-research-desk --request ... --dataset ...`
Agent path. The Agent must first agree caller-owned construction policy, retain
a complete compatible dataset, author the factor, and establish/report counted
Factor evidence in the sibling desk. Creating a scaffold does not transfer
evidence. No defaults are invented to fill that authority gap.

In an existing coordinated desk, current Portfolio evidence opens its Strategy.
Otherwise `strategy.build` may preview the existing Core `session.start` command
for its Portfolio Study only after the strict Factor-to-Portfolio gate passes,
shared active Sessions end, and retained failure dispositions are respected.
This creates a governed Session/worktree and possibly a counted baseline, not
a Project conversion or new Study. The selected Factor Run must match the
current admitted source before the workbench offers this action. Confirmation,
stale-state checks and audit follow [[docs/design/studio-local-actions]].

The Workspace summary carries bounded library projections, including at most 64 curve observations per card. No
card fetches full Project or Run diagnostics. Factor test points are removed before sampling unless both the actual
audit and visible-diagnostic role exist; the browser applies the shared test gate again. Portfolio cards conservatively
omit test points. Missing curves remain absent. Metric text is a single clipped line with its full text available in
the DOM and tooltip, matching the compact reference rhythm. Colours and typography remain the workbench tokens.

## Non-goals

A chat workbench, AI formula optimisation, paper trading and a market terminal are not part of this allocation. Studio does
not compute verdicts; Core's Judge remains the only authority.
