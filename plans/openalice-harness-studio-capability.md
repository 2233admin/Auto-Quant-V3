# OpenAlice Harness Studio capability

- Status: `completed`
- Target release: `0.9.32`
- Updated: `2026-08-21`
- Related design: [[docs/design/studio-observation-surface]],
  [[docs/design/agent-native-quant-workbench]], and
  [[docs/design/versioning-and-release]].

## Outcome

Let OpenAlice discover and launch the existing AutoQuant Studio through the
standard Harness capability manifest while preserving the unchanged standalone
Studio command and keeping HTTP ownership and lifecycle inside AutoQuant.

## Context

Studio already owns a loopback HTTP server, a successful
`/api/v1/health` identity response, browser suppression, and exact local bind
arguments. OpenAlice now needs one repository-root declaration and a strict
host-assigned port path. The current CLI parser erases whether `--host` or
`--port` was explicitly supplied, so it cannot yet reject only real conflicts
between caller arguments and injected authority.

## Scope

### In scope

- Add strict repository-root `harness.json` manifest version 1 with one Studio
  capability and the canonical AutoQuant product version.
- Activate hosted resolution only for `OPENALICE_CAPABILITY=studio`; strictly
  validate the injected host and named `http` port, reject conflicting explicit
  CLI arguments, and force no-browser behavior when requested.
- Preserve standalone defaults, explicit flags, and port-zero test allocation.
- Prove exact fixed-port binding, occupied-port failure, browser suppression,
  health readiness, version parity, and non-hosted environment isolation.

### Out of scope

- OpenAlice SDKs, generic capability/plugin/process abstractions, process graph
  ownership, Studio UI changes, remote serving, or host-side implementation.

## Acceptance

- [x] `harness.json` exactly declares the Studio command, named port, entry
  port, readiness path, manifest protocol, and current product version.
- [x] Hosted mode fails closed for missing or malformed port authority and
  binds only the injected host and integer port without probing alternatives.
- [x] Explicit conflicting host/port flags fail, no-open authority is obeyed,
  and unrelated or absent capability environments preserve standalone behavior.
- [x] A real subprocess launched on a test-assigned loopback port answers a
  successful health request identifying `autoquant-studio`.
- [x] Focused tests, documentation links, complete regression, build/install
  smoke, clean Workspace replay, tag, and canonical push pass for `v0.9.32`.

## Work

- [x] Audit current manifest/version, CLI argument, HTTP bind, browser, health,
  and standalone contracts.
- [x] Implement the manifest and narrow hosted launch resolver with tests.
- [x] Update the owning Studio, CLI, operator, architecture, and product-model
  documents, then update current status and release metadata in the late bump.
- [x] Bump to `0.9.32`, reconcile generated identity, run the release audit,
  publish the annotated tag, and verify remote branch/tag parity.

## Findings and decisions

- 2026-08-21 — The current health route already returns HTTP 200 with
  `service: autoquant-studio`; readiness requires no new server protocol.
- 2026-08-21 — Standalone port `0` remains valid for OS allocation. Hosted
  injected ports are stricter and must be in `1..65535`.
- 2026-08-21 — CLI parser defaults will become unresolved `None` values only
  internally so explicitness survives parsing; public standalone defaults stay
  `127.0.0.1:8765` and capability discovery continues to describe them.
- 2026-08-21 — Capability activation is exact. Stale or unrelated OpenAlice
  variables cannot mutate ordinary Studio launch, and no host process metadata
  enters quantitative Core or the Studio snapshot.

## Verification

- Focused Studio/version/documentation suites pass 18 tests, including a real
  managed subprocess, exact loopback readiness identity, occupied-port
  failure, browser suppression, malformed authority, conflicts, and unchanged
  standalone behavior. The complete CLI contract passes all 26 tests.
- Lock consistency, Python compilation, Studio JavaScript syntax, diff
  hygiene, and all 1,562 final documentation links pass. The complete source
  regression passes all 460 tests in 1,161.458 seconds. The only warnings are
  the existing NumPy/Pandas empty-slice diagnostics inside a passing governed
  RL edge-case test.
- Clean candidate commit `7d14046` built wheel SHA-256
  `c952e076080fde812daf4a4e6b20e979bee4db7a90b4e8236943a7a0ab906124`
  and sdist SHA-256
  `cfb03b7cf6ad2ee02246656745807229bc567f5121e1c2b31cd001b20237e8db`.
  A fresh Python `3.11.14` environment reports version `0.9.32`, clean
  embedded commit `7d140462ed4305039076d1c29d8a35431cd0d184`, source hash
  `815bcdf2d74888f90b21f5cf8156c7ed65dbee7650d0dc6003a165ae4834b651`,
  all 59 commands, all 16 Skills, all 39 Project template files, and packaged
  Studio assets.
- A no-hardlink clean clone has no local override, selects the sample Project,
  and passes installed-wheel orientation, validation, Project listing, and
  Studio snapshot identity. The exact manifest command started on injected
  port `56695`; health returned HTTP 200 with `service:
  autoquant-studio`. An occupied injected port `56699` and explicit conflict
  both exited 1, while standalone port-zero launch ignored unrelated OpenAlice
  environment noise.

## Progress log

- 2026-08-21 — Plan activated from clean `main` at `0913ebd`; no OpenAlice
  repository change is in scope.
- 2026-08-21 — Added the manifest, strict resolver, CLI handoff, fail-closed
  validation, real-port readiness/occupation tests, and durable hosted launch
  documentation. The focused version/Studio suite passes 16 tests.
- 2026-08-21 — The complete 26-test CLI contract passes unchanged. Advanced
  package, lock, Harness manifest, README pointer, STATUS, and CHANGELOG to the
  `0.9.32` release candidate; final release verification remains.
- 2026-08-21 — The final source audit passes all 460 tests. Build/install,
  clean-clone, and installed managed-launch replay remain before publication.
- 2026-08-21 — Clean build/install, package closure, no-override clone, exact
  managed launch/readiness, occupied-port, conflict, and standalone-isolation
  replay pass. The separate test-latency issue is recorded in
  [[plans/tiered-test-feedback]] rather than expanding this release.

## Completion

Completed on 2026-08-21. AutoQuant now exposes its existing Studio through one
standard repository Harness capability and consumes exact host-assigned launch
authority only under the explicit Studio marker. Standalone behavior, HTTP
ownership, UI, quantitative Core, and research evidence remain unchanged. All
focused, complete-source, build/install, package, clone, readiness, strict-port,
and publication audits pass for `v0.9.32`.
