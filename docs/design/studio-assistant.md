# Studio Assistant

Status: implementation in progress; not an accepted full-automation release.
Tracking: https://github.com/2233admin/Auto-Quant-V3/issues/2.
Plan: [[plans/studio-assistant]].

## Owner decisions

The owner selected both already authenticated local Claude Code and Codex,
selectable at the top of Assistant. The first release must support automatic
writes. A read-only-only release does not satisfy that decision.

The original per-trial confirmation requirement remains in force. It has not
been replaced by unlimited permission or an implicit automatic grant. A separate
explicit initial scope/budget grant may be designed if the owner chooses it.

## Boundaries and current delivery

Assistant is a local Studio controller. The provider CLI owns account login,
refresh and credentials. Studio does not read credential files, collect new
provider keys or proxy account access tokens.

The conversation store and aq broker live in autoquant/studio_assistant.py;
stdio MCP translation lives in autoquant/studio_assistant_bridge.py.
Providers are adapted in autoquant/studio_assistant_providers.py.
[[docs/design/studio-local-actions]] continues to own action preview, exact
command hashes, job execution, cancellation, confirmation and operational audit.

Ordinary supported source writes go through public aq candidate show/save
commands. These reuse the existing confined candidate editor, exact base hash,
Session gates and audit. They do not execute source. The broker retains the
proposed diff before saving. project.create reuses the existing aq action.
Additional writes require explicit contracts; conversation cannot invent one.

Candidate execution currently fails closed. The Core runner imports arbitrary
Python in an ordinary subprocess. Disabling provider shell tools and allowing
only aq does not prevent candidate Python from opening sealed files. A real
process boundary or a separately designed non-Python evaluation language is
required before this gate can be removed. Audit hooks, AST blacklists and
prompts are not a sandbox.

Codex has a dynamic-tool adapter but remains unavailable until the installed
version's native tool closure and read permissions pass direct canaries.
Claude has documented tool/MCP restriction flags; its initialization message
must prove the expected tool set before the broker accepts calls. Neither mock
tests nor CLI help prove live isolation.

## Conversation and presentation

Assistant is the first library navigation item. It has persistent sessions,
New chat, a provider selector, a fixed trial budget, a composer, incremental
answers and Stop. Changing provider starts another conversation; the original
conversation and budget remain intact.

The contextual drawer identifies the current Project/Study/Run. It passes
identifiers rather than forwarding the entire Studio snapshot. Results stay
in normal Project files and immutable aq artifacts. The inspector links to
those artifacts and shows recorded changes.

The expandable timeline reports only observable provider and tool events,
duration and exact generated commands. It does not reconstruct hidden reasoning.
HTTP session polling projects incoming provider deltas; provider transport
itself is streamed.

Conversation JSON lives below .autoquant/assistant/. It is operational state,
not a Report, Run or selection claim. Atomic replacement, link/reparse checks,
bounded messages/state, crash-released OS update/turn leases and shared Project leases
protect persistence, candidate CLI writers and concurrent Studio jobs. A process crash releases
its leases; a recovered interrupted turn is explicit. Server shutdown cancels
and joins Assistant turns. Windows providers start behind a bootstrap gate
inside a kill-on-close Job Object; POSIX providers own a process group. A native
Windows parent-exit cleanup canary passed without starting an agent.

## aq broker and sealed data

The provider receives one structured tool, aq(operation, params). The server
generates argv, confines identifiers and bounds query limits. It never executes
provider-supplied command strings, paths or arbitrary flags. Tool capability
tokens expire at turn completion and are not persisted. Before verified
provider initialization, the MCP bridge refuses all calls.

Read operations include project listing, orient, Study inspection, Run
projections, Session inspection/comparison and candidate source. Holdout
commands are absent. Holdout-bound Projects are refused before generic queries;
Workspace listings omit them. Holdout and executable next-action projections
are removed recursively. Generic Studio snapshots never enter provider context.

These query checks are distinct from candidate-process isolation. Both gates
must hold; one does not compensate for the other.

## Trial authority and budget

A conversation fixes its integer trial budget at creation. Neither the model
nor a backend change can increase it. An approved Session start or formal
evaluation reserves one attempt atomically immediately before launch.
Failures, cancellation after launch and uncertain outcomes never refund it.
Core research-family counts and selection correction remain authoritative.

Pending confirmation displays the exact preview and the next conversation
trial number against the fixed budget. Existing preview trial.n/m counts
Session/family exposure; its denominator is not a budget. Confirmation checks
the pending identity and command hash, including second confirmation where
required. State changes require another preview. Declined/expired requests
do not launch.

Production denies candidate execution before confirmation while isolation is
unavailable. Tests inject a private execution boundary to verify state
transitions; no public environment flag bypasses this gate.

## Verification and remaining completion gates

Bounded fake-provider tests cover persistence, HTTP authentication, source
optimistic locking, cancellation, cross-instance ownership, indirect holdout
projection, private bridge capability, confirmation and budgets. Provider
tests cover startup closure, exact MCP autoapproval, protocol framing and
process cleanup. Provider readiness is cached for 30 seconds so normal polling
does not repeatedly start CLI probes.

Outstanding: live CLI login/streaming and sealed canaries; Codex tool closure;
candidate-process isolation; complete Portfolio construction actions;
multi-round optimization with every evaluated candidate counted and existing
selection-adjusted evidence displayed. These are completion gates, not implied
capabilities of the conversation UI.

## Provider references

Probed versions: Codex 0.166.0 and Claude Code 2.1.309 (2026-11-02).
Version/help discovery used no inference or credential reads.

- [Claude CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude headless operation](https://code.claude.com/docs/en/headless)
- [Claude MCP](https://code.claude.com/docs/en/mcp)
- [Codex app-server](https://learn.chatgpt.com/docs/app-server)
- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Codex hooks limitations](https://learn.chatgpt.com/docs/hooks)
