"""Independent formula parity with jqfactor_analyzer / Alphalens conventions.

No third-party analyzer dependency or copied source. Reference formulas below
use per-date equal means, entrants/current names, rank-vector autocorrelation
and per-horizon Spearman. Unlike their default demeaning/annualization, Core
uses raw outcomes, independent split purges and its original ordinal bins.
"""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import pandas as pd
import jsonschema

from autoquant.factor_tearsheet import compute_tearsheet, group_path, published_cost_model, quantile_count
from autoquant.factor_tearsheet_reader import load_tearsheet
from autoquant.factor_explorer import load_factor_diagnostics, FACTOR_DIAGNOSTICS_JSON_SCHEMA
from autoquant.runs import load_run
from autoquant.studies import parse_study_definition, STUDY_JSON_SCHEMA
from autoquant.workspace import AutoQuantValidationError
from tests.test_factor_explorer import make_lab, rehash_run


def panel():
    rng = np.random.default_rng(9083)
    index = pd.date_range('2020-01-01', periods=120)
    assets = [f'A{i:02}' for i in range(20)]
    factors = pd.DataFrame(rng.normal(size=(120, 20)), index=index, columns=assets)
    closes = pd.DataFrame(100 * np.exp(np.cumsum(rng.normal(0, .01, size=(120, 20)), axis=0)), index=index, columns=assets)
    return factors, closes


