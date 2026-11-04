# OpenAlice hosting

OpenAlice runs Harness web applications under the vendor-neutral `HARNESS_*`
contract (its `docs/harness-web-surfaces.md`). AutoQuant V3 follows the
implementation upstream AutoQuant V2 shipped in 0.9.32-0.9.34, merged into V3
as Git history so a desk on V2 0.9.34 can merge a V3 release.

The contract itself is owned by upstream's documents; this note does not
restate it:

- launch resolution, port/host authority and response headers:
  [[docs/design/studio-observation-surface]] ("Harness capability launch",
  "Web origin and proxy boundary");
- operator view and the reproducible managed command: [[docs/STUDIO]]
  ("Harness-managed launch");
- manifest version agreement and source Workspace preparation:
  [[docs/design/versioning-and-release]];
- history: [[plans/openalice-harness-studio-capability]],
  [[plans/generic-harness-web-surface]],
  [[plans/prepared-source-workspace-harness-command]].

## V3 additions

- The snapshot gains an optional `host` object, present only under managed
  launch: `{"kind": "harness", "capability": "studio"}`. Standalone snapshots
  are unchanged. It is derived from the same explicit `managed` process state
  as the response headers, never from the request. The workspace summary
  (`/api/v1/workspace`) passes it through, and the studio-app reads it to hide
  the in-process Assistant: rail and tab entry, the "Ask Assistant" button and
  the Assistant route, which shows a short read-only note instead.
- `--allow-actions` is not part of the manifest command. A host that adds it
  gets V3's local action layer, whose Host/Origin checks expect the loopback
  origin, so actions are not expected to work behind an opaque proxy origin.

## Superseded

V3 commit `6599166` had its own `autoquant/studio_host.py`. It was removed
when upstream 0.9.34 was merged. Differences resolved in upstream's favour:
`HARNESS_HOST` is required (no `127.0.0.1` default); only `localhost` or IPv4
`127.0.0.0/8` is accepted (`::1` is refused); `HARNESS_PORTS` must name exactly
`http` (extra names fail) and duplicate keys fail; browser suppression follows
`--no-open` or `HARNESS_NO_OPEN=1` rather than always being forced; conflicting
`--host`/`--port` are validation errors (exit 1), not usage errors (exit 2);
managed responses allow restricted framing; the snapshot marker kind is the
vendor-neutral `harness`, not `openalice`.
