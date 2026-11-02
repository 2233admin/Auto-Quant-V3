# Studio local actions

The developing Assistant broker is specified in [[docs/design/studio-assistant]].
It reuses these action gates and does not authorize unrestricted candidate
execution. Public aq candidate show/save now expose the existing confined
editor contract to standalone callers; source persistence does not execute code.
Studio jobs and candidate writers now acquire a shared crash-released Project
lease in addition to the in-process job slot; separate CLI writers cannot both
save over the same base hash while a Studio job owns that Project.

The idea-first Factor slice is described in [[docs/design/idea-verdict-card]].
It adds `project.create` (id, name, description, allowlisted blank/Factor
template) and `project.intake` (confined staged dataset, explicit prediction
assets and horizon). Both preview exact argv and execute the existing CLI.
Intake writes its displayed strict caller request under `.autoquant/idea-inputs`
before invoking Core. GET `/api/v1/idea-datasets` and `/api/v1/idea` require the
action token. The controlled candidate write also accepts `session=initial`
only after strict intake and before any Run/Session; afterwards the existing
Session gates apply. Started research jobs record the original question and
its hash as operational metadata. None of these records changes Judge or Run
authority. These narrow working-file writes supersede the older blanket
“only the audit log” and “no browser-side code editing” non-goals below.

The data wizard in [[docs/design/studio-data-intake]] adds read-only,
confirmation-free `data.check` and token-protected staging discovery. It extends
`project.intake` with staged CSV mapping/package construction, new or pristine
existing Factor targets, content-bound preview and mandatory second confirmation.
Its confirmed staging bundle writes are also explicit exceptions to the old
audit-only non-goal. Strict CLI intake remains the Project mutation authority.

Status: slice S1 implemented (server side: flag, security layer, JobRunner,
audit log, the `experiment.evaluate` action); the S3 subset `session.start` and
`session.check` plus the controlled write `candidate.save` and the read route
`GET /api/v1/candidate` are implemented as specified in "Candidate editor and
session actions"; the rest of S2 to S5 is proposed.
Owner decision of 2026-11-01: Studio gets a local action layer that can start work, but only by
invoking existing `aq` commands. This document owns that layer: the opt-in
flag, the HTTP action and job surface, the security model, the action catalog,
the job model, the UI flows, and the build slices.

Related: [[docs/design/studio-observation-surface]], [[docs/STUDIO]],
[[docs/CLI]], [[docs/design/agent-cli-contract]],
[[docs/design/research-session-loop]],
[[docs/design/research-selection-integrity]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/hypothesis-and-idea-verdict]],
[[docs/design/frozen-external-holdout-challenge]],
[[docs/design/pandaai-reference-notes]],
[[docs/design/studio-research-decision-brief]], and
[[docs/design/quant-research-lifecycle]].

## Problem and non-goals

### Problem

Studio (`autoquant/studio.py`, stdlib `ThreadingHTTPServer`, loopback) can only
observe. Every state-changing route answers `405 studio.read-only`
(`do_POST` and friends in `_handler`). Beside the reference product, whose
factor page offers new factor, edit code, run analysis, save version, build
strategy, tune, and paper trade as buttons
([[docs/design/pandaai-reference-notes]] sections 5c to 5g), Studio looks thin:
the owner can see everything and start nothing. The consequence is that the
owner must leave Studio, copy a command, and paste it into a terminal for every
step, which is exactly where the "intuitive first" goal breaks.

The reference notes also record the failure this layer must not copy: the
reference product lets a chat turn apply tuned parameters and overwrite saved
code without a version or a trial number (section 5g). Our actions are
explicit, shown as the exact command, confirmed, logged, and counted.

### Non-goals

- No live trading, broker connection, order, account, or paper-trading
  action. Studio keeps no trading authority of any kind.
- No holdout evaluation by one click, and no second path to the frozen
  holdout at all (see the catalog).
- No browser-side code editing. Candidate code stays in the Agent or worktree.
- No new write path inside Core. Studio invokes existing `aq` commands as
  child processes; it does not import Core mutators and does not write
  Project files itself. The only file Studio writes is its own audit log.
- No remote exposure, multi-user serving, accounts, or authentication system.
  Binding a non-loopback address with actions enabled is refused.
- No new verdict logic. The browser and the server never compute metrics,
  verdicts, or trial adjustments (invariants 1, 9 and 10 of the observation
  surface remain).

## Supersession of the read-only sentences

[[docs/design/studio-observation-surface]] states that Studio is read-only in
several places. This document supersedes those sentences, and only when the
operator starts the server with `--allow-actions`. Without the flag the old
text is still literally true; that is the default.

| Line (studio-observation-surface.md) | Current text | Change |
| --- | --- | --- |
| 18 | "read-only HTTP boundary" in the Scope sentence | Scope now also names the opt-in local action boundary owned here |
| 32 | `CLI JSON or local read-only HTTP` in the layer diagram | Add: "or, with `--allow-actions`, local HTTP that can start allowlisted `aq` commands" |
| 42 | "It cannot create metrics, change verdicts, execute commands, publish Reports, or write Project state." | Metrics and verdicts remain impossible for the browser. "Execute commands" and "publish Reports" become possible only through the action layer in this document, and only by running the existing `aq` command, never by browser or server logic. "Write Project state" stays false for Studio itself; the child `aq` process writes, exactly as it would from a terminal |
| 116 to 118 | "There is no arbitrary path, artifact download, mutation, command, or shell endpoint." and "Binding to a non-loopback address is an explicit operator choice and V1 has no authentication." | Without the flag unchanged. With the flag, the fixed routes `/api/v1/actions` and `/api/v1/jobs/...` exist; there is still no arbitrary path, download, or shell endpoint; and non-loopback binding is refused (it is no longer an operator choice, because an unauthenticated process spawner must not be reachable remotely) |
| 247 | Invariant 5: "Browser presentation performs no Project writes or command execution." | Reworded: "The browser performs no Project writes. Command execution happens only server-side through the action layer, only with `--allow-actions`" |
| 248 | Invariant 6: "Server routes are fixed and read-only." | Reworded: "Server routes are fixed. All routes are read-only unless `--allow-actions` is set; then only the action and job routes in studio-local-actions can start work" |
| 266 | Known gap: "Studio operations remain read-only." | Replaced by: "Studio can start allowlisted `aq` commands when `--allow-actions` is set; otherwise it is read-only" |

