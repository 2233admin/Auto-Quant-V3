# Prepared source Workspace Harness command

- Status: `completed`
- Target release: `0.9.34`
- Updated: `2026-08-22`
- Related design: [[docs/design/studio-observation-surface]],
  [[docs/design/agent-native-quant-workbench]], and
  [[docs/design/versioning-and-release]].

## Outcome

Make a documented, independently prepared AutoQuant source Workspace execute
its checked-in Harness Studio command under an ordinary supervisor PATH, while
requiring managed listeners to remain on an explicitly supported loopback host
and preserving every standalone launch path.

## Context

Real OpenAlice acceptance of `v0.9.33` found that `uv sync --frozen` installs
`aq` at `.venv/bin/aq`, but the manifest invokes bare `aq` and a normal parent
supervisor does not inherit that directory in `PATH`. Upstream subprocess tests
masked the defect by prepending the test interpreter directory. The same
acceptance also found that managed host validation accepted wildcard and public
addresses despite the loopback-only Harness contract. The defects are tracked
in [GitHub issue #2](https://github.com/TraderAlice/Auto-Quant-V2/issues/2).

## Scope

### In scope

- Keep standalone clone preparation and use owned by AutoQuant: Python 3.11,
  `uv sync --frozen`, and ordinary `uv run aq ...` commands must work without
  OpenAlice.
- Make `harness.json.command` enter the prepared project environment through
  `uv run --frozen --no-sync`, without a shell, venv activation, PATH mutation,
  lock update, or dependency synchronization at capability start.
- Accept only `localhost` or canonical IPv4 loopback literals in managed mode;
  reject wildcard, interface/public, arbitrary hostname, IPv6, whitespace, and
  malformed host authority before server construction.
- Remove test-only `.venv/bin` PATH injection and prove the literal manifest
  command from a prepared source Workspace under an ordinary parent PATH.
- Preserve exact ports, readiness, restricted embedding, browser suppression,
  process cleanup, and standalone non-loopback operator flags.

### Out of scope

- OpenAlice source changes, supervisor-side environment activation, automatic
  dependency installation, IPv6 server support, public-origin/base-path
  contracts, or Studio UI changes.
- The separately proposed tiered-test feedback work, now targeted to `0.9.35`.

## Acceptance

- [x] A clean source Workspace prepared only with documented AutoQuant commands
  passes `aq` orientation/validation/Studio use independently of OpenAlice.
- [x] The literal manifest argv starts after `uv sync --frozen` under an
  ordinary parent PATH with no `.venv/bin` insertion and reaches truthful HTTP
  readiness on the exact injected port.
- [x] Missing preparation fails clearly without supervisor repair, while the
  launch command cannot update the lock or synchronize dependencies.
- [x] Managed `127.0.0.1`, another canonical `127/8` literal, and `localhost`
  resolve; `0.0.0.0`, public/interface addresses, arbitrary names, IPv6, and
  malformed values fail before bind.
- [x] Standalone defaults, explicit host/port/browser behavior, security headers,
  current-origin assets, managed embedding, occupied-port failure, and SIGTERM
  cleanup remain unchanged.
- [x] Focused tests, complete source audit, build/install, clean-clone replay,
  immutable `v0.9.34` tag, and remote SHA verification pass.

## Work

- [x] Update the manifest argv and strict managed-host resolver.
- [x] Replace PATH-assisted subprocess coverage with ordinary-parent-PATH source
  Workspace acceptance and focused negative cases.
- [x] Update durable Studio, CLI, operator, architecture, status, and release
  documentation without expanding README workflow detail.
- [x] Complete the full release and installed-artifact audit, publish the tag,
  verify remote parity, and close issue #2 with exact evidence.

## Findings and decisions

- 2026-08-22 — A fresh `v0.9.33` clone prepared with `uv sync --frozen`
  returned status 127 for bare `aq` under an ordinary parent PATH, while
  `uv run aq` returned `aq 0.9.33`. The test suite had explicitly prepended
  `.venv/bin` before executing the manifest.
- 2026-08-22 — `uv run --frozen --no-sync` is the capability boundary: `uv`
  selects the repository-owned prepared environment, `--frozen` forbids lock
  updates, and `--no-sync` forbids launch-time dependency synchronization.
- 2026-08-22 — Managed v1 intentionally supports IPv4 loopback and `localhost`
  only. The current `ThreadingHTTPServer` is IPv4; accepting `::1` in the
  resolver would advertise a bind mode the actual Server does not implement.
  Standalone explicit bind authority is unchanged.

## Verification

- `python -m py_compile autoquant/studio.py tests/test_studio.py tests/test_version.py`
- `python -m unittest tests.test_studio tests.test_version` — 21 tests passed
  in 39.765 seconds, including a copied source Workspace prepared with only
  `uv sync --frozen` and launched through the literal manifest argv under an
  ordinary parent `PATH`.
- `python scripts/check_doc_links.py` — all 1,571 documentation links resolve.
- Candidate version reconciliation: `uv lock --check`, `uv sync --frozen`, and
  the 21 focused tests pass in 33.305 seconds at product version `0.9.34`; all
  1,572 documentation links resolve.
- Complete source audit: `uv lock --check`, Python compilation, Studio
  JavaScript syntax, diff hygiene, documentation-link verification, and all
  465 unit/integration tests passed; the full suite completed in 1,165.336
  seconds.
- Clean candidate `0cd3d2835333ecabf0238d9a3090d6f47b14a971` built and
  installed under Python 3.11.14. The wheel reports version `0.9.34`, that
  exact commit, `dirty: false`, `embedded-distribution`, and runtime source
  hash `f018f00363e9e3ea7500887c1e33a8a17882a8c67f7bce63ae1d474915782138`.
  It contains 185 entries with no missing Studio, Project-template, or
  Workspace-Skill runtime asset.
- Candidate artifact SHA-256 values are
  `e379572f2e091872365679e1d65f13a0b9c665641398a05bf9667286bfd35999`
  for the wheel and
  `42d43209b0e7e9f4e3446c0f2b171a6edd1676254ff05a4776c039db757dd767`
  for the sdist.
- A no-hardlink clone with no local override passed frozen preparation,
  version/capability discovery, Project listing, orientation, validation, and
  Studio snapshot through both its source environment and the freshly
  installed wheel.
- The literal manifest argv served health, root, assets, and snapshot on the
  exact injected loopback port behind an opaque `oa-surface-v0934.localhost`
  Host; emitted only the restricted managed framing policy; ignored supplied
  host credentials; and released the listener after SIGTERM. Standalone
  framing remained strict. Occupied port and wildcard host failed closed, and
  an unprepared clone failed clearly without installing `aq`.

## Progress log

- 2026-08-22 — Reproduced issue #2 from the immutable `v0.9.33` tag, reviewed
  the generic Harness contract and acceptance matrix, and activated this
  fix-forward plan.
- 2026-08-22 — Replaced the bare manifest executable with frozen, no-sync `uv`
  environment entry; restricted managed hosts to `localhost` and IPv4 loopback;
  and added real prepared-source, missing-preparation, host-authority, readiness,
  embedding, and process-release regressions.
- 2026-08-22 — Documented AutoQuant-owned source preparation, literal
  supervisor execution, managed host authority, and unchanged standalone
  behavior across the Studio, CLI, operator, architecture, and product-model
  contracts.
- 2026-08-22 — Reconciled every product-version authority at `0.9.34` and
  refreshed the repository-owned editable environment before the release
  audit.
- 2026-08-22 — Completed the one release-level source audit with all 465 tests
  passing, including the ordinary-parent-PATH source copy, exact managed bind,
  security policy, process cleanup, and standalone regressions.
- 2026-08-22 — Built and installed the candidate, replayed standalone commands
  in a clean no-override clone, and completed the exact manifest HTTP,
  restricted-host, occupied-port, browser/security, missing-preparation, and
  process-release acceptance matrix.

## Completion

AutoQuant `0.9.34` remains a complete independently operable quantitative
research Workspace and fixes the source-managed Studio boundary without
turning the product into an OpenAlice plugin. AutoQuant owns frozen runtime
preparation, Core, CLI, Studio, and research evidence. A compatible supervisor
discovers the checked-in manifest, supplies only supported loopback process
authority, waits for truthful readiness, routes the existing Web Surface, and
owns process teardown. No OpenAlice SDK, launch-time dependency sync, PATH
mutation, UI change, research-semantic change, or fixture rewrite was added.
