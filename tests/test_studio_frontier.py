"""Noise-frontier series: Core closed form, legacy-browser pin, and unavailable states.

The fixtures are synthetic selection ledgers fed through Core's real
``build_selection_adjustment``; they are transport fixtures, not research
evidence.
"""
from __future__ import annotations

import json
import math
import unittest
from pathlib import Path

from autoquant.selection import (
    EULER_MASCHERONI,
    NORMAL,
    build_selection_adjustment,
    expected_maximum_sharpe,
    expected_maximum_z,
)
from autoquant.studio import build_studio_snapshot
from autoquant.studio_frontier import (
    CURVE_POINTS,
    factor_noise_frontier,
    portfolio_noise_frontier,
)
from tests.test_selection import fake_run, family

# Values the former browser implementation (studio-app/src/pages/factorMath.ts before this change) produced
# for the same four ledgers. Captured by running that code unmodified; (trials, expected, passLine) rows.
LEGACY_CLIENT_FRONTIER = {
    'A': {
        'ic': 0.045, 'raw_p': 0.0042, 'trials': 12, 'axis_maximum': 50,
        'standard_error': 0.01571922658576952,
        'cleared': False,
        'table': (
            (1.0, 0, 0.03080911799777137),
            (2.0, 0.008170152022794086, 0.035233117327269414),
            (5.0, 0.01874665533562495, 0.04049004451425763),
            (10.0, 0.02475146748842665, 0.04412439986633094),
            (12.0, 0.026169547415185894, 0.04503967493489436),
            (20.0, 0.029877658925804188, 0.047524589126443764),
            (50.0, 0.03578172411073276, 0.051724535228031866),
        ),
        'curve': {
            0: (1, 0, 0.03080911799777137),
            1: (1.050765849261233, 0, 0.03114075975713324),
            40: (7.24833032243024, 0.022099241715839917, 0.042468980982108655),
            79: (49.99999999999999, 0.03578172411073276, 0.05172453522803091),
        },
    },
    'B': {
        'ic': 0.0321, 'raw_p': 0.03, 'trials': 1, 'axis_maximum': 50,
        'standard_error': 0.014792010675263714,
        'cleared': True,
        'table': (
            (1.0, 0, 0.028991808205822346),
            (2.0, 0.00768822659819057, 0.03315485305743971),
            (5.0, 0.017640863202588584, 0.03810169459857569),
            (10.0, 0.02329147489029127, 0.04152167349335402),
            (20.0, 0.028115292274142667, 0.04472129884127274),
            (50.0, 0.03367109966494509, 0.04867350649164564),
        ),
        'curve': {
            0: (1, 0, 0.028991808205822346),
            1: (1.050765849261233, 0, 0.02930388771037539),
            40: (7.24833032243024, 0.020795693578962084, 0.03996390131710605),
            79: (49.99999999999999, 0.03367109966494509, 0.048673506491644744),
        },
    },
    'C': {
        'ic': -0.03, 'raw_p': 0.01, 'trials': 5, 'axis_maximum': 50,
        'standard_error': 0.011646734480793933,
        'cleared': False,
        'table': (
            (1.0, 0, 0.022827180138260395),
            (2.0, 0.006053452487500099, 0.026105022419668784),
            (5.0, 0.013889825679759686, 0.03),
            (10.0, 0.018338928335614197, 0.032692776999141276),
            (20.0, 0.022137040809093303, 0.03521205498530071),
            (50.0, 0.02651149773233743, 0.03832389110598652),
        ),
        'curve': {
            0: (1, 0, 0.022827180138260395),
            1: (1.050765849261233, 0, 0.02307290110251749),
            40: (7.24833032243024, 0.016373833603510746, 0.03146623928789769),
            79: (49.99999999999999, 0.02651149773233743, 0.03832389110598581),
        },
    },
    'D': {
        'ic': 0.0187, 'raw_p': 0.2, 'trials': 40, 'axis_maximum': 160,
        'standard_error': 0.014591687547544427,
        'cleared': False,
        'table': (
            (1.0, 0, 0.028599182089905587),
            (2.0, 0.007584107582015192, 0.03270584825279565),
            (5.0, 0.017401959042093337, 0.03758569641543784),
            (10.0, 0.0229760464335622, 0.0409593597089111),
            (20.0, 0.027734536512891313, 0.04411565362804056),
            (40.0, 0.031948211388819044, 0.04709056287882477),
            (50.0, 0.033215103509540114, 0.04801433788559691),
        ),
        'curve': {
            0: (1, 0, 0.028599182089905587),
            1: (1.0663511777420858, 0, 0.028998099326325043),
            40: (13.062013184755777, 0.02488764271348807, 0.04219926293308372),
            79: (159.99999999999994, 0.03927728241920109, 0.05259882231760461),
        },
    },
}


