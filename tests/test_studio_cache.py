from __future__ import annotations

import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from autoquant import studio as studio_module
from autoquant.sessions import evaluate_experiment, start_session
from autoquant.studies import create_study
from autoquant.studio import create_studio_server
from tests.study_helpers import make_project, study_definition


class StudioSnapshotCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.addCleanup(self._directory.cleanup)
        workspace, self.project = make_project(self._directory.name)
        create_study(self.project, study_definition())
        session = start_session(self.project, "factor-quality")
        (session.worktree_project.root_dir / "factors/candidate.py").write_text(
            "SCORE = 2.0\n"
        )
        evaluate_experiment(self.project, session.manifest["id"], "Improve")
        self.server = create_studio_server(workspace.root_dir, port=0)
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.builds = mock.patch.object(
            studio_module,
            "build_studio_snapshot",
            wraps=studio_module.build_studio_snapshot,
        ).start()
        self.addCleanup(mock.patch.stopall)

    def _get(self, path: str, etag: str | None = None):
        request = Request(self.base + path)
        if etag:
            request.add_header("If-None-Match", etag)
        return urlopen(request, timeout=30)

    def test_second_request_is_served_from_cache_with_same_etag(self) -> None:
        with self._get("/api/v1/snapshot") as first:
            body = first.read()
            etag = first.headers["ETag"]
        with self._get("/api/v1/snapshot") as second:
            self.assertEqual(second.read(), body)
            self.assertEqual(second.headers["ETag"], etag)
        self.assertEqual(self.builds.call_count, 1)

    def test_if_none_match_returns_304_without_a_body(self) -> None:
        with self._get("/api/v1/snapshot") as first:
            etag = first.headers["ETag"]
        with self.assertRaises(HTTPError) as caught:
            self._get("/api/v1/snapshot", etag)
        self.assertEqual(caught.exception.code, 304)
        self.assertEqual(caught.exception.read(), b"")
        self.assertEqual(caught.exception.headers["ETag"], etag)
        with self._get("/api/v1/snapshot", '"other"') as response:
            self.assertEqual(response.status, 200)

    def test_changed_file_invalidates_the_cache(self) -> None:
        with self._get("/api/v1/snapshot") as first:
            etag = first.headers["ETag"]
        (self.project.root_dir / "scratch-note.txt").write_text("changed\n")
        with self._get("/api/v1/snapshot", etag) as second:
            self.assertEqual(second.status, 200)
            self.assertNotEqual(second.headers["ETag"], etag)
        self.assertEqual(self.builds.call_count, 2)

    def test_concurrent_requests_share_one_rebuild(self) -> None:
        def fetch(_: int) -> str:
            with self._get("/api/v1/snapshot") as response:
                response.read()
                return response.headers["ETag"]

        with ThreadPoolExecutor(max_workers=8) as pool:
            etags = list(pool.map(fetch, range(8)))
        self.assertEqual(len(set(etags)), 1)
        self.assertEqual(self.builds.call_count, 1)

    def test_workspace_summary_reuses_the_cached_snapshot(self) -> None:
        with self._get("/api/v1/snapshot") as response:
            response.read()
        with self._get("/api/v1/workspace") as response:
            summary = json.loads(response.read())
        self.assertEqual(summary["kind"], "autoquant-studio-workspace-summary")
        self.assertEqual(self.builds.call_count, 1)

    def test_project_route_builds_one_project_and_never_caches_errors(self) -> None:
        project_id = self.project.manifest.id
        with self._get(f"/api/v1/project?id={project_id}") as response:
            body = json.loads(response.read())
        self.assertEqual([item["id"] for item in body["projects"]], [project_id])
        self.assertEqual(
            self.builds.call_args.kwargs.get("project_id"), project_id
        )
        for _ in range(2):
            with self.assertRaises(HTTPError) as caught:
                self._get("/api/v1/project?id=nope")
            self.assertEqual(caught.exception.code, 422)


if __name__ == "__main__":
    unittest.main()
