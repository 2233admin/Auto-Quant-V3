# Generic Harness Web Surface

- Status: `completed`
- Target release: `0.9.33`
- Updated: `2026-08-22`
- Related design: [[docs/design/studio-observation-surface]],
  [[docs/design/agent-native-quant-workbench]], and
  [[docs/design/versioning-and-release]].

## Outcome

Make the existing AutoQuant Studio a vendor-neutral Harness Web Surface that
binds exact supervisor-assigned loopback authority, remains origin-neutral and
restrictively embeddable while managed, and preserves the unchanged standalone
Studio security and launch contract.

## Context

`v0.9.32` proved manifest discovery, fixed-port launch, readiness, and browser
suppression, but named its injected environment after OpenAlice and retained
unconditional anti-iframe headers. The Harness v1 contract now standardizes
`HARNESS_*` authority for any compatible supervisor and requires a narrow
managed-only embedding policy. AutoQuant owns its foreground HTTP process and
read-only routes; the supervisor owns allocation, routing, product chrome, and
public origin.

## Scope

### In scope

- Preserve the exact manifest v1 shape and one `http` entry port.
- Activate managed mode only for exact `HARNESS_CAPABILITY=studio`, require
  `HARNESS_HOST`, and require `HARNESS_PORTS` to match the manifest port set
  exactly.
- Bind the exact injected endpoint, reject conflicts and occupied ports, honor
  `HARNESS_NO_OPEN=1`, and retain foreground process ownership and cleanup.
- Pass managed state explicitly into response-header construction, retaining
  strict standalone anti-frame protection and using only the required managed
  `frame-ancestors` allowlist.
- Verify root, packaged assets, health/snapshot APIs, current-origin frontend
  references, opaque `oa-surface-*.localhost` Host handling, and SIGTERM port
  release with real subprocesses.

### Out of scope

- OpenAlice source changes, an OpenAlice SDK, a generic proxy, base paths,
  public-origin negotiation, UI changes, authentication, new SSE/WebSocket
  features, or a second listener.
- The separately proposed tiered-test runner, now targeted to `0.9.34`.

## Acceptance

- [x] `harness.json` remains manifest v1, declares only `studio.http`, and its
  version agrees with every `0.9.33` product-version authority.
- [x] Exact `HARNESS_CAPABILITY=studio` launch is fail-closed, binds only the
  injected host/port, suppresses browser opening when directed, and rejects
  incomplete, extra, invalid, conflicting, or occupied authority.
- [x] Managed HTTP responses omit X-Frame-Options and same-origin CORP and use
  only the required restricted `frame-ancestors`; standalone responses retain
  all prior strict headers.
- [x] A real manifest-command subprocess serves root, assets, health, and
  snapshot APIs under an opaque localhost Host, reaches truthful readiness,
  takes no fallback port, and releases its process and port after SIGTERM.
- [x] Frontend runtime references remain same-origin and no internal bind
  address, cookie, authorization, CSRF, redirect, SSE, or WebSocket dependency
  is introduced.
- [x] Focused, documentation, complete source, build/install, and clean-clone
  release checks pass before `v0.9.33` is tagged at the immutable release SHA.

## Work

- [x] Replace the vendor-specific launch resolver with strict manifest-matched
  `HARNESS_*` authority while preserving standalone isolation.
- [x] Split standalone and managed security headers and thread managed state
  explicitly through CLI, server creation, and request handling.
- [x] Add bounded unit and real-subprocess acceptance coverage, including
  opaque Host routing and SIGTERM cleanup.
- [x] Update durable Studio/CLI/operator/architecture/version documentation and
  prepare the patch-version authorities.
- [x] Complete the full release audit, installed artifact replay, tag, push,
  and remote SHA verification.

## Findings and decisions

- 2026-08-22 — Studio currently uses only same-origin root-relative HTTP assets
  and snapshot polling. It has no SSE or WebSocket route, so acceptance covers
  every actually used transport and records those protocols as absent rather
  than adding unused infrastructure.
- 2026-08-22 — The shipped `OPENALICE_*` variables are not retained as aliases:
  the generic contract says only exact `HARNESS_CAPABILITY=studio` activates
  managed mode, and permanent dual parsing would make launch authority
  ambiguous before another host contract has shipped.