def factor_sessions(ic: float, raw_p: float, trials: int, *, run_id: str = "run-leader"):
    """One Factor Session ledger whose adjustment is Core output for these inputs."""

    leader = fake_run(
        run_id,
        "a" * 64,
        ic,
        metric="validation_mean_ic",
        metrics={
            "validation_mean_ic": ic,
            "validation": {
                "mean_ic": ic,
                "hac": {"normal_approximation_p_value": raw_p},
            },
        },
    )
    research_family = family(
        unique_trials=trials,
        successful_values=tuple(ic for _ in range(max(1, trials))),
    )
    adjustment = build_selection_adjustment(leader, research_family)
    projection = {**research_family.projection, "totalExecutions": trials + 1}
    return [
        {
            "selectionIntegrity": {
                "selectionMetric": "validation_mean_ic",
                "researchFamily": projection,
                "selectionAdjustment": adjustment,
            }
        }
    ]


def portfolio_adjustment(successful_sharpes, *, unique_trials=None, reproducible=True):
    leader = fake_run(
        "run-portfolio",
        "b" * 64,
        1.60,
        metric="validation_net_sharpe",
        metrics={
            "validation_net_sharpe": 1.60,
            "portfolio": {
                "validation": {
                    "net": {
                        "observations": 252,
                        "annualization_periods": 252,
                        "period_sharpe": 0.10,
                        "return_skewness": 0.0,
                        "return_kurtosis": 3.0,
                    }
                }
            },
        },
    )
    research_family = family(
        unique_trials=unique_trials or len(successful_sharpes),
        successful_values=tuple(successful_sharpes),
        reproducible=reproducible,
    )
    return build_selection_adjustment(leader, research_family), research_family.projection


class ExpectedMaximumZTests(unittest.TestCase):
    def test_closed_form_and_the_sharpe_expectation_built_from_it(self) -> None:
        for trials in (2, 3, 12, 250):
            reference = (
                (1.0 - EULER_MASCHERONI) * NORMAL.inv_cdf(1.0 - 1.0 / trials)
                + EULER_MASCHERONI * NORMAL.inv_cdf(1.0 - 1.0 / (trials * math.e))
            )
            self.assertEqual(expected_maximum_z(trials), reference)
        self.assertEqual(expected_maximum_z(1), 0.0)
        self.assertEqual(expected_maximum_z(0.4), 0.0)
        sharpes = [0.1, 0.3, -0.2, 0.5]
        expected, dispersion = expected_maximum_sharpe(sharpes, 4)
        self.assertEqual(expected, dispersion * expected_maximum_z(4))


