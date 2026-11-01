# Studio information architecture: objects and lifecycles

Status: proposed, owner direction 2026-11-01. This document decides where each Studio function lives. It supersedes the
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
| `?view=factors` | Factor library: one row per factor with state, answer, headline metric, latest trial, trial count |
| `?view=factor&id=…` | Factor workbench: left editor (frozen question, locked parameters, expression, Run analysis), right result (run selector, action chips, status line, chart, metrics) |
| `?view=strategies` | Strategy library: one row per strategy with its source factor, state, net headline metrics |
| `?view=portfolio&id=…` | Strategy workbench: tabs Backtest, Versions, Tuning, Analyses |
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
2. Factors library replaces the Ideas home; sidebar rework; alias for `?view=projects`.
3. Strategy library and Strategy workbench tabs, moving the Portfolio page content; the New strategy action needs the
   `project.create` family of actions for Portfolio Projects.
4. Run history gains object and lane filters; lane pages become reachable only from Runs and from their object.
5. Tuning tasks attach to objects.

## Non-goals

A chat workbench, AI formula optimisation, paper trading and a market terminal are not part of this allocation. Studio does
not compute verdicts; Core's Judge remains the only authority.