Unchanged and restated: loopback by default (line 116), no network or CDN
dependency (invariant 7), no browser-computed verdicts (invariants 9 and 10),
and no trading authority. The mention at line 42 that clipboard copy "grants
no new authority" stays true; copy remains available beside every action
button as the fallback.

Other docs that carry the read-only sentence and must change with S1:
`docs/STUDIO.md` line 3 and its trailing "downstream workbenches remain
read-only" paragraph, `docs/CLI.md` around lines 1337 to 1345 and 1397
(`studio serve` description and the `long-running-server` note), and the
startup banner in `serve_studio` (`Mode: local read-only observation`), which
must print `Mode: local actions enabled` when the flag is set.

## Threat model

A local HTTP server that can spawn processes is a remote-code-execution
surface for any web page the owner visits. The adversaries are: a malicious
web page in the owner's browser, another local user or process on the machine,
a DNS-rebinding attacker, malformed or hostile Project content, and the
owner's own mistakes. The operator and the OS account are trusted.

| Threat | Control |
| --- | --- |
| DNS rebinding: attacker domain resolves to 127.0.0.1 and reads or posts to the server | Every request must carry a `Host` header in an allowlist built at startup: `127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>` for the bound port. Anything else gets `403 studio.host`. This applies to GET too once actions are enabled |
| CSRF from another origin | Per-process random token (32 bytes, `secrets.token_urlsafe`) generated at server start, never written to disk. It is delivered only in the HTML bootstrap of the shell (a `<meta name="studio-action-token">` or an inline JSON block) and the browser echoes it in the header `X-Studio-Token`. Compared with `hmac.compare_digest`. In addition: POST only for mutation; `Content-Type` must be `application/json` (a cross-site form cannot send it without a preflight); if `Origin` is present it must equal `http://<allowed host>` exactly; if absent, `Sec-Fetch-Site` must be `same-origin` or `none`; no CORS headers are ever sent, and `OPTIONS` stays 405 |
| Token theft through a cached or framed page | The shell already sets a restrictive CSP and denies framing; the shell with the token is served `Cache-Control: no-store`. The token is not placed in a URL or a cookie |
| Command injection | Never a shell. The child is started with `subprocess.Popen(argv_list, shell=False)`. The argv comes from a fixed template in the catalog; user values fill only typed slots validated against a schema (pattern, length, enum) and are passed as single argv elements. A value beginning with `-` is rejected unless the slot is a declared flag. The executable is the current interpreter's `aq` entry (`[sys.executable, "-m", "autoquant.cli", ...]`), not a PATH lookup |
| Path traversal and escape | Every path slot is resolved and must lie inside the served Workspace (`Path.resolve().relative_to(workspace)`), reuse the same confinement helpers Core uses for Project paths, and symlink and junction escapes are rejected after resolution. Project ids and Session ids are matched against ids that the verified snapshot lists, not free text |
| Runaway or concurrent work | One active job per Project; a second request returns `409 studio.busy` naming the active job. A hard wall-clock timeout per action (catalog column), then terminate and kill the process tree. Child stdout and stderr are read incrementally into a ring buffer capped at 256 KiB each; excess is dropped and flagged `truncated` |
| Secret leakage to children and logs | The child environment is built from an allowlist (`PATH`, `SYSTEMROOT`, `TEMP`/`TMP`, `HOME`/`USERPROFILE`, `PYTHONUTF8`, `VIRTUAL_ENV`, `UV_*` cache variables), not inherited wholesale; anything matching `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*` is dropped even if listed. The Studio token is never passed to children and never logged. Output tails are returned only to the page that holds the token |
| Tampering or denial of the audit trail | Append-only `.autoquant/studio-actions.jsonl` under the Workspace (the `cache` directory in `autoquant/workspace.py`); opened in append mode, one JSON object per line, fsync on finish; the file is created with owner-only permissions where the OS supports it |
| Owner clicks the wrong thing | The confirm step shows the exact argv as a command line, a command hash, the Project, the trial counter effect (see selection integrity below), and for write actions a plain-language "writes" line. No action runs on first click |
| Stale confirmation | The create request must echo the `commandHash` the server returned from a preview call; the server recomputes it from the validated parameters and the current Project state fingerprint (the same `SnapshotCache` fingerprint idea) and rejects a mismatch with `409 studio.stale-preview`, so state that changed between preview and confirm cannot be run blind |
| Bypassing the flag | Without `--allow-actions` the action routes do not exist (`404`), the token is not generated, and the shell does not render action buttons. The snapshot advertises `"actions": {"enabled": false}` so the UI hides them from Core-provided truth, not browser guesswork |

Not defended, by design: a hostile process running as the same OS user can read
the token from the page and drive the server. That user could run `aq`
directly anyway. Loopback plus the token protects against the browser, not
against the account.

### Audit log record

One line per job, written at creation and again at finish (two lines per job,
joined by `jobId`; append-only, never rewritten):

```json
{"schemaVersion":1,"event":"started","jobId":"job-20261101T101500Z-ab12","actionId":"experiment.evaluate","argv":["python","-m","autoquant.cli","experiment","evaluate","D:/ws","--project","p1","--session","s-0004","--hypothesis","...","--json"],"commandHash":"sha256:...","project":"p1","tokenId":"a1b2c3","startedAt":"..."}
{"schemaVersion":1,"event":"finished","jobId":"job-...","exitCode":0,"endedAt":"...","status":"succeeded","createdRefs":{"experimentId":"exp-...","runId":"run-..."},"truncated":false}
```

`tokenId` is the first 6 hex of SHA-256 of the process token, so lines from one
server process correlate without revealing the token. The log is operational
telemetry like `progress.json`: it is never evidence, never read to infer a
verdict, and a missing or edited log cannot change any Core object.