class FactorFrontierPinTests(unittest.TestCase):
    def test_server_series_reproduces_the_former_browser_frontier(self) -> None:
        for name, legacy in LEGACY_CLIENT_FRONTIER.items():
            with self.subTest(case=name):
                frontier = factor_noise_frontier(
                    factor_sessions(legacy["ic"], legacy["raw_p"], legacy["trials"]),
                    [],
                )
                self.assertEqual(frontier["status"], "available")
                self.assertEqual(frontier["kind"], "factor-mean-ic")
                self.assertEqual(frontier["trials"], legacy["trials"])
                self.assertEqual(frontier["axisMaximumTrials"], legacy["axis_maximum"])
                self.assertAlmostEqual(
                    frontier["standardError"] / legacy["standard_error"], 1.0, delta=1e-8
                )
                self.assertEqual(len(frontier["curve"]), CURVE_POINTS)
                # The old browser compared the selected IC with its own pass line. The server now
                # carries the published Core verdict, which has to agree on these ledgers.
                self.assertIs(frontier["passes"], legacy["cleared"])
                self.assertEqual(
                    [row["trials"] for row in frontier["table"]],
                    [row[0] for row in legacy["table"]],
                )
                for row, (_, expected, pass_line) in zip(frontier["table"], legacy["table"]):
                    self.assertAlmostEqual(row["expected"], expected, delta=1e-8)
                    self.assertAlmostEqual(row["passLine"] / pass_line, 1.0, delta=1e-8)
                for index, (trials, expected, pass_line) in legacy["curve"].items():
                    row = frontier["curve"][index]
                    self.assertAlmostEqual(row["trials"] / trials, 1.0, delta=1e-12)
                    self.assertAlmostEqual(row["expected"], expected, delta=1e-8)
                    self.assertAlmostEqual(row["passLine"] / pass_line, 1.0, delta=1e-8)
                at_ledger = next(
                    row for row in frontier["table"] if row["trials"] == legacy["trials"]
                )
                self.assertEqual(frontier["expectedAtTrials"], at_ledger["expected"])
                self.assertEqual(frontier["passLineAtTrials"], at_ledger["passLine"])

    def test_curve_is_log_spaced_from_one_trial_to_the_axis_maximum(self) -> None:
        frontier = factor_noise_frontier(factor_sessions(0.045, 0.0042, 40), [])
        trials = [row["trials"] for row in frontier["curve"]]
        self.assertEqual(trials[0], 1.0)
        self.assertEqual(trials[-1], 160.0)
        self.assertEqual(frontier["axisMaximumTrials"], 160)
        self.assertEqual(trials, sorted(trials))
        ratios = [b / a for a, b in zip(trials, trials[1:])]
        self.assertAlmostEqual(max(ratios), min(ratios), places=9)
        expected = [row["expected"] for row in frontier["curve"]]
        self.assertEqual(expected, sorted(expected))
        self.assertTrue(all(math.isfinite(value) for value in expected))
        self.assertEqual(expected[0], 0.0)

    def test_selected_run_is_named_only_when_exactly_one_run_holds_the_value(self) -> None:
        sessions = factor_sessions(0.045, 0.0042, 12)
        runs = [
            {"id": "run-a", "primaryValue": 0.045},
            {"id": "run-b", "primaryValue": 0.01},
            {"id": "run-c", "primaryValue": None},
        ]
        self.assertEqual(factor_noise_frontier(sessions, runs)["leaderRunId"], "run-a")
        runs.append({"id": "run-d", "primaryValue": 0.045 + 1e-14})
        self.assertIsNone(factor_noise_frontier(sessions, runs)["leaderRunId"])
        self.assertIsNone(factor_noise_frontier(sessions, [])["leaderRunId"])

    def test_the_ledger_with_statistics_wins_over_an_earlier_unsupported_one(self) -> None:
        good = factor_sessions(0.045, 0.0042, 12)
        bad = [
            {
                "selectionIntegrity": {
                    "selectionMetric": "validation_mean_ic",
                    "researchFamily": {"trialCountAssumption": "x", "totalExecutions": 1},
                    "selectionAdjustment": {
                        "status": "unsupported",
                        "reason": "missing-factor-hac-evidence",
                        "statistics": None,
                    },
                }
            }
        ]
        self.assertEqual(factor_noise_frontier(bad + good, [])["status"], "available")


