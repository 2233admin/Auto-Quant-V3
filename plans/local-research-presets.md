# Local model research presets

- Status: `active`
- Updated: `2026-11-21`
- Related design: [[docs/design/external-researcher-driver]], [[docs/design/core-trial-gate]].

## Outcome

Run a local model to extract quoted candidates from a text excerpt or to choose approved factor and model parameter sets. Preserve the fixed Judge, trial budget and verified Experiment history.

## Context

A report extraction receipt can be read in Studio. The existing Campaign invokes a shell Researcher, which writes candidate code. The local model needs a path that accepts data instead of code.

## Scope

- Quote-checked candidate extraction and existing Studio receipt format.
- Ordered, budgeted feedback for an existing Session that edits one JSON parameter file.
- No imported Qlib simulator, arbitrary generated code, model fine-tuning, broker access or web execution control.

## Acceptance

- [x] Extract candidate JSON from a real excerpt and verify each quote against that excerpt.
- [x] Run two fixed-Judge Experiments on frozen real historical inputs. Verify that the second model prompt contains the first measured result.
- [x] Refuse a malformed, unknown or unapproved model output before candidate evaluation.
- [x] Keep external-shell Campaigns and the Core trial gate unchanged.

## Work

- [x] Add the loopback adapter, plan validation and extractor.
- [x] Integrate with the existing CLI, Campaign evidence and documentation.
- [ ] Run bounded acceptance and project validation.

## Findings and decisions

- Local plans enumerate complete JSON presets. The model selects an ID. The fixed Study owns all calculations.
- The current KiT historical replay is a fixed descriptive Study. Use a separate research Session for the factor and model parameter diagnostic.
- Ollama's JSON mode carries the prompt. AutoQuant, not the model provider, enforces the output contract.
- Candidate quotes are copied from the source, with exact named matches taking precedence over an ambiguous model-selected line. An exact quote does not validate the proposed rule.
- The report-to-candidate part of `fin_factor_report` is useful on excerpts. The
  proposal and feedback parts of `fin_factor`, `fin_model`, and `fin_quant`
  transfer when an existing Study exposes factor and model settings as data.
  The same connector can evaluate supported settings on custom inputs frozen
  by the Study. It does not generate new training code or implement a new model architecture.
- Keep RD-Agent's existing receipt reader in Studio. Do not import a second
  runner, the Qlib simulator, the RD-Agent web task server, or fine-tuning.

## Verification

- `aq research extract` returned four distinct whitepaper candidates. All four source lines were checked byte for byte against the frozen UTF-8 excerpt, and one duplicate was recorded.
- `aq research run --local-plan` evaluated two candidates on 47 scoring weeks of frozen KATANA CSI 300 data. The second prompt contained the first Experiment's exact score, Run ID and verdict. Neither candidate beat the baseline.
- `aq research show` verified the complete Campaign file manifest and referenced Experiments. The desk trial ledger recorded the resulting Runs.
- Final focused Python regressions: 10 passed with `TMP` and `TEMP` on `D:/tmp`.
  Studio tests: 115 passed. The existing 8894 page opened the actual receipt
  and displayed the original Hsigma definition. Documentation links and the
  final offline wheel build passed.
- The extractor preserved the distinction between stated plans and observed
  actions on a single-sentence research excerpt. The selected model refused
  a larger excerpt through item validation; AutoQuant wrote no receipt for it.
- Full unittest run did not produce a complete report on the full C drive.
  Moving temporary files to D let the dedicated checks run; the full baseline
  comparison timed out at 600 seconds. The registered sample/template mismatch
  still reproduced in isolation. No release or promotion.

## Progress log

- 2026-11-21: Verified local Ollama availability and located the frozen KATANA input.
