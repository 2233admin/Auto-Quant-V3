from __future__ import annotations

import unittest

from autoquant.event_envelope import (
    build_event_envelope,
    guard_status,
    per_year,
    quantile_summary,
    rate,
    stability_split,
    wilson_interval,
)


def _event(index: int, timestamp: str, asset: float, reference: float, primary: bool = True):
    return {
        "eventIndex": index,
        "eventTimestamp": timestamp,
        "primaryEligible": primary,
        "assetReturn": asset,
        "referenceReturn": reference,
        "excessReturn": asset - reference,
    }


class WilsonTests(unittest.TestCase):
    def test_wilson_matches_published_values(self) -> None:
        # Hand-checked Wilson 95% score intervals.
        for successes, count, low, high in (
            (8, 10, 0.4902, 0.9433),
            (0, 10, 0.0, 0.2775),
            (5, 10, 0.2366, 0.7634),
            (24, 30, 0.6269, 0.9049),
        ):
            interval = wilson_interval(successes, count)
            self.assertIsNotNone(interval)
            self.assertAlmostEqual(interval[0], low, places=4)
            self.assertAlmostEqual(interval[1], high, places=4)

    def test_wilson_edges_and_impossible_counts(self) -> None:
        self.assertIsNone(wilson_interval(0, 0))
        low, high = wilson_interval(10, 10)
        self.assertAlmostEqual(high, 1.0, places=12)
        self.assertGreater(low, 0.6)
        with self.assertRaises(ValueError):
            wilson_interval(11, 10)
        with self.assertRaises(ValueError):
            wilson_interval(-1, 10)


class GuardTests(unittest.TestCase):
    def test_guard_floors(self) -> None:
        self.assertEqual(guard_status(0), "withheld")
        self.assertEqual(guard_status(9), "withheld")
        self.assertEqual(guard_status(10), "small-sample")
        self.assertEqual(guard_status(29), "small-sample")
        self.assertEqual(guard_status(30), "ok")

    def test_rate_never_leaves_without_n(self) -> None:
        withheld = rate(3, 9)
        self.assertEqual(withheld["n"], 9)
        self.assertEqual(withheld["successes"], 3)
        self.assertIsNone(withheld["estimate"])
        self.assertIsNone(withheld["ci95"])
        small = rate(8, 10)
        self.assertEqual(small["guard"], "small-sample")
        self.assertAlmostEqual(small["estimate"], 0.8)
        self.assertAlmostEqual(small["ci95"][0], 0.4902, places=4)
        ok = rate(24, 30)
        self.assertEqual(ok["guard"], "ok")
        self.assertEqual(ok["n"], 30)


class StabilityTests(unittest.TestCase):
    def test_halves_split_chronologically_and_compare_intervals(self) -> None:
        flags = [True] * 10 + [False] * 10
        split = stability_split(flags)
        self.assertEqual(split["firstHalf"]["n"], 10)
        self.assertEqual(split["firstHalf"]["successes"], 10)
        self.assertEqual(split["secondHalf"]["successes"], 0)
        # Wilson [0.7225, 1.0] versus [0.0, 0.2775] do not overlap.
        self.assertIs(split["agree"], False)
        agree = stability_split([True, False] * 10)
        self.assertIs(agree["agree"], True)

    def test_small_halves_are_withheld_not_assessed(self) -> None:
        split = stability_split([True, False, True, True, False])
        self.assertEqual(split["firstHalf"]["n"], 2)
        self.assertEqual(split["secondHalf"]["n"], 3)
        self.assertIsNone(split["firstHalf"]["estimate"])
        self.assertIsNone(split["agree"])
        self.assertIsNone(stability_split([])["agree"])


class PerYearAndQuantileTests(unittest.TestCase):
    def test_per_year_counts(self) -> None:
        rows = per_year(
            ["2023-03-01", "2023-09-01", "2024-01-02"],
            [True, False, True],
        )
        self.assertEqual([row["year"] for row in rows], [2023, 2024])
        self.assertEqual((rows[0]["n"], rows[0]["successes"]), (2, 1))
        self.assertEqual((rows[1]["n"], rows[1]["successes"]), (1, 1))
        self.assertIsNone(rows[0]["estimate"])

    def test_quantiles(self) -> None:
        summary = quantile_summary([1.0, 2.0, 3.0, 4.0, 5.0])
        self.assertEqual(summary["n"], 5)
        self.assertAlmostEqual(summary["quantiles"]["p50"], 3.0)
        self.assertAlmostEqual(summary["quantiles"]["p10"], 1.4)
        self.assertAlmostEqual(summary["quantiles"]["p90"], 4.6)
        empty = quantile_summary([])
        self.assertEqual(empty["n"], 0)
        self.assertIsNone(empty["mean"])


class EnvelopeTests(unittest.TestCase):
    def test_envelope_uses_primary_events_and_labels_unconditional_overlap(self) -> None:
        events = [
            _event(1, "2023-01-05", 0.02, 0.01),
            _event(2, "2023-02-06", -0.01, 0.00),
            _event(3, "2024-01-09", 0.03, 0.01, primary=False),
            _event(4, "2024-02-12", 0.04, 0.02),
        ]
        envelope = build_event_envelope(events, [0.01, -0.02, 0.03, 0.01])
        positive = envelope["outcomes"]["primaryPositiveReturn"]
        self.assertEqual((positive["n"], positive["successes"]), (3, 2))
        self.assertEqual(positive["guard"], "withheld")
        self.assertEqual(
            [row["year"] for row in positive["perYear"]], [2023, 2024]
        )
        excess = envelope["outcomes"]["primaryPositiveExcess"]
        self.assertEqual((excess["n"], excess["successes"]), (3, 2))
        unconditional = envelope["unconditionalPositiveReturn"]
        self.assertEqual((unconditional["n"], unconditional["successes"]), (4, 3))
        self.assertIsNone(unconditional["ci95"])
        self.assertEqual(
            unconditional["intervalWithheldReason"], "overlapping-observations"
        )
        self.assertEqual(envelope["returnDistribution"]["n"], 3)
        self.assertIn("Not predictions", envelope["disclaimer"])

    def test_empty_primary_population_has_n_zero_everywhere(self) -> None:
        envelope = build_event_envelope([], [0.01])
        positive = envelope["outcomes"]["primaryPositiveReturn"]
        self.assertEqual(positive["n"], 0)
        self.assertIsNone(positive["estimate"])
        self.assertEqual(positive["perYear"], [])
        self.assertIsNone(envelope["returnDistribution"]["mean"])


if __name__ == "__main__":
    unittest.main()