class FactorFrontierUnavailableTests(unittest.TestCase):
    def test_every_unavailable_state_carries_a_code_and_no_series(self) -> None:
        good = factor_sessions(0.045, 0.0042, 12)

        def copy(value):
            return json.loads(json.dumps(value))

        def with_statistics(**overrides):
            sessions = copy(good)
            sessions[0]["selectionIntegrity"]["selectionAdjustment"]["statistics"].update(overrides)
            return sessions

        unsupported = copy(good)
        adjustment = unsupported[0]["selectionIntegrity"]["selectionAdjustment"]
        adjustment.update(status="unsupported", reason="missing-factor-hac-evidence", statistics=None)
        no_family = copy(good)
        del no_family[0]["selectionIntegrity"]["researchFamily"]
        cases = {
            "no-factor-ledger": ([], None),
            "no-adjustment": (no_family, None),
            "adjustment-unavailable": (
                unsupported,
                {"status": "unsupported", "reason": "missing-factor-hac-evidence"},
            ),
            "degenerate-p-value": (with_statistics(rawHacPValue=1.0), None),
        }
        for code, (sessions, detail) in cases.items():
            with self.subTest(code=code):
                frontier = factor_noise_frontier(sessions, [])
                self.assertEqual(frontier["status"], "unavailable")
                self.assertEqual(frontier["reasonCode"], code)
                self.assertEqual(frontier["detail"], detail)
                self.assertNotIn("curve", frontier)
        for overrides in ({"rawHacPValue": 0.0}, {"observedMeanIc": 0.0}, {"uniqueTrials": 0}):
            with self.subTest(overrides=overrides):
                self.assertEqual(
                    factor_noise_frontier(with_statistics(**overrides), [])["reasonCode"],
                    "degenerate-p-value",
                )
        # A HAC p this small rounds 1 - p/2 to 1.0; the frontier must still
        # publish (regression: StatisticsError broke the whole Studio snapshot).
        for tiny in (1e-17, 1e-300):
            with self.subTest(rawHacPValue=tiny):
                frontier = factor_noise_frontier(with_statistics(rawHacPValue=tiny), [])
                self.assertEqual(frontier["status"], "available", frontier)
                self.assertTrue(all(row["expected"] >= 0.0 for row in frontier["curve"]))
        frontier = factor_noise_frontier(with_statistics(rawHacPValue=5e-324), [])
        self.assertEqual(frontier["reasonCode"], "degenerate-p-value")
        other_metric = copy(good)
        other_metric[0]["selectionIntegrity"]["selectionMetric"] = "validation_net_sharpe"
        self.assertEqual(
            factor_noise_frontier(other_metric, [])["reasonCode"], "no-factor-ledger"
        )


class PortfolioFrontierTests(unittest.TestCase):
    def test_curve_is_trial_dispersion_times_core_expected_maximum(self) -> None:
        adjustment, projection = portfolio_adjustment([0.8, 1.0, 1.2, 1.6])
        stats = adjustment["statistics"]
        frontier = portfolio_noise_frontier(adjustment, projection)
        self.assertEqual(frontier["status"], "available")
        self.assertEqual(frontier["kind"], "portfolio-net-sharpe")
        self.assertEqual(frontier["trials"], 4)
        self.assertEqual(frontier["axisMaximumTrials"], 50)
        self.assertEqual(frontier["selectedValue"], stats["observedAnnualizedSharpe"])
        self.assertEqual(frontier["expectedAtTrials"], stats["expectedMaximumAnnualizedSharpe"])
        self.assertIs(frontier["passes"], adjustment["passes"])
        self.assertEqual(frontier["deflatedSharpeProbability"], stats["deflatedSharpeProbability"])
        dispersion = stats["trialSharpeDispersionAnnualized"]
        self.assertEqual(frontier["trialDispersion"], dispersion)
        self.assertEqual(len(frontier["curve"]), CURVE_POINTS)
        for row in frontier["curve"]:
            self.assertEqual(
                row["expected"], dispersion * max(0.0, expected_maximum_z(row["trials"]))
            )
        # The series passes through the value Core published at the trial count of the ledger.
        row = next(item for item in frontier["table"] if item["trials"] == 4.0)
        self.assertAlmostEqual(row["expected"], stats["expectedMaximumAnnualizedSharpe"], places=12)
        self.assertEqual(frontier["trialCountAssumption"], "unique-source-upper-bound")

    def test_no_series_without_core_evidence_or_trial_spread(self) -> None:
        self.assertEqual(portfolio_noise_frontier(None, None)["reasonCode"], "no-adjustment")

        single, projection = portfolio_adjustment([1.6])
        self.assertEqual(single["status"], "available")
        frontier = portfolio_noise_frontier(single, projection)
        self.assertEqual(frontier["status"], "unavailable")
        self.assertEqual(frontier["reasonCode"], "no-trial-dispersion")
        self.assertNotIn("curve", frontier)

        identical, projection = portfolio_adjustment([1.0, 1.0, 1.0])
        self.assertEqual(
            portfolio_noise_frontier(identical, projection)["reasonCode"], "no-trial-dispersion"
        )

        refused, projection = portfolio_adjustment([0.8, 1.0, 1.2, 1.6], reproducible=False)
        frontier = portfolio_noise_frontier(refused, projection)
        self.assertEqual(frontier["reasonCode"], "adjustment-unavailable")
        self.assertEqual(
            frontier["detail"],
            {"status": "unsupported", "reason": "non-reproducible-research-family"},
        )

        too_few, projection = portfolio_adjustment([1.6], unique_trials=4)
        self.assertEqual(
            portfolio_noise_frontier(too_few, projection)["detail"]["reason"],
            "insufficient-successful-sharpe-trials",
        )

        factor_adjustment = factor_sessions(0.045, 0.0042, 12)[0]["selectionIntegrity"][
            "selectionAdjustment"
        ]
        self.assertEqual(
            portfolio_noise_frontier(factor_adjustment, None)["reasonCode"],
            "adjustment-unavailable",
        )

    def test_incomplete_statistics_are_refused_not_defaulted(self) -> None:
        adjustment, projection = portfolio_adjustment([0.8, 1.0, 1.2, 1.6])
        broken = json.loads(json.dumps(adjustment))
        del broken["statistics"]["trialSharpeDispersionAnnualized"]
        self.assertEqual(
            portfolio_noise_frontier(broken, projection)["reasonCode"],
            "incomplete-trial-statistics",
        )


