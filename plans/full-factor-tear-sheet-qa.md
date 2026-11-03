# Factor tear-sheet UI verification

- Instance: local read-only Studio, caller-specified scratch Workspace
  `D:/tmp/tearsheet/ws`, port 8971. Server PIDs were recorded in scratch;
  only task-owned PIDs were stopped. No process image name was used.
- Driver: adapted caller-provided `D:/tmp/redundancy/proof-shots.cjs`, existing
  Playwright installation and installed Edge; no browser/package installation.
- Viewport: 1440 x 900 CSS pixels; Chinese default, one English screenshot.
- Public route: Factor workbench, final Study/Run, Evidence tab.
- Expected: six figures with all five groups, published values, explicit no-cost
  state and test-audit gating. Observed: six actual SVGs, captions/data tables,
  validation by default, test-audit control selects and persists, zero console
  or page errors. The static tests also prove sealed audit values never enter
  captions, tables or controls.
- Screenshots: `tear-sheet-top-zh.png`, `tear-sheet-figure-1-zh.png` through
  `tear-sheet-figure-6-zh.png`, `tear-sheet-test-audit-zh.png`, `tear-sheet-en.png`,
  `tear-sheet-old-not-published-zh.png`. Images were inspected, including group
  bars, IC decay, English localization and the historical absence state.
- The first capture attempt scrolled the outer document. The retained final
  driver scrolls only the existing workbench pane, preserving the full shell.
- Historical control Run: `run-20261103T003006895130Z-6e62c94e5f3f`.
  The evidence says its Judge did not publish the artifact; no error or
  browser-side reconstruction appears.
- Functional and component conformance checks passed; owner visual acceptance
  has not been claimed or recorded. Existing surrounding untranslated server
  status text is outside the new section.
- The supplied dataset is synthetic, not authenticated market data. Screenshots
  prove presentation of actual immutable Run evidence, not market validity.
