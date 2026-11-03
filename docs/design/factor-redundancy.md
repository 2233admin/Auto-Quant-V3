# Workspace Factor redundancy

Issue #8. Related: [[docs/design/factor-component-attribution]],
[[docs/design/factor-diagnostics]], [[docs/design/factor-evidence-explorer]],
[[docs/design/run-comparability]], [[docs/design/research-selection-integrity]].

`aq run factor ... --json` and Studio's Factor diagnostics include `redundancy`:
`schemaVersion: 1`, `status: available | no-comparable-peers | unavailable`,
`reason`, `split: validation`, `authority: diagnostic-only`, `evaluationMode`,
`peers` and `excluded`. This is a live Workspace projection, not part of the
immutable Run or its verdict. A new peer can change this diagnostic without
changing the measured Run. No candidate selection, qualification or promotion
rule consumes it.

## Evidence and evaluation basis

New Factor Judges publish `factor-validation-pairs.json` as kind
`factor-validation-pairs`. Version 1 contains only primary-horizon, purge-aware
validation rows: timestamp, prediction asset, factor value, and the exact
already-computed forward outcome. Test/holdout rows are never published in this
artifact. The Run manifest content-locks it. Readers load verified Runs first,
check the artifact's version/split/horizon, confined path, manifest membership,
64 MiB / one-million-row bounds, finite values, unique keys, population and
purged validation signal window. They never execute candidate/Judge code or
construct outcomes from market prices. Historical Runs without the artifact
return `unavailable / missing-validation-pairs`.

Peer discovery follows the effective Workspace Projects directory, including an
explicit local override, and excludes Session worktrees. Standalone Projects can
compare their own distinct candidate sources. Failed or unverifiable Runs are
excluded, with a diagnostic. For each Project / Study / candidate source hash,
retain the latest successful comparable Run by completion time then Run id.
The target's own same-source Study is excluded. Source identity and exact peer
Run ids remain visible. Peers sort by descending absolute correlation with
deterministic identity ties; null correlations sort last.

The shared `run_compare.protocol_of` and `compare_protocols` check dataset id
and content hash, lane, objective, complete split windows and numerical horizon.
Redundancy additionally requires the same Judge hash, prediction assets/mode/pair,
complete split/purge protocol and forward-outcome contract. Unlike a Run delta
comparison, caller-owned Study/request identities, horizon provenance ids and
source-bound dependency hashes are not numerical evaluation basis. No general
Study-equivalence registry or relaxed dataset-hash matching is introduced.

## Mathematics and counts

Join target and peer on published timestamp/asset keys, without filling or
resampling, and require equal outcomes on the overlap. Cross-sectional rows
need at least four common assets and nonconstant factors. Correlation is the
time-series mean of per-bar Spearman rank correlations (average ties).
`observations` counts those bars; `pairedAssetObservations` counts their asset
pairs. Sparse/constant cells remain null with zero usable bars.

Residualization directly reuses `cross_sectional_rank_residual` from the existing
component diagnostics: center percentile ranks, regress target rank on peer rank
with an intercept, then rank the residual and correlate it with the same
Judge-published primary forward outcome. `residualRankIc` averages those bar ICs;
`residualObservations` counts them separately. Exact-span residuals within
absolute tolerance `1e-12` contribute zero, avoiding floating-point rank noise.
This is a rank-space diagnostic, not a raw-value linear risk model.

Single-asset temporal Runs use validation time-series Spearman correlation and
count paired timestamps. Cross-sectional residualization does not apply:
`residualRankIc: null`, `residualObservations: 0`, and an explicit
`cross-sectional-residualization-not-applicable` reason. Two-asset relative-value
residualization is unsupported in this version and disclosed as unavailable.

## Studio

The Factor answer, diagnostics workbench and library card quote the highest
absolute overlap. Evidence lists every peer with exact Run identity and counts.
The bilingual metric catalogue's `?` explains both statistics and boundaries.
“Possible duplicate” is a display heuristic only:

```text
abs(correlation) >= 0.7
and abs(residualRankIc) < abs(target validation meanRankIc) / 2
```

Null values never satisfy it. It is neither a verdict nor an independent
holdout claim. These statistics use validation only even when a test audit is
visible. Existing test visibility and selection-adjustment contracts remain
unchanged. No third-party implementation was copied.
