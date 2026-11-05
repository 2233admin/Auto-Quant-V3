"""Studio read model of one Shinka experiment's evolution run (studio_evolution.py)."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from autoquant.studio import create_studio_server
from autoquant.studio_evolution import build_meta, build_program, build_prompt, build_run
from autoquant.workspace import AutoQuantValidationError
from tests.shinka_demo import build

HAS_ENGINE = all(importlib.util.find_spec(m) is not None for m in ("pydantic", "yaml", "scipy", "psutil", "shinka"))
RUN = {"id": ["momentum-regimes"], "h": ["h001"], "e": ["e01"]}


@unittest.skipUnless(HAS_ENGINE, "needs the shinka and shinka-engine extras")
class EvolutionReadModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.workspace = build(Path(cls._tmp.name) / "desk")
        cls.payload = build_run(cls.workspace, RUN)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_run_payload_carries_series_lineage_and_no_private_metrics(self) -> None:
        run = self.payload
        self.assertEqual(run["state"], "ready")
        self.assertIn("DEMO", run["demo"])
        stats, generations = run["stats"], run["generations"]
        self.assertEqual(stats["programs"], 320)
        self.assertEqual(stats["best"], max(p["score"] for p in run["programs"] if p["score"] is not None))
        self.assertEqual(generations[-1]["record"], stats["best"])
        self.assertEqual(sum(g["programs"] for g in generations), stats["programs"])
        self.assertEqual(run["bestPath"][-1], max((p for p in run["programs"] if p["score"] is not None), key=lambda p: p["score"])["id"])
        self.assertEqual(run["privateMetrics"], "hidden")
        self.assertTrue(run["prompts"] and run["metaFiles"])
        text = json.dumps(run, ensure_ascii=False)
        self.assertNotIn("private_metrics", text)
        self.assertNotIn(":\\\\", text)  # no absolute Windows path

    def test_program_detail_has_source_diff_and_offspring_but_never_private_values(self) -> None:
        root = self.payload["bestPath"][0]
        detail = build_program(self.workspace, {**RUN, "program": [root]})
        program = detail["program"]
        self.assertTrue(program["code"])
        self.assertEqual(program["privateMetrics"], "hidden")
        self.assertNotIn("private_metrics", json.dumps(detail))
        self.assertTrue(all(child["parent"] == root for child in detail["offspring"]))
        self.assertIn(self.payload["bestPath"][1], {child["id"] for child in detail["offspring"]})

    def test_prompt_and_meta_notes(self) -> None:
        prompt = build_prompt(self.workspace, {**RUN, "prompt": [self.payload["prompts"][0]["id"]]})
        self.assertTrue(prompt["prompt"]["text"])
        meta = build_meta(self.workspace, {**RUN, "n": [str(self.payload["metaFiles"][0])]})
        self.assertTrue(meta["meta"]["text"])
        with self.assertRaises(AutoQuantValidationError):
            build_meta(self.workspace, {**RUN, "n": ["999999"]})

    def test_unknown_or_traversing_experiments_and_programs_are_refused(self) -> None:
        for query in (
            {**RUN, "e": ["e99"]},
            {**RUN, "h": ["../h001"]},
            {**RUN, "id": ["../momentum-regimes"]},
            {"id": ["momentum-regimes"], "h": ["h001"]},
        ):
            with self.assertRaises(AutoQuantValidationError, msg=query):
                build_run(self.workspace, query)
        for program in ("../x", "nope"):
            with self.assertRaises(AutoQuantValidationError):
                build_program(self.workspace, {**RUN, "program": [program]})

    def test_a_missing_engine_is_unavailable(self) -> None:
        from autoquant.shinka_research._engine import EngineNotInstalled

        with mock.patch("autoquant.studio_evolution._engine", side_effect=EngineNotInstalled("shinka.database: missing")):
            payload = build_run(self.workspace, RUN)
        self.assertEqual((payload["state"], payload["reason"]), ("unavailable", "shinka-engine-missing"))

    def test_direction_payload_compares_experiments(self) -> None:
        from autoquant.studio_research import build_project_research

        curves = build_project_research(self.workspace, "momentum-regimes")["research"]["experimentCurves"]
        self.assertEqual(len(curves), 5)
        for curve in curves:
            records = [value for _, value in curve["steps"]]
            self.assertEqual(records, sorted(records))


@unittest.skipUnless(HAS_ENGINE, "needs the shinka and shinka-engine extras")
class EvolutionRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.workspace = build(Path(cls._tmp.name) / "desk")

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def setUp(self) -> None:
        self.server = create_studio_server(self.workspace, port=0)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def _get(self, path: str, etag: str | None = None):
        request = Request(self.base + path)
        if etag:
            request.add_header("If-None-Match", etag)
        return urlopen(request, timeout=60)

    def test_run_route_serves_etag_and_304_and_refuses_unknown(self) -> None:
        path = "/api/v1/project/research/run?id=momentum-regimes&h=h001&e=e01"
        with self._get(path) as first:
            self.assertEqual(json.loads(first.read())["state"], "ready")
            etag = first.headers["ETag"]
        with self.assertRaises(HTTPError) as caught:
            self._get(path, etag)
        self.assertEqual(caught.exception.code, 304)
        with self.assertRaises(HTTPError) as caught:
            self._get("/api/v1/project/research/run?id=momentum-regimes&h=h001&e=e09")
        self.assertEqual(caught.exception.code, 422)


if __name__ == "__main__":
    unittest.main()
