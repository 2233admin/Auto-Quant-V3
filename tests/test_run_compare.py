from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import unittest

from autoquant.run_compare import FIELDS, compare_protocols, compare_runs, protocol_of, cost_model_id
from autoquant.runs import RunContext


def example_run():
    return RunContext(Path('.'), {}, {
        "id": "run-example", "project": {"id": "p", "name": "Project"},
        "study": {"id": "s", "hash": "study", "programHash": "program"},
        "judge": {"hash": "judge"}, "subject": {"kind": "factor", "name": "signal", "sourceHash": "source"},
        "dataset": {"id": "dataset", "hash": "bytes"}, "objective": {"metric": "validation_mean_ic", "direction": "maximize"},
        "status": "succeeded", "startedAt": "2026-11-01T00:00:00+00:00", "durationMs": 100,
        "metrics": {"validation_mean_ic": 0.2, "research_horizon": {"primaryForwardBars": 1},
                    "split_protocol": {"splits": {s: {"start": f"2026-0{i}-01", "end": f"2026-0{i}-20", "rows": 10}
                                                     for i, s in enumerate(("train", "validation", "test"), 1)}},
                    "research_integrity": {"test_role": "visible-diagnostic"}, "test": {"mean_ic": 987654.321}},
    })


class RunComparabilityTests(unittest.TestCase):
    def test_same_protocol_and_different_candidate_are_comparable(self):
        a = example_run()
        b = deepcopy(a)
        b.result["id"] = "run-other"
        b.result["subject"]["sourceHash"] = "edited-source"
        self.assertEqual(compare_runs(a, b), {"status": "comparable", "differences": []})

    def test_each_field_mismatch_is_reported_exactly(self):
        a = protocol_of(example_run())
        for field in FIELDS:
            with self.subTest(field=field):
                b = deepcopy(a)
                b[field] = deepcopy(a[field])
                if field == 'splitWindows':
                    b[field]['test']['end'] = 'changed'
                elif field == 'horizon':
                    b[field]['primaryForwardBars'] = 5
                else:
                    b[field] = 'changed'
                decision = compare_protocols(a, b)
                self.assertEqual(decision["status"], "not-comparable")
                self.assertEqual(decision["differences"], [{"field": field, "reason": "different", "a": a[field], "b": b[field]}])

    def test_all_mismatches_are_returned_without_short_circuit(self):
        a = protocol_of(example_run())
        b = {k: "changed" for k in FIELDS}
        self.assertEqual([d["field"] for d in compare_protocols(a, b)["differences"]], list(FIELDS))

    def test_missing_authority_on_both_sides_cannot_establish_equivalence(self):
        a = protocol_of(example_run())
        for field in set(FIELDS) - {"costModel"}:
            with self.subTest(field=field):
                b = {**a, field: None}
                self.assertEqual(compare_protocols(b, b)["differences"], [{"field": field, "reason": "missing", "a": None, "b": None}])

    def test_judge_program_and_dependencies_are_study_authority(self):
        a = example_run()
        for path, key in (("judge", "hash"), ("study", "programHash"), ("study", "hash")):
            with self.subTest(path=path, key=key):
                b = deepcopy(a)
                b.result[path][key] = "changed"
                self.assertEqual([d["field"] for d in compare_runs(a, b)["differences"]], ["study"])
        b = deepcopy(a)
        b.result["dependencies"] = {"hash": "changed"}
        self.assertEqual(compare_runs(a, b)["differences"][0]["field"], "study")

    def test_test_window_mismatch_is_checked_even_without_visible_audit(self):
        a = example_run()
        b = deepcopy(a)
        del a.result["metrics"]["test"]
        del b.result["metrics"]["test"]
        b.result["metrics"]["split_protocol"]["splits"]["test"]["end"] = "2026-04-01"
        self.assertEqual(compare_runs(a, b)["differences"][0]["field"], "splitWindows")

    def test_cost_model_and_rates_are_preserved_not_just_a_display_label(self):
        a = example_run()
        a.result["objective"]["metric"] = "validation_net_sharpe"
        a.result["metrics"]["portfolio_mandate"] = {"implementationPolicy": {"costModel": "linear", "baseCostBps": 5}}
        b = deepcopy(a)
        b.result["metrics"]["portfolio_mandate"]["implementationPolicy"]["baseCostBps"] = 10
        self.assertEqual(compare_runs(a, b)["differences"][0]["field"], "costModel")
        self.assertNotEqual(cost_model_id(protocol_of(a)), cost_model_id(protocol_of(b)))

    def test_unknown_strategy_cost_is_refused(self):
        a = example_run()
        a.result["objective"]["metric"] = "validation_net_sharpe"
        self.assertEqual(compare_runs(a, a)["differences"][0]["field"], "costModel")

    def test_split_projection_carries_windows_not_test_sample_counts(self):
        self.assertNotIn("rows", protocol_of(example_run())["splitWindows"]["test"])

    def test_incomplete_windows_and_horizon_are_not_equivalence(self):
        p = protocol_of(example_run())
        for field, value in [('splitWindows', {'train': {'start': 'x', 'end': 'y'}}), ('horizon', {'id': 'unknown'})]:
            with self.subTest(field=field):
                broken = {**p, field: value}
                self.assertEqual(compare_protocols(broken, broken)['differences'][0]['reason'], 'missing')


if __name__ == '__main__':
    unittest.main()