FRONTEND_FIXTURE = Path(__file__).resolve().parents[1] / "studio-app/tests/noise-frontier.fixture.json"


def frontend_fixture() -> dict:
    """The exact payloads studio-app/tests/noise-frontier.test.tsx renders."""

    factor = factor_sessions(0.045, 0.0042, 12)
    single, projection = portfolio_adjustment([1.6])
    adjustment, family_projection = portfolio_adjustment([0.8, 1.0, 1.2, 1.6])
    return {
        "factor": factor_noise_frontier(factor, [{"id": "run-leader", "primaryValue": 0.045}]),
        "factorUnavailable": factor_noise_frontier([], []),
        "portfolio": portfolio_noise_frontier(adjustment, family_projection),
        "portfolioUnavailable": portfolio_noise_frontier(single, projection),
    }


def assert_close(test: unittest.TestCase, actual, expected, path: str = "") -> None:
    if isinstance(expected, dict):
        test.assertEqual(actual.keys(), expected.keys(), path)
        for key in expected:
            assert_close(test, actual[key], expected[key], f"{path}.{key}")
    elif isinstance(expected, list):
        test.assertEqual(len(actual), len(expected), path)
        for index, (left, right) in enumerate(zip(actual, expected)):
            assert_close(test, left, right, f"{path}[{index}]")
    elif isinstance(expected, float):
        test.assertAlmostEqual(actual, expected, delta=1e-12 * max(1.0, abs(expected)), msg=path)
    else:
        test.assertEqual(actual, expected, path)


class FrontendFixtureTests(unittest.TestCase):
    def test_checked_in_fixture_is_what_the_server_publishes(self) -> None:
        # Regenerate with: uv run python -m tests.test_studio_frontier --write-fixture
        recorded = json.loads(FRONTEND_FIXTURE.read_text(encoding="utf-8"))
        assert_close(self, json.loads(json.dumps(frontend_fixture())), recorded)


class StudioProjectionTests(unittest.TestCase):
    def test_sample_desk_publishes_both_read_model_fields(self) -> None:
        root = Path(__file__).resolve().parents[1] / "projects/sample-research-desk"
        snapshot = build_studio_snapshot(root)["projects"][0]
        # The sample has no Factor Session ledger and a single Portfolio trial: neither draws a line.
        self.assertEqual(snapshot["noiseFrontier"]["status"], "unavailable")
        self.assertEqual(snapshot["noiseFrontier"]["reasonCode"], "no-factor-ledger")
        strategy = snapshot["library"]["strategy"]["evidence"]["noiseFrontier"]
        self.assertEqual(strategy["status"], "unavailable")
        self.assertEqual(strategy["reasonCode"], "no-trial-dispersion")
        json.dumps(snapshot)


if __name__ == "__main__":
    import sys

    if "--write-fixture" in sys.argv:
        FRONTEND_FIXTURE.write_text(
            json.dumps(frontend_fixture(), indent=1) + "\n", encoding="utf-8"
        )
    else:
        unittest.main()
