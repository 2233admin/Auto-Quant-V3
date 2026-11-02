from __future__ import annotations

from copy import deepcopy
import json
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from autoquant.run_history import history_row, history_page, audit_visible
from autoquant.studio_compare import _gated_factor, comparison_payload
from autoquant.studio import build_studio_snapshot, create_studio_server
from autoquant.studies import create_study
from autoquant.runs import execute_study
from tests.study_helpers import make_project, study_definition
from tests.test_run_compare import example_run


def snapshot(rows):
    return {"diagnostics": [], "projects": [{"id": "p", "diagnostics": [], "sessions": [{"experiments": [{"runId": "run-example", "verdict": "KEEP"}]}], "runs": [{"id": r["id"], "history": r} for r in rows]}]}


class RunHistoryTests(unittest.TestCase):
    def test_history_has_exact_provenance_validation_and_core_verdict(self):
        row = history_row(example_run())
        self.assertEqual(row["primaryValue"], 0.2)
        self.assertEqual(row["sourceHash"], "source")
        self.assertEqual(row["datasetId"], "dataset")
        self.assertTrue(row["testAuditVisible"])
        self.assertNotIn("987654.321", json.dumps(row))
        self.assertEqual(history_page(snapshot([row]))["rows"][0]["verdict"], "KEEP")

    def test_no_inferred_validation_or_nonfinite_objective(self):
        run = example_run()
        run.result["objective"]["metric"] = "test_score"
        run.result["metrics"]["test_score"] = 987654.321
        self.assertIsNone(history_row(run)["primaryValue"])
        run.result["objective"]["metric"] = "validation_score"
        run.result["metrics"]["validation_score"] = float('nan')
        self.assertIsNone(history_row(run)["primaryValue"])

    def test_strategy_headlines_use_validation_and_never_test(self):
        run = example_run()
        run.result['metrics']['portfolio'] = {'validation': {'net': {'total_return': 0.12, 'maximum_drawdown': -0.08}}, 'test': {'net': {'total_return': 987654.321}}}
        row = history_row(run)
        self.assertEqual(row['validationHeadlines']['netTotalReturn'], 0.12)
        self.assertEqual(row['validationHeadlines']['maxDrawdown'], -0.08)
        self.assertNotIn('987654.321', json.dumps(row))

    def test_actual_audit_and_role_are_both_required(self):
        for role, audit, expected in [('visible-diagnostic', {}, False), ('hidden', {"secret": 1}, False), ('visible-diagnostic', {"secret": 1}, True)]:
            with self.subTest(role=role, audit=audit):
                self.assertEqual(audit_visible({"testRole": role}, {"testAudit": audit}), expected)

    def test_gated_factor_removes_test_values_and_points_before_serializing(self):
        for role, audit in [('hidden', {"meanRankIc": 987654.321}), ('visible-diagnostic', None)]:
            explorer = {"protocol": {"testRole": role}, "summary": {"validation": {"meanRankIc": 0.2}, "testAudit": audit},
                        "quantilePath": {"cumulative": {"points": [{"split": "test", "spread": 987654.321}, {"split": "validation", "spread": 1.1}]}}, "secret": 987654.321}
            output = _gated_factor(explorer)
            self.assertNotIn('987654.321', json.dumps(output))
            self.assertEqual(len(output["points"]), 1)

    def test_gated_factor_retains_published_visible_audit(self):
        explorer = {"protocol": {"testRole": "visible-diagnostic"}, "summary": {"validation": {}, "testAudit": {"meanRankIc": 0.3}},
                    "quantilePath": {"cumulative": {"points": [{"split": "test", "spread": 1.2}]}}}
        self.assertEqual(_gated_factor(explorer)["summary"]["testAudit"]["meanRankIc"], 0.3)

    def test_every_lane_and_failed_run_remain_in_bounded_history(self):
        rows = []
        for i, (kind, metric) in enumerate([('factor', 'validation_mean_ic'), ('strategy', 'validation_net_sharpe'), ('model', 'validation_mean_net_sharpe'), ('research', 'book-risk-score')]):
            run = example_run()
            run.result.update(id=f'run-{i}', status='failed' if i == 3 else 'succeeded')
            run.result['subject']['kind'] = kind
            run.result['objective']['metric'] = metric
            rows.append(history_row(run))
        first = history_page(snapshot(rows), limit=2)
        second = history_page(snapshot(rows), offset=2, limit=2)
        self.assertEqual(first['total'], 4)
        self.assertEqual(len({r['id'] for r in first['rows'] + second['rows']}), 4)
        self.assertEqual({r['objectKind'] for r in rows}, {'factor', 'strategy', 'analysis'})
        for limit in [0, 201]:
            with self.assertRaises(ValueError):
                history_page(snapshot(rows), limit=limit)

    def test_refused_comparison_has_no_metrics_or_factor_diagnostics(self):
        a = history_row(example_run())
        b = deepcopy(a)
        b['id'] = 'run-b'
        b['protocol']['datasetId'] = 'other-data'
        payload = comparison_payload(snapshot([a, b]), {'project': ['p'], 'a': [a['id']], 'b': [b['id']]}, '.', None)
        self.assertEqual(payload['status'], 'not-comparable')
        self.assertEqual(payload['differences'][0]['field'], 'datasetId')
        self.assertNotIn('factors', payload)

    def test_http_pagination_validation_scope_and_immutable_read(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            create_study(project, study_definition())
            run = execute_study(project, 'factor-quality')
            before = (run.root_dir / 'manifest.json').read_bytes()
            server = create_studio_server(workspace.root_dir, port=8932)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_address[1]}'
            try:
                with urlopen(base + '/api/v1/runs?limit=1') as response:
                    payload = json.load(response)
                self.assertEqual(payload['total'], 1)
                self.assertEqual(payload['rows'][0]['id'], run.result['id'])
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + '/api/v1/runs?limit=201')
                self.assertEqual(error.exception.code, 422)
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + '/api/v1/run-compare?project=outside&a=x&b=y')
                self.assertEqual(error.exception.code, 422)
                self.assertEqual((run.root_dir / 'manifest.json').read_bytes(), before)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