## Action catalog v1

The catalog is a Python constant in `autoquant/studio_actions.py` (a new module;
`studio.py` only wires it). Each action has an id, an argv template, typed
parameters, preconditions evaluated from the verified snapshot (never from
browser state), a timeout, and a classification. `<ws>` is the served
Workspace path; `--json` is always appended so results are one envelope that
the job record can parse.

Availability labels: `safe now` means every needed Core command exists today;
`needs Hypothesis` means the action should wait for the `aq hypothesis`
objects of [[docs/design/hypothesis-and-idea-verdict]] to exist; `excluded`
means it is not offered in v1 and the reason is stated.

| Action id | `aq` command template | Parameters and validation | Preconditions | Writes | Appears in Studio | Second confirmation | Label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `project.create` | `aq project create <ws> <project_id> --template <t> [--name N] [--description D] --json` | `project_id`: `^[a-z][a-z0-9-]{1,39}$` and not already present; `template`: enum from `aq project templates`, v1 limited to `ohlcv-factor-lab`; `name` and `description`: 1 to 120 and 0 to 500 chars, no control characters | Workspace writable; id unused | New Project directory from the template | New Project card in the Workspace list, opened at its Project page | No (creates only an empty scaffold) | safe now |
| `project.intake` | `aq project intake <ws> <project_id> --request <file> --dataset <manifest> --template <t> --json` | Confined staged package or CSV wizard inputs, explicit prediction assets and horizon | Workspace staging sources and new/pristine Factor target | Project with a verified request intake and dataset snapshot; declared staging bundle | Data intake wizard and Factor setup | Yes | implemented |
| `data.check` | `aq data check <staged-source> --options-json <options> --json` | Confined staged source and declared diagnostic options | Workspace serving scope, valid token | None; synchronous inspection | Data intake wizard | No confirmation | implemented |
| `idea.new` | `aq hypothesis add <ws> --idea TEXT --kind factor --project <id>` then `aq project create` | `idea`: 8 to 500 chars | `aq hypothesis` group exists | Hypothesis draft and its dedicated target Project (owner decision: one Hypothesis per dedicated Project) | Hypothesis draft card on the new Project | No | needs Hypothesis |
| `session.start` | `aq session start <ws> --project <p> --study <study_id> [--request <file>] --json` | `study_id` from the verified snapshot's Study list; `request` optional, Workspace-confined | Project has a Study; no active Session on the Study; baseline can be established | Session, baseline Run, Session worktree | Session appears with leader and next command | Yes: starting a Session opens a trial family; the dialog shows the current family trial count | safe now |
| `session.check` | `aq session check <ws> --project <p> --session <sid> --json` | `sid` from snapshot | Session `active`, candidate present, not stale | Nothing durable by design (fixed bounded preflight) | Preflight result on the candidate card | No | safe now |
| `candidate.save` | none (in-process write) | see [[docs/design/studio-local-actions]] section Candidate editor and session actions | Session `active`, not stale, candidate inside the editable closure, no job active for the Project | Replaces `factors/candidate.py` in the Session worktree only | Factor page editor | No (spends no trial, creates no evidence) | implemented |
| `experiment.evaluate` | `aq experiment evaluate <ws> --project <p> --session <sid> --hypothesis <text> --json` | `sid` from snapshot; `hypothesis`: 8 to 500 chars, no control characters, passed as one argv element | Session `active`; candidate differs from leader; preflight passed; Session not stale (Session worktree matches its recorded Study and source hashes); no job active for the Project | Immutable Experiment and Run; the Session verdict (KEEP, REVERT, CRASH) is applied by Core exactly as from a terminal | New Run card with verdict and trial counter; Run header updates | Yes: always. The dialog shows trial N of M and the adjustment effect | safe now (S1) |
| `experiment.evaluate` with `--hypothesis HID` | same, with `--hypothesis HID` once the flag accepts ids | `HID` from `aq hypothesis list` | Hypothesis frozen | as above, bound to the frozen criteria | Run carries the Hypothesis verdict ledger | Yes | needs Hypothesis |
| `report.publish` | `aq report publish <ws> --project <p> --session <sid> --analysis <file> --json` | `analysis`: a file under the Workspace that already exists (written by the Agent); Studio never authors analysis text | Session active and delegated; analysis file schema-valid | Immutable Research Report | Report appears in the Report lane; Core `report.publish` command already listed in `_session_commands` | Yes: Reports are immutable evidence | safe now (the Agent writes the file) |
| `session.complete` | `aq session complete <ws> --project <p> --session <sid> --report <rid> --json` | `rid` from snapshot | Exactly the preconditions `_session_commands` already encodes: Session active, leader equals baseline, latest Report bound to the leader Run | Terminal close of the Session | Session shows closed | Yes: terminal and irreversible | safe now |
| `session.promote` | `aq session promote ...` | | | Writes the KEEP into the owning Project source | | | excluded in v1: promotes code into the Project; stays an Agent or terminal step until the Hypothesis verdict gate exists |
| `holdout.*` (`bind`, `run`, `assess`) | `aq holdout ...` | | | | | | excluded permanently from one-click: the frozen holdout is one-shot and consumes untouched evidence. Studio keeps showing holdout status read-only and the copyable command; it never offers a run button. Any future "open holdout" flow needs its own design with a separate typed confirmation, not an action in this table |
| "AI optimize", apply-tuned-parameters, any candidate edit other than `candidate.save` | none | | | | | | excluded: no `aq` command edits candidate code (the one controlled exception is `candidate.save`), and the reference product's silent overwrite (section 5g of the reference notes) is the anti-pattern. Studio shows the candidate diff and offers a "hand to Agent" text box that produces copyable prompt text; it executes nothing |
| `strategy.build` | The exact existing research-program `aq session start <project> --study <portfolio-study> [--request <request>] --json` | Existing Project id; no free-form parameters | Verified coordinated desk, passed current Factor admission and Report gate, no shared active Session or retained failure requiring inspection | Session/worktree and baseline unless an identical successful Run is reused; possible counted source trial | Factor answer action row and source selector in Strategies | Required, with exact argv and conditional trial notice | safe only for the existing coordinated Portfolio Study |
| Arbitrary Factor-to-Portfolio Project conversion, tuning sweeps, paper trading | none | | | | | | excluded: no existing `aq` command with those effects |

