"""Studio read model of Shinka research: a direction is a Project, the library is Workspace-level."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from autoquant.studio import build_workspace_summary, create_studio_server
from autoquant.studio_research import build_project_research, build_research_library, ledger
from autoquant.workspace import AutoQuantValidationError, create_project, initialize_workspace
from tests.shinka_demo import build

HAS_EXTRA = all(importlib.util.find_spec(m) is not None for m in ("pydantic", "yaml", "scipy", "psutil"))
HAS_ENGINE = HAS_EXTRA and importlib.util.find_spec("shinka") is not None


class DemoWorkspace(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.workspace = build(Path(cls._tmp.name) / "desk")

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()


class ResearchSummaryTests(DemoWorkspace):
    """Needs neither the extra nor the engine: notebook.json alone."""

    def test_workspace_summary_lists_research_state_per_project(self) -> None:
        projects = {p["id"]: p for p in build_workspace_summary(self.workspace)["projects"]}
        momentum = projects["momentum-regimes"]["research"]
        self.assertEqual(momentum["state"], "ready")
        self.assertEqual(momentum["hypotheses"], 4)
        self.assertEqual(
            momentum["statusCounts"], {"supported": 1, "refuted": 1, "inconclusive": 1, "running": 1}
        )
        self.assertEqual(momentum["lockbox"], "sealed")
        self.assertIsNotNone(momentum["latestVerdict"])
        self.assertIn("DEMO", momentum["demo"])
        gap = projects["overnight-gap"]["research"]
        self.assertEqual(gap["lockbox"], "opened")
        self.assertIn(gap["latestVerdict"]["label"], {"confirmed", "refuted"})
        self.assertIsNone(projects["volume-shock"]["research"]["latestVerdict"])

    def test_a_project_without_research_has_none(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "w"
            initialize_workspace(root)
            create_project(root, "plain")
            (summary,) = build_workspace_summary(root)["projects"]
            self.assertIsNone(summary["research"])
            self.assertEqual(build_project_research(root, "plain")["state"], "none")
            self.assertEqual(build_research_library(root)["state"], "none")


class LedgerTests(unittest.TestCase):
    def test_missing_pbo_is_not_computed_never_a_pass(self) -> None:
        evidence = {
            "oos_sharpe": 1.0,
            "baseline_buy_hold_oos_sharpe": 0.4,
            "dsr": 0.97,
            "oos_positive_fraction": 1.0,
            "pbo": None,
        }
        rows = {r["id"]: r for r in ledger({"id": "h001", "verdict": {"evidence": evidence}}, None, {})}
        self.assertEqual(rows["pbo"]["state"], "not-computed")
        self.assertEqual(rows["dsr"]["state"], "pass")
        self.assertEqual(rows["beats-buy-hold"]["state"], "pass")
        self.assertEqual(rows["lockbox"]["state"], "none")

    def test_without_a_verdict_validation_rows_are_withheld_without_values(self) -> None:
        h = {"id": "h002", "verdict": None, "confirmation": None}
        rows = ledger(h, {"opened": False}, {"bar": 0.6, "trials": 12, "byHypothesis": {"h002": 0.9}})
        gates = [r for r in rows if r["role"] == "gate"]
        self.assertTrue(gates and all(r["state"] == "withheld" and r["value"] is None for r in gates))
        self.assertEqual({r["id"]: r["state"] for r in rows}["lockbox"], "sealed")


@unittest.skipUnless(HAS_ENGINE, "needs the shinka and shinka-engine extras")
class ProjectResearchTests(DemoWorkspace):
    def test_payload_withholds_unjudged_validation_and_sealed_dates(self) -> None:
        payload = build_project_research(self.workspace, "momentum-regimes")
        self.assertEqual(payload["state"], "ready")
        self.assertIn("DEMO", payload["demo"])
        research = payload["research"]
        self.assertNotIn("start", research["lockbox"])  # sealed: no tail date
        self.assertNotIn("best_program", json.dumps(payload, ensure_ascii=False))
        by_id = {h["id"]: h for h in research["hypotheses"]}
        running = by_id["h004"]
        self.assertIsNone(running["verdict"])
        self.assertTrue(all("skeptic" not in e for e in running["experiments"]))
        self.assertTrue(all(r["state"] == "withheld" for r in running["ledger"] if r["role"] == "gate"))
        self.assertEqual({r["id"]: r for r in by_id["h001"]["ledger"]}["dsr"]["state"], "pass")
        frontier = research["frontier"]
        self.assertEqual(frontier["programs"], len(research["trial_points"]))
        self.assertEqual(frontier["bar"], research["trial_points"][-1]["bar"])
        self.assertEqual(research["trials"], frontier["programs"] + frontier["probes"])

    def test_an_opened_lockbox_shows_its_start_and_confirmation(self) -> None:
        research = build_project_research(self.workspace, "overnight-gap")["research"]
        self.assertTrue(research["lockbox"]["opened"])
        self.assertIn("start", research["lockbox"])
        (h1,) = [h for h in research["hypotheses"] if h["id"] == "h001"]
        self.assertEqual({r["id"]: r["state"] for r in h1["ledger"]}["lockbox"], "confirmed")

    def test_library_route_payload(self) -> None:
        payload = build_research_library(self.workspace)
        self.assertEqual(payload["state"], "ready")
        library = payload["library"]
        self.assertTrue(library["pages"])
        self.assertTrue(set(library["findings"]) <= {p["name"] for p in library["pages"]})
        self.assertIn("DEMO", library["demo"])

    def test_unknown_or_traversing_ids_are_refused(self) -> None:
        for bad in ("missing", "../momentum-regimes", "", None):
            with self.assertRaises(AutoQuantValidationError):
                build_project_research(self.workspace, bad)


@unittest.skipUnless(HAS_ENGINE, "needs the shinka and shinka-engine extras")
class ResearchRouteTests(DemoWorkspace):
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

    def test_routes_serve_etag_and_304(self) -> None:
        for path in ("/api/v1/project/research?id=momentum-regimes", "/api/v1/research-library"):
            with self._get(path) as first:
                body = json.loads(first.read())
                etag = first.headers["ETag"]
                self.assertEqual(first.headers["Cache-Control"], "no-cache")
            self.assertEqual(body["state"], "ready")
            with self.assertRaises(HTTPError) as caught:
                self._get(path, etag)
            self.assertEqual(caught.exception.code, 304)

    def test_a_research_change_invalidates_the_project_entry(self) -> None:
        path = "/api/v1/project/research?id=momentum-regimes"
        with self._get(path) as first:
            etag = first.headers["ETag"]
        log = self.workspace / "projects" / "momentum-regimes" / "research" / "results.tsv"
        original = log.read_bytes()
        try:
            log.write_bytes(original + b"2026-11-05T00:00:00+00:00\th004\te01\tnote\tadded\n")
            with self._get(path, etag) as second:
                self.assertEqual(second.status, 200)
                self.assertNotEqual(second.headers["ETag"], etag)
        finally:
            log.write_bytes(original)

    def test_a_library_change_invalidates_the_library_entry(self) -> None:
        with self._get("/api/v1/research-library") as first:
            etag = first.headers["ETag"]
        page = self.workspace / "library" / "wiki" / "concept-extra.md"
        try:
            page.write_text("# Extra\n", encoding="utf-8")
            with self._get("/api/v1/research-library", etag) as second:
                self.assertEqual(second.status, 200)
        finally:
            page.unlink()

    def test_unknown_project_is_a_validation_error(self) -> None:
        with self.assertRaises(HTTPError) as caught:
            self._get("/api/v1/project/research?id=nope")
        self.assertEqual(caught.exception.code, 422)


if __name__ == "__main__":
    unittest.main()
