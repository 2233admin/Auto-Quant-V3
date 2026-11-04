# OpenAlice hosting

OpenAlice runs Harness web applications under the vendor-neutral `HARNESS_*`
contract (its `docs/harness-web-surfaces.md`). This note records how AutoQuant
V3 meets it. OpenAlice itself is adapted separately.

## Decisions

- `harness.json` (Manifest v1) lives at the repository root. Its `version` must
  equal `pyproject.toml`'s project version; `tests/test_studio_host.py` asserts
  this. The release process bumps both.
- The single `studio` capability runs
  `uv run --frozen --no-sync aq studio serve . --no-open` with entry port `http`
  and readiness path `/api/v1/health` (already served, no workspace scan).
- `autoquant/studio_host.py` resolves the contract. Hosted mode is exactly
  `HARNESS_CAPABILITY=studio`; any other value keeps standalone behaviour.
  Hosted mode requires `HARNESS_PORTS` to be a JSON object with an integer
  `http` port in 1..65535, otherwise `aq` exits 1 with the reason. There is no
  fallback to 8765 and no port scanning. `HARNESS_HOST` defaults to
  `127.0.0.1` and must be loopback.
- Hosted mode never opens a browser, whether or not `HARNESS_NO_OPEN` is set.
  Explicit `--host`/`--port` that differ from the injected values exit 2.
- The snapshot gains an optional `host` object, present only when hosted:
  `{"kind": "openalice", "capability": "studio"}`. Standalone snapshots are
  unchanged. The kind is fixed because OpenAlice is the only supervisor today.

## Out of scope

Trial ledger, handoff.json, OpenAlice bars, version bump and UI changes (the
Studio will read `host` later to hide the Assistant).
