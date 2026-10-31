from __future__ import annotations

import json
import tempfile
import unittest
from unittest import mock

from autoquant import runs as runs_module
from autoquant.runs import list_runs, load_run, run_read_memo
from autoquant.sessions import evaluate_experiment, start_session
from autoquant.studies import create_study
from autoquant.studio import build_studio_snapshot
from tests.study_helpers import make_project, study_definition


class StudioRunReadMemoTests(unittest.TestCase):
    def _project(self, directory: str):
        _, project = make_project(directory)
        create_study(project, study_definition())
        session = start_session(project, "factor-quality")
        candidate = session.worktree_project.root_dir / "factors/candidate.py"
        candidate.write_text("SCORE = 2.0\n")
        evaluate_experiment(project, session.manifest["id"], "Improve the factor")
        return project

    def test_memo_is_scoped_to_one_block_and_cli_paths_read_disk(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = self._project(directory)
            run_dirs = sorted((project.root_dir / "runs").iterdir())
            run_id = run_dirs[0].name
            real = runs_module._load_run_uncached
            with mock.patch.object(
                runs_module, "_load_run_uncached", wraps=real
            ) as disk:
                load_run(project, run_id)
                load_run(project, run_id)
                self.assertEqual(disk.call_count, 2)

                disk.reset_mock()
                with run_read_memo():
                    first = load_run(project, run_id)
                    second = load_run(project, run_id)
                    list_runs(project)
                    list_runs(project)
                self.assertIs(first, second)
                self.assertEqual(disk.call_count, len(run_dirs))

                disk.reset_mock()
                load_run(project, run_id)
                self.assertEqual(disk.call_count, 1)
            self.assertIsNone(runs_module._READ_MEMO.get())

    def test_snapshot_builds_do_not_share_state_and_see_changed_runs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = self._project(directory)
            before = build_studio_snapshot(project.root_dir)
            self.assertTrue(before["valid"])
            run_count = len(sorted((project.root_dir / "runs").iterdir()))
            self.assertEqual(len(before["projects"][0]["runs"]), run_count)
            self.assertIsNone(runs_module._READ_MEMO.get())

            result_path = sorted((project.root_dir / "runs").iterdir())[0] / "result.json"
            value = json.loads(result_path.read_text())
            value["summary"] = "tampered"
            result_path.write_text(json.dumps(value))

            after = build_studio_snapshot(project.root_dir)
            self.assertFalse(after["valid"])
            self.assertEqual(after["projects"][0]["runs"], [])

    def test_validation_failure_is_memoized_only_inside_the_block(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = self._project(directory)
            result_path = sorted((project.root_dir / "runs").iterdir())[0] / "result.json"
            run_id = result_path.parent.name
            value = json.loads(result_path.read_text())
            value["summary"] = "tampered"
            result_path.write_text(json.dumps(value))
            real = runs_module._load_run_uncached
            with mock.patch.object(
                runs_module, "_load_run_uncached", wraps=real
            ) as disk:
                with run_read_memo():
                    for _ in range(3):
                        with self.assertRaises(Exception):
                            load_run(project, run_id)
                self.assertEqual(disk.call_count, 1)
                with self.assertRaises(Exception):
                    load_run(project, run_id)
                self.assertEqual(disk.call_count, 2)


if __name__ == "__main__":
    unittest.main()