Two catalog rules follow from the table:

1. The first ship set is the rows marked `safe now`, but S1 enables exactly
   one: `experiment.evaluate`. The others arrive in S2 to S4.
2. A new action may be added only if an existing `aq` command already performs
   it with the same effect from a terminal. Adding an action never adds a Core
   write path; it adds a button over a command that already exists.

### Strategy build boundary

`autoquant/studio_strategy.py` reads the strict research-program projection;
Studio does not derive admission from a displayed Supported word or metric
signs. A standalone Factor Lab refuses preview and launch with the conversion
gap and a research-desk intake CLI path. No existing Run is copied or relabelled,
and no caller-owned Portfolio policy is synthesized.

A Factor with `forward-realized-volatility` outcome receives a separate risk
forecast refusal and template-inspection CLI, rather than a return-desk intake
recommendation. Changing the supported decision or outcome requires a new
caller-owned assignment; Studio cannot invert the score into a return claim.

The supported action uses the program's exact Portfolio Session argv and the
ordinary Session preparation checks/trial disclosure. Its confirmation hash
binds both the Project fingerprint and the complete verified program, so a
changed gate, report, source or command requires a fresh preview. Launch runs
the same interpreter/CLI path as other actions and logs `strategy.build` with
the normal append-only job audit. Session and baseline Run references are
extracted from Core's result. Existing current Portfolio evidence instead
offers Open strategy and spends no trial. This narrow action supersedes the
old blanket exclusion of `strategy.build`; it does not enable arbitrary Project
or Study creation from a factor.

## Job model

### Routes

All routes require the Host allowlist; mutating routes require the token and
the CSRF checks above. Bodies and responses use the existing Studio envelope
style (`schemaVersion`, `ok`, `error.code`).

| Route | Purpose |
| --- | --- |
| `GET /api/v1/actions` | The catalog filtered to what is currently available for the served scope: per action the label, parameter schema, and for the current Project whether preconditions pass, with a `blockedBy` reason when not |
| `POST /api/v1/actions/preview` | Body `{actionId, project, params}`. Validates, resolves, returns `{argv, display, commandHash, writes, trial: {n, m, adjustment}, requiresSecondConfirm}`. Starts nothing |
| `POST /api/v1/actions` | Body `{actionId, project, params, confirm: true, commandHash, secondConfirm?}`. Revalidates, recomputes the hash against current state, rejects mismatch, rejects `confirm != true`, rejects missing `secondConfirm` when required, then creates the job and returns `202 {jobId}` |
| `GET /api/v1/jobs/<id>` | `{status, actionId, project, display, startedAt, endedAt, stages, stdoutTail, stderrTail, truncated, exitCode, result}` |
| `GET /api/v1/jobs` | Recent jobs for this server process (bounded, newest first) |
| `POST /api/v1/jobs/<id>/cancel` | Terminates the process tree; status becomes `cancelled`. Cancelling after the child finished is a no-op returning the final record |