class TearSheetFormulaTests(unittest.TestCase):
    def test_reference_formula_parity_all_splits_and_lags(self):
        factors, closes = panel()
        hmax = 5
        for count in (5, 10):
            evidence = compute_tearsheet({'judge': {'quantiles': count}}, factors, closes,
                                        {'primaryForwardBars': 1, 'diagnosticForwardBars': [1, hmax]},
                                        'forward-return', 'cross-sectional')
            for split, start, stop in [('train', 0, 72), ('validation', 72, 96), ('test', 96, 120)]:
                data = evidence['splits'][split]
                previous = None
                expected_returns, expected_turnover = [], []
                for i in range(start, stop - 1):
                    # qcut on distinct ordinal ranks is the straightforward
                    # reference binning; equal-sized, no ties in this panel.
                    groups = pd.qcut(factors.iloc[i].rank(method='first'), count, labels=False)
                    ret = closes.iloc[i + 1] / closes.iloc[i] - 1
                    means = ret.groupby(groups).mean().tolist()
                    expected_returns.append(means)
                    names = [set(groups.index[groups == q]) for q in range(count)]
                    if previous is not None:
                        expected_turnover.append([len(now.difference(old)) / len(now) for now, old in zip(names, previous)])
                    previous = names
                np.testing.assert_allclose([s['value'] for s in data['quantileMeans']], np.mean(expected_returns, axis=0), atol=1e-9, rtol=0)
                np.testing.assert_allclose([s['value'] for s in data['meanTurnover']], np.mean(expected_turnover, axis=0), atol=1e-9, rtol=0)
                for lag in range(1, hmax + 1):
                    rank_pairs = [factors.iloc[i].rank().corr(factors.iloc[i - lag].rank()) for i in range(start + lag, stop)]
                    decay = [factors.iloc[i].rank().corr((closes.iloc[i + lag] / closes.iloc[i] - 1).rank()) for i in range(start, stop - lag)]
                    self.assertAlmostEqual(data['autocorrelation'][lag - 1]['value'], np.mean(rank_pairs), delta=1e-9)
                    self.assertAlmostEqual(data['icDecay'][lag - 1]['value'], np.mean(decay), delta=1e-9)
                    self.assertEqual(data['icDecay'][lag - 1]['observations'], stop - start - lag)
                expected = np.cumprod(1 + np.array(expected_returns), axis=0)
                np.testing.assert_allclose([r['groupCumulative'] for r in data['path']], expected, atol=1e-9, rtol=0)
                self.assertIsNone(data['longShortNet']['value'])

    def test_ties_sparse_refusal_and_short_sample(self):
        factors, closes = panel()
        factors.iloc[74] = 1
        factors.iloc[75, :17] = np.nan
        evidence = compute_tearsheet({'judge': {'quantiles': 5}}, factors, closes,
                                    {'primaryForwardBars': 1, 'diagnosticForwardBars': [1, 5]},
                                    'forward-return', 'cross-sectional')
        validation = evidence['splits']['validation']
        self.assertEqual(validation['refusedBars'], 2)
        self.assertEqual(validation['path'][2]['timestamp'], factors.index[76].isoformat())
        self.assertEqual(validation['path'][2]['turnover'], [None] * 5)
        self.assertTrue(validation['icDecay'][-1]['shortSample'])
        # Full-bar ranks followed by common-name Pearson, not re-ranking
        # after intersecting changing populations.
        ranks = factors.iloc[72:96].rank(axis=1)
        expected = [ranks.iloc[i].corr(ranks.iloc[i - 1]) for i in range(1, len(ranks))
                    if (ranks.iloc[i].notna() & ranks.iloc[i - 1].notna()).sum() >= 4]
        self.assertAlmostEqual(validation['autocorrelation'][0]['value'], pd.Series(expected).mean(), delta=1e-9)

    def test_cost_absence_zero_cost_and_opening_target_changes(self):
        factors, closes = panel()
        f = factors.iloc[:3]
        outcomes = (closes.shift(-1) / closes - 1).iloc[:3]
        cost = {'baseCostBps': 10, 'model': 'linear-traded-notional-v1'}
        rows, _ = group_path(f, outcomes, 5, cost)
        self.assertEqual(rows[0]['tradedNotional'], 2)
        self.assertAlmostEqual(rows[0]['net'], rows[0]['gross'] - .002)
        previous = {}
        for i, row in enumerate(rows):
            ordered = f.iloc[i].sort_values(kind='mergesort').index
            current = {a: -.25 for a in ordered[:4]} | {a: .25 for a in ordered[-4:]}
            turnover = sum(abs(current.get(a, 0) - previous.get(a, 0)) for a in current.keys() | previous.keys())
            self.assertAlmostEqual(row['net'], row['gross'] - turnover * .001, delta=1e-12)
            previous = current
        self.assertIsNone(group_path(f, outcomes, 5)[0][0]['net'])
        self.assertEqual(group_path(f, outcomes, 5, {'baseCostBps': 0})[0][0]['net'], rows[0]['gross'])
        self.assertIsNone(published_cost_model({'dependencies': {'paths': []}}, Path('.')))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'strategies').mkdir()
            (root / 'strategies/portfolio-mandate.json').write_text(json.dumps({'implementationPolicy': {'baseCostBps': 7, 'costModel': 'linear-traded-notional-v1'}}))
            model = published_cost_model({'dependencies': {'paths': ['strategies/portfolio-mandate.json']}}, root)
            self.assertEqual(model['baseCostBps'], 7)
            (root / 'request.json').write_text(json.dumps({'portfolioPolicy': {'baseCostBps': 3}}))
            request_study = {'dependencies': {'paths': ['request.json']}, 'research_request': {'path': 'request.json'}}
            self.assertEqual(published_cost_model(request_study, root)['baseCostBps'], 3)

    def test_default_ordinal_bins_and_temporal_boundary(self):
        self.assertEqual(quantile_count({'judge': {}}), 3)
        for invalid in (True, 4, '5', None):
            with self.assertRaises(ValueError):
                quantile_count({'judge': {'quantiles': invalid}})
        f, c = panel()
        e = compute_tearsheet({'judge': {}}, f, c, {'primaryForwardBars': 1, 'diagnosticForwardBars': [1]}, 'forward-return', 'single-asset-temporal')
        self.assertEqual(e['status'], 'protocol-unavailable')
        with self.assertRaisesRegex(ValueError, '10 quantiles require'):
            compute_tearsheet({'judge': {'quantiles': 10}}, f.iloc[:, :5], c.iloc[:, :5], {'primaryForwardBars': 1, 'diagnosticForwardBars': [1]}, 'forward-return', 'cross-sectional')
        # Intentional difference from qcut: first groups receive the extra name.
        rows, _ = group_path(f.iloc[:1, :7], (c.shift(-1) / c - 1).iloc[:1, :7], 3)
        self.assertEqual(rows[0]['groupSizes'], [3, 2, 2])


class TearSheetRunTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.workspace, cls.project, cls.run_context = make_lab(Path(cls.directory.name))

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_new_run_published_and_full_history_reconciled_before_sampling(self):
        run = load_run(self.project, self.run_context.result['id'])
        evidence = load_tearsheet(run, point_limit=40)
        self.assertEqual(evidence['quantiles'], 3)
        self.assertEqual(evidence['status'], 'available')
        self.assertLessEqual(len(evidence['splits']['train']['path']), 40)
        diagnostics = load_factor_diagnostics(self.project, run.result['id'])
        jsonschema.validate(diagnostics, FACTOR_DIAGNOSTICS_JSON_SCHEMA)
        self.assertEqual(diagnostics['tearSheet']['status'], 'available')

    def test_study_parameter_validation_and_absent_serialization(self):
        raw = json.loads((self.run_context.root_dir / 'inputs/study.json').read_text())
        definition = parse_study_definition(raw, Path('study.json'))
        self.assertEqual(definition.to_dict(), raw)
        self.assertIsNone(definition.judge.quantiles)
        for invalid in (True, 4, 10, '5', None):
            changed = deepcopy(raw)
            changed['judge']['quantiles'] = invalid
            # The six-asset teaching population also refuses deciles.
            with self.assertRaises(AutoQuantValidationError):
                parse_study_definition(changed, Path('study.json'))
        changed = deepcopy(raw)
        changed['judge']['quantiles'] = 5
        jsonschema.validate(changed, STUDY_JSON_SCHEMA)
        self.assertEqual(parse_study_definition(changed, Path('study.json')).judge.quantiles, 5)

    def test_missing_pair_and_legacy_are_distinct(self):
        run = deepcopy(self.run_context)
        run.result['artifacts'] = [a for a in run.result['artifacts'] if a['kind'] != 'factor-tear-sheet']
        with self.assertRaises(AutoQuantValidationError):
            load_tearsheet(run)
        run.result['metrics'].pop('factor_tear_sheet')
        self.assertEqual(load_tearsheet(run)['status'], 'not-published')

    def test_rehashed_semantic_tampering_rejected(self):
        # Work on a copy; never mutate the shared immutable Run fixture.
        import shutil
        from dataclasses import replace
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'run'
            shutil.copytree(self.run_context.root_dir, target)
            run = replace(self.run_context, root_dir=target)
            artifact = target / 'artifacts/factor-tear-sheet.json'
            payload = json.loads(artifact.read_text())
            payload['evidence']['splits']['validation']['path'][0]['grossCumulative'] += .1
            artifact.write_text(json.dumps(payload))
            rehash_run(target)
            run = replace(run, manifest=json.loads((target / 'manifest.json').read_text()))
            with self.assertRaisesRegex(AutoQuantValidationError, 'Cumulative path mismatch'):
                load_tearsheet(run)

    def test_sample_existing_studies_keep_absent_serialization(self):
        root = Path(__file__).resolve().parents[1]
        for path in (root / 'projects/sample-research-desk/studies').glob('*/study.json'):
            raw = json.loads(path.read_text())
            self.assertEqual(quantile_count(raw), 3)
            self.assertNotIn('quantiles', raw['judge'])
            self.assertEqual(parse_study_definition(raw, path).to_dict(), raw)
