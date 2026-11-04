# Shinka research layer in AutoQuant V3

Ported directly from `shinka/research/` of the 2233admin/ShinkaEvolve fork (commit `a43eb89`). Design docs in this
directory (`design.md`, `roadmap.md`, `workspace.md`, `autoscientist-survey.md`) are verbatim copies and still talk
about `shinka_research` / `shinka/research`; read those as `aq shinka` / `autoquant/shinka_research`.

| Source | Target |
|---|---|
| `shinka/research/*.py`, `domains/` | `autoquant/shinka_research/` |
| `shinka/research/webui/dist/` (built UI) | `autoquant/shinka_research/webui/dist/` |
| `shinka/research/webui/app`, `analysis`, design docs (UI source) | `studio-shinka/` |
| `tests/research/` | `tests/shinka_research/` |
| `examples/quant_research/` | `examples/shinka_quant_research/` |
| `docs/research/` | `docs/shinka-research/` |

## Install and run

```
uv sync --extra shinka                      # research layer: init, hypothesis, scaffold, skeptic, verdict, library, brief, status
uv sync --extra shinka --extra shinka-engine # plus runs, lockbox/PBO cost reads, `aq shinka ui`
uv run aq shinka --help
```

`shinka-engine` resolves to the fork (`[tool.uv.sources]`, pinned rev) because the research layer needs
`shinka.database.cost`, which upstream `shinka-evolve` on PyPI does not have. Commands that need the engine raise
`EngineNotInstalled` with the install hint; the engine is imported lazily (`autoquant/shinka_research/_engine.py`).

## Web UI

The server (`ui.py`) serves the prebuilt bundle in `autoquant/shinka_research/webui/dist/`. To rebuild from
`studio-shinka/app` (`pnpm install && pnpm build`), output must be copied back to that `dist/`. Folding these pages
into `studio-app/` is a later step.

## Tests

`uv run --extra shinka --group shinka-test pytest tests/shinka_research -q`. Tests needing the engine skip when
`shinka` is absent. Node tests of the UI skip without `pnpm install` in `studio-shinka/app`.

Only edit to the copied docs: literal double-bracket wikilink examples were reworded (the V3 documentation gate resolves them as links).