`status` is one of `queued`, `running`, `succeeded`, `failed`, `cancelled`,
`timed-out`. `result` is the parsed `--json` envelope of the child when it
printed one (it is Core's own output, forwarded unmodified and labelled so),
plus `createdRefs` (Run id, Experiment id, Report id) extracted only from that
envelope.

### Polling versus SSE

Choice: polling, `GET /api/v1/jobs/<id>` every 1 second while a job runs, back
off to 5 seconds after 60 seconds. Reasoning: the server is stdlib
`ThreadingHTTPServer`; SSE would hold one thread and one socket per viewer,
needs keep-alive and flush care across proxies we do not use, and adds a second
transport the tests must cover. The data is small (a status, two bounded
tails), runs last seconds to minutes (the reference notes saw 6 seconds for a
factor analysis), and the snapshot is already polled today. SSE is cheap only
if the stage events exist as a pushed stream, which they do not. Revisit if
a single job regularly exceeds 10 minutes.

### Stages

Each action declares an ordered stage list; the job record carries
`stages: [{id, label, state}]` with `state` in `pending`, `running`, `done`,
`failed`, `skipped`. Stage progress is derived from the child, never invented:
the runner updates stages from structured progress that Core already emits
where available, otherwise only `running` and the terminal `done` or `failed`
are reported for the whole action, with the stage list shown as the planned
path, not as measured progress. Honest rule: Studio never shows a stage as
done that the child did not report.

For `experiment.evaluate` the planned stages reuse the stage-pipeline idea from
the reference notes (nine stages in section 5d) rendered as a compact horizontal
pipeline component in the browser: `data checked` -> `split frozen` ->
`candidate run` -> `selection (validation)` -> `test audit`. These map to what
the Experiment already performs (Study currentness check, fixed split,
candidate Run, validation-only KEEP/REVERT, visible test audit). The final
stage label stays `test audit`, not `test`, because the test metrics are audit
evidence and never part of the objective (see selection integrity).

### Runner

`JobRunner` owns a lock-protected dict of jobs and a per-Project active-job
slot. It runs each job on a daemon thread that calls the injected
`spawn(argv, env, cwd, timeout)` function (default: `subprocess.Popen` with
`shell=False`, `stdin=DEVNULL`, new process group on POSIX and
`CREATE_NEW_PROCESS_GROUP` on Windows so cancel can terminate the tree). The
injection point is what lets tests use a fake runner. Jobs live in memory for
the server process; the audit log is the only persistence. A server restart
loses running-job state; Core objects already written by a child remain
verified evidence and show up in the next snapshot.

## UI flows

All flows keep the observation surface rule: a single primary button per page,
the exact command visible, nothing starts on first click. Action UI renders
only when the snapshot says actions are enabled.

1. **New idea.** A text box on the Workspace page ("What do you want to test?").
   With the Hypothesis objects available it creates a Hypothesis draft and one
   dedicated target Project in one confirmed step (default per the owner
   decision: one Hypothesis per Project). Until then the box offers the
   `project.create` route with the idea text as the Project description and
   states that no Hypothesis exists yet. The result opens the new Project.
2. **Run analysis.** On a Run header (and on the candidate card of an active
   Session) the primary button is `Run analysis`. It opens the confirm dialog:
   the exact command, the Project and Session, "writes an immutable
   Experiment and Run", and the line `This will be trial N of M` with the
   adjustment effect read from the Core Session projection. Buttons:
   `Confirm and run`, `Copy command` (always present), `Cancel`. The Confirm
   button is disabled until the owner ticks the acknowledgment for
   second-confirm actions.
3. **Progress panel.** After confirm the dialog becomes a progress panel with
   the stage pipeline, elapsed time, the tails of stdout and stderr (collapsed
   by default), and a `Cancel` button. Failure shows the exit code and
   stderr tail, never a verdict.
4. **Result lands as a Run.** On success the panel links to the new Run card in
   the normal evidence view. The verdict, trial counter, and adjustment shown
   there come from the refreshed Core snapshot, not from the job result. The
   job panel carries only operational status.
5. **Compare with previous Run.** The new Run card shows a `Compare with
   previous Run` link that goes to the existing Session compare view
   (`aq session compare` is already surfaced as `session.compare`); no new
   comparison logic.
6. **Hand to Agent.** Where the candidate needs a change, the Run page shows
   the candidate diff (read-only, already derivable from the Session
   worktree view) and a copyable text block for the Agent. It has no editor
   and no submit.

Disabled-state copy is mandatory and specific: `Blocked: Session s-0004 is
stale; run aq session show to see why` (text comes from the precondition
check, not from the browser).

## Interaction with selection integrity

Every `experiment.evaluate` creates one candidate trial in the Project-family
count defined by [[docs/design/research-selection-integrity]] and
[[docs/design/selection-adjusted-research-evidence]]. Rules for the action
layer:

- The preview shows `trial N of M` where N is this run's index in the current
  Project family and M the count after the run, both read from the Core
  Session projection (the same values Studio already shows beside the leader),
  plus the current selection adjustment and test-exposure state. The server
  reads them from the snapshot builder; the browser computes nothing.
- The first candidate trial reveals test audit evidence
  (`first-candidate-audit-visible`) and any candidate trial after that
  triggers the conservative external-holdout requirement. The confirm dialog
  must say so in those words before the first trial of a Session: "this run
  exposes test audit values; later runs will require a fresh external
  holdout".
- Repeated runs on the same data window are labelled `repeat on same window`
  on the Run card, derived from the Experiment's split identity as Core
  projects it. A run cannot be hidden, deleted, or reverted out of the count
  (invariant 7 of selection integrity); cancelling a job that already wrote an
  Experiment does not remove it.
- Distinguishing Studio-launched from Agent-launched runs. Core's ledger has no
  such field and v1 does not add one (no new write path). The audit log
  records `createdRefs` (Experiment id, Run id) per job, so Studio joins the
  snapshot's Run list to the log and labels a Run `launched from Studio
  (job <id>)`. The label is operational metadata and is shown beside, never
  inside, the verdict; an Agent run simply has no log line. If the log is
  absent the label is absent; evidence is unchanged. The Experiment's
  free-text hypothesis is not prefixed or tagged, so the Core record is
  identical regardless of who launched it.

## Test plan

Unit tests on the HTTP layer use a fake runner injected into `JobRunner` and a
tiny fixture Workspace; none require network.

1. Host allowlist: wrong `Host`, `Host` with another port, and missing `Host`
   each return 403 on GET and POST when actions are enabled.
2. CSRF: missing token, wrong token, non-JSON content type, foreign `Origin`,
   `Sec-Fetch-Site: cross-site`, and `OPTIONS` are all rejected; correct token
   with same-origin passes.
3. Flag off: action routes return 404, no token in the shell, the snapshot says
   `enabled: false`, and POST still returns the existing `405 studio.read-only`
   (regression of today's behavior).
4. Path confinement: `..`, absolute paths outside the Workspace, a symlink to
   outside, and a Windows drive-letter path are rejected for each path slot.
5. No shell: a test asserts `spawn` is called with a `list` argv and
   `shell` false, no element is joined into a string, and values like
   `; rm -rf x`, `$(x)`, `--help`, and newlines arrive as single inert argv
   elements or are rejected by the schema.
6. Preview and confirm: `confirm` missing or false, hash mismatch, state
   changed between preview and create, and missing `secondConfirm` all reject
   without spawning.
7. Concurrency and limits: second job in the same Project returns 409; a
   different Project runs; timeout kills the fake process; output cap sets
   `truncated`; cancel ends the process.
8. Environment scrub: the fake runner receives an env containing none of the
   test-planted `*_TOKEN`, `*_KEY`, `*_SECRET` variables.
9. Audit log: started and finished lines appear in order, are append-only
   across two jobs, contain no token, and include the exit code and refs.
10. Precondition parity: for every catalog action, enabled and blocked states
    equal what `_session_commands` and the Core loaders imply for fixtures
    (active, stale, closed, delegated, non-delegated).
11. One end-to-end test on a tiny Workspace: start the server with
    `--allow-actions`, preview, confirm, run the real `aq experiment evaluate`
    on a minimal Factor Project with a cheap fixture, poll the job to
    `succeeded`, and assert the next snapshot contains the new Run, that the
    trial count incremented by exactly one, and that the Run is labelled as
    launched from Studio.

### Docs to update with S1

`docs/STUDIO.md` (opening sentence, action section, read-only closing note),
`docs/CLI.md` (`studio serve` options and the long-running-server paragraph),
`docs/design/studio-observation-surface.md` (the lines in the supersession
table, plus a Related link to this document), `docs/ARCHITECTURE.md` (Studio
layer description), `docs/CHANGELOG.md`, `docs/STATUS.md`, and `README.md`
only if its Studio sentence says read-only. The `aq capabilities` output must
list the new `--allow-actions` option; any capability-listing test that
snapshots it changes together.

### Versioning

This is a new user-visible capability and a CLI option, so it is a minor
release: 0.10.0. The Harness `sourceHash` covers `autoquant/`, so
`studio.py`, the new `studio_actions.py`, and the new `STUDIO_*` schema
constants all change it; `studio-app/` (the packaged browser app, built
output under `studio_app`) is excluded from the hash and is verified by its
own typecheck gate. Version bump and the release audit follow the existing
release checklist in [[docs/OPERATOR_GUIDE]].

## Build slices

S1 must be complete before S2 to S5 because they reuse its runner and security
layer. After S1, S2 to S4 are independent and can run in parallel; S5 depends
on the Hypothesis objects and on S2 to S4.

| Slice | Scope | Acceptance |
| --- | --- | --- |
| S1 | Feature flag `aq studio serve --allow-actions` (default off, so the old read-only invariant stays true by default); Host allowlist, token, CSRF checks; `JobRunner` with per-Project lock, timeout, output cap, env scrub, cancel; `/api/v1/actions`, `/preview`, create, `/jobs/<id>`, cancel; append-only `.autoquant/studio-actions.jsonl`; exactly one action, `experiment.evaluate`; refusal to combine `--allow-actions` with a non-loopback host; banner text; snapshot `actions.enabled`. No browser work beyond a minimal confirm dialog and polling panel (UI by the studio-app owner against the documented routes) | Test plan items 1 to 10 pass with the fake runner; item 11 passes on a tiny Workspace; `aq studio serve` without the flag is byte-identical in behavior (existing Studio tests unchanged and green); `uv run python -m unittest` full suite green; docs listed above updated; `check_doc_links.py` exits 0 |
| S2 | Browser action UI: `Run analysis` on Run header and candidate card, confirm dialog with command, hash, trial N of M, second confirm; progress panel with stage pipeline; "launched from Studio" label; disabled-state copy | Typecheck gate passes (`studio-app`); Playwright or equivalent smoke on the fixture shows preview, confirm, progress, new Run; keyboard operable; narrow screen layout works |
| S3 | `session.start`, `session.check`, `session.complete`, `report.publish` actions | Each action has parameter-schema, precondition, and blocked-reason tests; `session.complete` offered only when `_session_commands` offers it |
| S4 | `project.create` and `project.intake` (file-based) with the "New project" flow | Created Project appears and validates; path-confinement tests for request and dataset slots; duplicate id rejected |
| S5 | `idea.new` and `--hypothesis HID` variants once the `aq hypothesis` group exists | New idea box creates draft plus dedicated Project in one confirmed step; Run carries the Hypothesis ledger; depends on [[docs/design/hypothesis-and-idea-verdict]] landing |

Parallelism: S2 (browser) can start as soon as the S1 route contract and a
mock server exist; S3 and S4 can proceed in parallel with S2 and with each
other.

## S1 implementation notes

Choices where the text above left room (the code is authoritative):

- The snapshot, workspace, and project HTTP responses carry
  `actions: {enabled: true, token, tokenHeader, catalog}` only when the flag
  is set. Without the flag the key is absent (absent means disabled), so the
  default responses stay byte-identical. The offline `aq studio snapshot` never
  carries it.
- `X-Studio-Token` is required on every action and job route including GETs,
  because job tails are returned only to the page holding the token.
- A missing `Sec-Fetch-Site` header is accepted (non-browser clients such as
  `curl` and tests do not send it); a present value other than `same-origin`
  or `none` is refused.
- Preview `trial` is `{n, m, ...}`: `n` is this run's candidate-trial index in
  the Session and `m` the Project research family source-trial count after the
  run (the baseline counts), both read from the Core Session projection.
- The `preflight passed` precondition is not evaluated by Studio; `aq
  experiment evaluate` itself enforces it. Studio checks Session `active`,
  authority valid (not stale), and candidate differs from the leader.
- Job `stages` are whole-action (`pending`, `running`, then `done`, `failed`,
  or `skipped`) with `stageMode: "whole-action"`; no per-stage progress is
  invented.
- Output buffers keep the last 256 KiB per stream. The audit log lives under
  the served directory (`<root>/.autoquant/`).

## Candidate editor and session actions

Owner decision of 2026-11-01: the Factor page becomes an editor and result
workbench. The left pane edits the candidate factor source and a hypothesis;
`Run analysis` runs the existing evaluate flow; the right pane shows the
result. This section is the exact backend contract for that page. It extends
the catalog above with three actions and one read route. Names here are stable;
the code and tests follow this text.

This amends the non-goal "No browser-side code editing" and the catalog row
"Candidate code edit": a browser may now write exactly one file, the Session
candidate, through `candidate.save`, and nothing else. There is still no AI
rewrite, no apply-tuned-parameters, and no write to the canonical Project
source. Promotion of a KEEP into the Project stays `session.promote`, which is
not offered.

### Which file is the candidate

The candidate is `factors/candidate.py` inside the Session worktree:
`<project>/sessions/<session id>/worktree/<project id>/factors/candidate.py`
(`SessionContext.worktree_project.root_dir`). It is the file the checked-in
Judges import (`from factors.candidate import ...`) and it lies inside the
`factors/**` editable closure of the factor Studies. `candidate.save` and the
read route report a Session whose editable closure does not contain that path
as blocked. The Project's canonical `factors/candidate.py` is never touched.

### Common conventions

- Every route is under the existing Host allowlist. All `POST` routes and the
  action catalog require the `X-Studio-Token` header and the CSRF checks of the
  threat model. `GET /api/v1/candidate` is the exception described below.
- Envelope: `{"schemaVersion":1,"ok":true,"data":...}` or
  `{"schemaVersion":1,"ok":false,"error":{"code","message","issues":[{path,code,message}]}}`.
- `blockedBy` and `blockedReason` texts always start with `Blocked: ` and come
  from the server; the browser shows them verbatim.
- Request bodies may now be up to 1 MiB (`MAX_BODY_BYTES`), because a 200 000
  byte source can grow when JSON-escaped.
- `GET /api/v1/actions` lists the actions in this order: `experiment.evaluate`,
  `session.start`, `session.check`, `candidate.save`. Each entry keeps the S1
  shape (`id`, `label`, `classification`, `writes`, `command`,
  `timeoutSeconds`, `requiresSecondConfirm`, `params`, `targets`).
  `experiment.evaluate`, `session.check` and `candidate.save` have
  `targets[].sessions[] = {session, available, blockedBy}`;
  `session.start` has `targets[].studies[] = {study, available, blockedBy}`.
  `targets[].activeJob` is the active job id of the Project or `null`.

### `session.start`

| Field | Value |
| --- | --- |
| Label / classification | `Start Session` / `writes-immutable-evidence` |
| argv | `[python, -m, autoquant, session, start, <ws>, (--project <p> when the scope is a Workspace), --study <study>, (--request <abs path>), --json]` |
| params | `study`: string matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`, at most 64 characters (a Study id listed by the Project); `request` optional string, a path to an existing regular file confined to the served directory (`confine_workspace_path`; relative paths resolve from it) |
| Second confirmation | Yes (`requiresSecondConfirm: true`): starting a Session opens a trial family |
| Timeout | 900 s |
| Flow | exactly as `experiment.evaluate`: `POST /api/v1/actions/preview`, then `POST /api/v1/actions` with `confirm`, `commandHash`, `secondConfirm`; `202 {jobId, status, commandHash}` |
| Preview extra | `trial: {studyId, familyId, currentFamilyTrials, notice}`. `currentFamilyTrials` is `researchFamily.uniqueSourceTrials` of the Study's newest Run (the baseline counts), `0` and `familyId: null` when the Study has no Run yet. `notice`: `starting a Session opens a trial family; the baseline Run counts as one source trial unless an identical successful one is reused` |
| `createdRefs` | `sessionId`, `runId` (baseline), taken only from the child `--json` envelope |

Blocked reasons (`409 studio.blocked`, also in the catalog `blockedBy`):

- `Blocked: Study <study> already has active Session <sid>` when that Session's authority is valid.
- `Blocked: Study <study> has no editable research surface and does not support iterative Sessions`
- unknown Study: `422 validation.failed`, issue `params/study` `study.missing`.

The server does not predict whether the baseline can be established; Core
refuses a failing first-candidate preflight and the job fails with the Core
message in `stderrTail` and `result`.

A retained active Session whose authority is stale does not block a fresh
session.start. The Factor editor exposes this as Restart session, with the
same preview, command fingerprint, trial counts and second confirmation.
The new Session starts from the current canonical candidate. No prior Session,
candidate worktree or Run is rewritten or removed, and the family ledger remains
intact. A different valid active Session for the Study still blocks the start.

### `session.check`

| Field | Value |
| --- | --- |
| Label / classification | `Check candidate` / `writes-immutable-evidence` (an immutable non-selection Candidate Check record; no trial, no selection, promotion or trading authority) |
| argv | `[python, -m, autoquant, session, check, <ws>, (--project <p>), --session <sid>, --json]` |
| params | `session`: Session id, `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` |
| Second confirmation | No |
| Timeout | 600 s |
| Preview | same shape as evaluate without a trial: `trial: null`, `requiresSecondConfirm: false` |
| `createdRefs` | `checkId` |

Preconditions are identical to `experiment.evaluate` and produce the same
texts: `Blocked: Session <sid> is <status>, not active`,
`Blocked: Session <sid> is stale; run aq session show to see why (...)`,
`Blocked: Session <sid> candidate does not differ from the leader`. Core
requires an edited candidate before a Check, so the last text is the "edit the
candidate first" state of the editor.

### `candidate.save`

In-process and synchronous. It spawns nothing, creates no Job, spends no trial
and creates no evidence, so there is no second confirmation and no
`commandHash`.

| Field | Value |
| --- | --- |
| Label / classification | `Save candidate` / `writes-working-file` |
| `writes` | `Replaces factors/candidate.py in the Session worktree. Spends no trial and creates no evidence; the next Check or Run analysis evaluates the saved bytes.` |
| params | `session`: Session id; `source`: string, UTF-8 encodable, 1 to 200 000 bytes encoded, no NUL; `baseSha256`: 64 lowercase hex characters, the `sha256` the editor received from `GET /api/v1/candidate` (or from the previous save) |
| Request | `POST /api/v1/actions` body `{actionId:"candidate.save", project, params:{session, source, baseSha256}, confirm:true}`. `confirm` must be `true` (`400 studio.confirm-required` otherwise); `commandHash` and `secondConfirm` are ignored |
| Preview | `POST /api/v1/actions/preview` with the same body returns `{actionId, project, params:{session, baseSha256, sourceBytes, sourceSha256}, argv:null, display:"write <path>", commandHash:null, writes, requiresSecondConfirm:false, file:{path, currentSha256, currentBytes, newSha256, newBytes, changed}}` and writes nothing. The `source` text is not echoed |
| Success | `200 {actionId, project, session, path, sha256, bytes, previousSha256, previousBytes, changed}` where `path` is relative to the served Workspace with forward slashes, `sha256` and `bytes` describe the file as written, and `changed` is `false` when the bytes were already identical (nothing is rewritten) |
| Bytes | The source is encoded as UTF-8 and written exactly as given: no newline translation, no trailing newline added, no BOM added. `sha256` is the SHA-256 of those bytes |
| Atomicity | A temporary file in the same directory is written, flushed and `os.replace`d over the target; the temporary file is removed on any failure. Only `factors/candidate.py` is ever written |
| Conflict | If the SHA-256 of the file on disk differs from `baseSha256`: `409 studio.conflict`, message `The candidate on disk changed since it was loaded; reload before saving`, with `error.issues[0] = {path:"params/baseSha256", code:"candidate.conflict", message}`. The file is not touched. The browser must re-read with `GET /api/v1/candidate` |
| Errors | `422 validation.failed` for schema problems: issue codes `schema.object`, `schema.unknown-field`, `schema.session-id`, `schema.source` (not a string, empty, NUL, not UTF-8 encodable), `schema.source-size` (over 200 000 bytes), `schema.base-sha256`; `session.missing` for an unknown Session; `candidate.path` only as defence in depth when the resolved path leaves the Session worktree. `409 studio.blocked` and `409 studio.busy` as below. `500 studio.audit` if the audit log cannot be written (nothing is written first); `500 studio.write-failed` if the replace fails |
| Audit | Two lines in `.autoquant/studio-actions.jsonl`, joined by `saveId`: `{"event":"candidate-save-started","saveId","actionId":"candidate.save","project","session","path","beforeSha256","afterSha256","beforeBytes","afterBytes","tokenId","startedAt"}` before the replace, and `{"event":"candidate-save-finished","saveId","status":"saved"|"unchanged"|"failed","endedAt"}` after. The source text never appears in the log |

Blocked reasons (`409 studio.blocked`, also `blockedBy` in the catalog):

- `Blocked: Session <sid> is <status>, not active`
- `Blocked: Session <sid> is stale; run aq session show to see why (...)`
  (the authority check of `experiment.evaluate`; editing the candidate never
  makes a Session stale because the candidate is inside the editable closure)
- `Blocked: factors/candidate.py is not in the editable closure of Session <sid>`
- `Blocked: factors/candidate.py in the Session worktree is missing, a symlink or junction, or not a regular file`
  (when Core already reports the worktree as stale because of a symlink, the stale text above wins;
  a junctioned parent directory is refused by Core itself with `422 validation.failed` `path.escape`.
  In every case nothing is written)

`409 studio.busy` (`Project <p> already has active job <id>`) when a Studio job
is running for the Project. The slot is held while the write happens, so a job
cannot start mid-write.

### `GET /api/v1/candidate?project=<id>&session=<sid>`

Works with or without `--allow-actions`. It needs no token (it is a read like
other observation routes). The reserved `session=canonical` reference reads the
Project candidate for retained Runs without a Session. It is always read-only,
even with actions enabled, enforces the same byte limit and refuses linked or
escaped paths. It never authorizes a canonical save after a Run exists.

Session references work with or without actions (the route is a read like
`/api/v1/snapshot`); when actions are enabled the Host allowlist applies like
for every other route.

Success `200`:

```json
{"schemaVersion":1,"ok":true,"data":{
  "project":"factor-project","session":"session-...",
  "path":"projects/factor-project/sessions/session-.../worktree/factor-project/factors/candidate.py",
  "source":"SCORE = 1.0\n","sha256":"<64 hex of the raw bytes>","bytes":12,
  "editable":true,"blockedReason":null}}
```

- `path` is relative to the served Workspace, forward slashes (relative to the
  Project when the Project lives outside the served directory).
- `blockedReason` is a string exactly when `editable` is `false`, otherwise
  absent or `null`. It is the first applicable of:
  `Blocked: Studio is read-only; restart with --allow-actions to edit the candidate`,
  the Session and file reasons listed under `candidate.save`,
  `Blocked: candidate.py is larger than 200000 bytes`, and
  `Blocked: Project <p> already has active job <id>`.
- `source` is returned whenever the file is readable, also for closed
  Sessions and when actions are off, so the editor can render read-only.
- Errors: `422 validation.failed` (unknown Project, malformed or unknown
  Session id), `404 studio.candidate-missing` (no such file, or it is a
  symlink, junction or escapes the worktree), `422 candidate.not-utf8`,
  `413 candidate.too-large` (over 1 MiB; no source returned).

### Editor flow

1. `GET /api/v1/candidate` -> show `source`, keep `sha256`.
2. User edits. `POST candidate.save` with `baseSha256` = last known `sha256`;
   on `200` store the returned `sha256` as the new base. On `409
   studio.conflict` reload and ask the user.
3. `session.check` (preview, create, poll the job) is optional.
4. `experiment.evaluate` as in S1, with the hypothesis from the right pane.
   Evaluate and Check read the file on disk, so unsaved editor text is never
   evaluated. The UI must save first.
5. `session.start` creates the Session when the Study has none; the page then
   switches to it.

## Open questions

Each has a proposed default so work is not blocked; the owner overrides by
saying so.

| Question | Proposed default | Provenance |
| --- | --- | --- |
| Should `--allow-actions` ever be the default? | No. Opt-in per server start, banner states it | Keeps the observation-surface invariant true by default; threat model above |
| Should Studio append a tag to the Experiment `--hypothesis` text to mark Studio runs? | No. Join through the audit log by Experiment id | Adding text changes the Core record; the owner decision is no new write path in Core |
| Second confirmation scope | Required for `project.intake`, `session.start`, `experiment.evaluate`, `report.publish`, `session.complete`; not for `project.create`/`session.check`; `data.check` needs no confirmation | Intake binds Project data authority; research actions retain their existing gates |
| Timeout for `experiment.evaluate` | 15 minutes, per action override in the catalog | Reference product saw a factor analysis finish in 6 seconds; ours includes a Study currentness check and test audit, so a generous cap with cancel |
| One job per Project or per Workspace | Per Project | Matches the Project-family trial count unit; Projects are self-contained |
| Where is the "New idea" text stored before Hypothesis objects exist? | As the Project `--description` of an `ohlcv-factor-lab` Project | Reuses `aq project create`; no new object |
| Job persistence across server restarts | None; audit log only | Core evidence is already durable; telemetry stays small |
| Windows support for process-tree cancel | Use `CREATE_NEW_PROCESS_GROUP` and `taskkill /T /F` fallback | The owner's host is Windows; verify in the end-to-end test on this platform |
| Should an `Agent` be able to call the actions API? | No. Agents use the `aq` CLI directly; the token exists only in the browser bootstrap | Agents already have the CLI contract ([[docs/design/agent-cli-contract]]); the API is for the human surface |