- 2026-08-22 — macOS retains closed client connections briefly in `TIME_WAIT`.
  SIGTERM acceptance therefore proves both that the listener rejects new
  connections and that a fresh Studio-style `SO_REUSEADDR` listener can bind
  the same endpoint immediately; it does not confuse connection bookkeeping
  with an owned process or listening-socket leak.

## Verification

- Source candidate `0dbf6836e4753a5f2d1f9f6adde608fe451c1625` was clean
  before the complete audit.
- `uv lock --check`, Python compilation, Studio JavaScript syntax, and
  `git diff --check` passed.
- `uv run python scripts/check_doc_links.py` resolved all 1,567 documentation
  links.
- `uv run python -m unittest discover -s tests -v` passed all 464 tests in
  1,239.939 seconds. The existing bounded RL empty-slice NumPy/Pandas warnings
  were the only warnings; no checked-in Project or immutable Run changed.
- Candidate `bbef315431410354ebaf505a404c9aa583cc43cb` built and installed
  cleanly under Python 3.11.14. The wheel records version `0.9.33`, that exact
  clean commit, `embedded-distribution`, and runtime source hash
  `c464af8d4afb2ae7700041c9a67889cb4585d75c2c470a73819a2f6ee62c34fe`.
- Candidate artifact SHA-256 values are
  `1e98c3fe5421b2b55008b650f6f02bb23f2ae2425d2c3749c7c14e3d2c715533`
  for the wheel and
  `5ac0fa9059c28ed0bb2a8dd85a00fd44f53ec6df7650f5cab491cce77ebe7461`
  for the sdist. The wheel contains 185 entries, including Studio source and
  all packaged assets, Project templates, and Workspace Skills required by
  the public runtime.
- The installed CLI in a no-hardlink clone with no local Workspace override
  passed `version`, capability discovery, `orient`, `validate`, Project list,
  and Studio snapshot checks with the same embedded identity.
- The installed manifest command served root, CSS, JavaScript, snapshot, and
  health through `oa-surface-v0933.localhost`, emitted only the restricted
  managed framing policy, ignored supplied host credentials, exposed no
  redirect, and released its listener after SIGTERM. Standalone headers
  retained their exact strict policy. An occupied injected port failed in
  1.798 seconds without stdout or fallback, and an explicit port conflict
  failed closed.
- The completion-only documentation commit is rebuilt and replayed outside the
  repository before the tag is created; publication proceeds only if that
  final artifact retains the same runtime hash and all remote branch/tag SHAs
  agree.

## Progress log

- 2026-08-22 — Read the Harness Web Surface v1 contract and acceptance matrix,
  inspected the real manifest, launcher, response headers, frontend URL use,
  readiness route, and current subprocess tests, then activated this plan.
- 2026-08-22 — Implemented generic launch authority, explicit mode-specific
  response policies, and real foreground-process tests. All 20 Studio/version
  focused tests pass in 16.654 seconds.
- 2026-08-22 — Prepared all `0.9.33` version authorities and durable operator,
  CLI, architecture, and Studio contract documentation. The versioned focused
  replay passes 20 tests in 17.775 seconds and all 1,567 documentation links
  resolve.
- 2026-08-22 — The clean complete source audit passed all 464 tests in
  1,239.939 seconds with no sample or immutable-evidence changes.
- 2026-08-22 — A fresh installed wheel and no-override clone passed runtime
  closure, identity, Workspace, exact managed Surface, standalone security,
  occupied-port, conflict, and SIGTERM acceptance.

## Completion

AutoQuant `0.9.33` ships one vendor-neutral Harness v1 Studio capability. It
accepts only exact generic managed authority, remains current-origin and
foreground-owned, relaxes framing only to the fixed managed ancestor allowlist,
and preserves standalone launch and anti-frame security. No OpenAlice SDK,
host-specific manifest field, public-origin/base-path protocol, proxy, UI
change, SSE, WebSocket, research-semantic change, or fixture rewrite was added.
The separately proposed tiered-test feedback work remains targeted to `0.9.34`.
