# Shinka research layer in AutoQuant V3

Ported directly from `shinka/research/` of the 2233admin/ShinkaEvolve fork (commit `a43eb89`). Design docs in this
directory (`design.md`, `roadmap.md`, `workspace.md`, `autoscientist-survey.md`) are verbatim copies and still talk
about `shinka_research` / `shinka/research`, a direction directory and the fork's own web UI; read those as
`aq shinka` / `autoquant/shinka_research`, a Project, and Studio (below).

| Source | Target |
|---|---|
| `shinka/research/*.py`, `domains/` | `autoquant/shinka_research/` |
| `tests/research/` | `tests/shinka_research/` |
| `examples/quant_research/` | `examples/shinka_quant_research/` |
| `docs/research/` | `docs/shinka-research/` |
| `shinka/research/webui/` (built UI, app source, analysis pages) | removed; redrawn natively in Studio |

## A direction is a Project (owner decision, 2026-11-05)

A Shinka research direction is an AutoQuant Project. Its hypotheses, experiments, results ledger, verdicts and
skeptic/lockbox/PBO outcomes belong to the Project; there is no separate Shinka workspace. The Shinka modules keep
their file formats unchanged; only the root they are given changed (`autoquant/shinka_research/project.py`):

```
<workspace>/
  library/                         Workspace-level raw -> wiki -> log library (Shinka format)
    raw/  wiki/  index.md  log.md  manifest.json
  projects/<id>/
    autoquant.json  research.md ...    the ordinary Project
    research/                          the Shinka notebook of this Project
      notebook.json  program.md  results.tsv  ledger.json  run-log.tsv  CONFIRMATION.md
      hypotheses/<hid>.md
      experiments/<hid>/<eid>/task/ results/ skeptic.md best_program.py
      data/dev.csv                     development split (market data, git-ignored)
      .gitignore                       data/, locks, leases, cursors, SQLite journals
```

- `research/` sits beside the Project brief `research.md`; the brief stays the caller-facing English research
  question, the notebook is the Shinka loop's machine state.
- The library stays one per Workspace, as in Shinka (one library shared by every direction). It is not the Studio
  Factor/Strategy library: those are cross-Project lists of verified Run evidence (`autoquant/studio_library.py`),
  this one is a knowledge base of sources and compiled pages. Studio shows it as a section of the Library area.
- Experiment results (`programs.sqlite`, plots, `skeptic.md`) are research evidence like Runs; only `data/` and
  transient lock/lease/journal files are ignored.
- The notebook's sealed tail is still Shinka's lockbox, opened once by `aq shinka confirm`. It is not yet the V3
  sealed tail of [[docs/design/hypothesis-and-idea-verdict]]; that design's H11-H14 own the Core version.

## Commands

Every `aq shinka` command takes the direction as `dir`, resolved in this order:

1. `<workspace> --project ID` (or a Workspace alone: its default Project);
2. a Project directory, or that Project's `research/` directory;
3. a bare Project id when the current directory is a Workspace (`aq shinka status momentum-desk`);
4. anything else is a bare direction directory with its library at `../library` (the fork's layout; kept because
   it costs nothing and the ported tests use it).

`aq shinka init <dir> --direction TEXT` attaches research state to an existing Project (it refuses a Project that
already has a notebook). `aq shinka init <workspace> --project ID --create-project --direction TEXT` first creates the
blank Project through V3's own creation path (`create_project`, as `aq project create --template blank`), with the
direction as its description. `aq shinka library ...` given a Workspace works on its library; `aq shinka watch` given
a Workspace visits every Project with research and prints the Project id.

## Install and run

```
uv sync --extra shinka                      # research layer: init, hypothesis, scaffold, skeptic, verdict, library, brief, status
uv sync --extra shinka --extra shinka-engine # plus runs, lockbox/PBO and cost reads, Studio research pages with trial data
uv run aq shinka --help
```

`shinka-engine` resolves to the fork (`[tool.uv.sources]`, pinned rev) because the research layer needs
`shinka.database.cost`, which upstream `shinka-evolve` on PyPI does not have. Commands that need the engine raise
`EngineNotInstalled` with the install hint; the engine is imported lazily (`autoquant/shinka_research/_engine.py`).

## Web UI: removed

The fork's standalone UI (`aq shinka ui`, its HTTP server in `ui.py`, the analysis adapter `analysis.py` over the
upstream run viewer, the prebuilt `webui/dist/` bundle and the `studio-shinka/` source) was deleted. `ui.py` keeps
only the snapshot builders (`snapshot`, `workspace_snapshot`, `library_snapshot`) with their visibility filtering.
Studio redraws the pages natively; see [Studio](#studio).

## Changes to ported code

Imports (`shinka.research` to `autoquant.shinka_research`), lazy engine access and test paths (step 1); then, for
the V3 binding:

- `project.py` (new): direction/library resolution above.
- `cli.py` split into `cli.py`, `cli_common.py`, `cli_confirm.py` and `cli_read.py` so no module is a god file under
  the structural ratchet ([[docs/design/structural-rules]]); behaviour unchanged except the `dir` resolution and the
  removed `ui` command.
- `ui.py`: HTTP server, analysis links and the built-bundle path removed; `snapshot(root, library_dir=None)` leaves
  the library out unless asked; text read as UTF-8.
- `state.py`: notebook reads and atomic writes are explicitly UTF-8, so a Studio process without Python UTF-8 mode
  still reads notebooks with Chinese text.
- Only edit to the copied docs: literal double-bracket wikilink examples were reworded (the V3 documentation gate
  resolves them as links).

## Tests

`.venv/Scripts/python.exe -m pytest tests/shinka_research -q` (or `uv run --extra shinka --group shinka-test pytest
tests/shinka_research -q`). Tests needing the engine skip when `shinka` is absent; the whole directory is skipped
without the `shinka` extra. Tests that used to go through the removed HTTP server now read the same two snapshots
in process (`tests/shinka_research/snapshot_reader.py`). Tests of the removed UI, analysis pages and design tokens
were deleted with them.

## Studio

Studio draws a Project's research direction and the Workspace library from read-only routes that reuse the
snapshot builders; see [[docs/STUDIO]].
