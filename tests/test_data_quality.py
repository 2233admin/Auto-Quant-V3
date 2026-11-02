from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import pandas as pd

from autoquant.cli import main
from autoquant.data_quality import quality_report
from autoquant.data_sources import inspect_source
from autoquant.ohlcv import normalize_ohlcv
from tests.intake_helpers import write_intake_inputs, write_observed_intraday_inputs, write_cross_market_daily_inputs


OPTIONS = {"calendar": "weekdays", "timezone": "America/New_York", "frequency": "1d", "universeStatus": "contains-delisted"}


def small_frame(dates=None):
    dates = dates if dates is not None else pd.bdate_range("2024-01-02", periods=10).strftime("%Y-%m-%d")
    return pd.DataFrame({"date": dates, "open": 100.0, "high": 102.0, "low": 98.0, "close": 101.0, "volume": 1000.0})


class DataQualityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.file = self.root / "TEST.csv"

    def report(self, frame=None, options=None):
        (small_frame() if frame is None else frame).to_csv(self.file, index=False)
        return quality_report(self.file, OPTIONS if options is None else options)

    def checks(self, report):
        return {c["id"]: c for c in report["assets"][0]["checks"]}

    def test_clean_and_deterministic(self):
        report = self.report()
        self.assertEqual(report["verdict"], "pass")
        self.assertEqual(report, quality_report(self.file, OPTIONS))
        self.assertEqual(report["assets"][0]["rows"], 10)
        self.assertEqual(report["assets"][0]["missingBarRate"], 0)
        self.assertEqual(report["schemaVersion"], 1)

    def test_missing_bars_rate_and_long_gap(self):
        frame = small_frame().drop(index=range(2, 8))
        checks = self.checks(self.report(frame))
        self.assertEqual(checks["missing-bars"]["count"], 6)
        self.assertAlmostEqual(checks["missing-bars"]["rate"], .6)
        self.assertEqual(checks["long-gaps"]["count"], 1)
        self.assertEqual(checks["long-gaps"]["examples"][0]["missingBars"], 6)
        self.assertEqual(len(checks["missing-bars"]["examples"]), 5)

    def test_zero_volume(self):
        frame = small_frame(); frame.loc[1, "volume"] = 0
        check = self.checks(self.report(frame))["zero-volume"]
        self.assertEqual((check["verdict"], check["count"]), ("warn", 1))

    def test_negative_and_nonfinite_volume(self):
        frame = small_frame(); frame.loc[0, "volume"] = -1; frame.loc[1, "volume"] = float("inf")
        self.assertEqual(self.checks(self.report(frame))["volume"]["count"], 2)

    def test_jump_threshold_and_adjustment_hint(self):
        frame = small_frame(); frame.loc[5:, ["open", "high", "low", "close"]] *= 1.4
        check = self.checks(self.report(frame, {**OPTIONS, "priceAdjustment": "raw"}))["price-jumps"]
        self.assertEqual(check["count"], 1)
        self.assertAlmostEqual(check["examples"][0]["return"], .4)
        self.assertIn("corporate actions", check["hint"])
        self.assertEqual(self.checks(self.report(frame, {**OPTIONS, "jumpThreshold": .5}))["price-jumps"]["count"], 0)

    def test_duplicates_preserve_original_row_examples(self):
        frame = pd.concat([small_frame(), small_frame().iloc[[0]]], ignore_index=True)
        checks = self.checks(self.report(frame))
        self.assertEqual(checks["duplicates"]["examples"][0]["row"], 12)
        self.assertEqual(checks["duplicates"]["verdict"], "fail")
        self.assertEqual(checks["intake-ohlcv"]["verdict"], "fail")

    def test_non_monotonic_timestamps(self):
        frame = small_frame().iloc[::-1]
        self.assertEqual(self.checks(self.report(frame))["ordering"]["count"], 9)

    def test_nonpositive_and_nonfinite_prices(self):
        frame = small_frame(); frame.loc[0, "low"] = 0; frame.loc[1, "open"] = -1; frame.loc[2, "high"] = float("inf")
        self.assertEqual(self.checks(self.report(frame))["prices"]["count"], 3)

    def test_ohlc_consistency(self):
        frame = small_frame(); frame.loc[0, "low"] = 105; frame.loc[1, "high"] = 99
        self.assertEqual(self.checks(self.report(frame))["ohlc"]["count"], 2)

    def test_invalid_values_and_missing_columns(self):
        frame = small_frame(); frame.loc[0, "date"] = "bad"
        self.assertEqual(self.checks(self.report(frame))["parsing"]["verdict"], "fail")
        self.assertEqual(self.report(frame.drop(columns="volume"))["verdict"], "fail")
        frame = small_frame().iloc[:0]
        frame["asset"] = []
        frame.to_csv(self.file, index=False)
        with self.assertRaisesRegex(ValueError, "No asset observations"):
            quality_report(self.file, OPTIONS)

    def test_unknown_calendar_and_survivorship(self):
        checks = self.checks(self.report(options={}))
        self.assertIsNone(checks["missing-bars"]["rate"])
        self.assertEqual(checks["survivorship"]["coverage"], "unknown")
        self.assertEqual(checks["timezone"]["verdict"], "warn")
        self.assertEqual(self.checks(self.report(options={**OPTIONS, "universeStatus": "currently-listed-only"}))["survivorship"]["verdict"], "warn")

    def test_timezone_and_session_alignment(self):
        frame = small_frame(["2024-01-06", "2024-01-08"])
        checks = self.checks(self.report(frame, {**OPTIONS, "timezone": "invalid/timezone"}))
        self.assertEqual(checks["session-alignment"]["count"], 1)
        self.assertEqual(checks["timezone"]["verdict"], "fail")

    def test_exchange_calendar_holiday(self):
        frame = small_frame(["2024-07-03", "2024-07-05"])
        check = self.checks(self.report(frame, {**OPTIONS, "calendar": "XNYS"}))["missing-bars"]
        self.assertEqual(check["count"], 0)
        self.assertEqual(check["expectedBars"], 2)

    def test_continuous_frequency_and_declared_boundaries(self):
        frame = small_frame(["2024-01-02T01:00:00Z", "2024-01-02T03:00:00Z"])
        options = {**OPTIONS, "calendar": "24/7", "frequency": "1h", "start": "2024-01-02T00:00:00Z"}
        checks = self.checks(self.report(frame, options))
        self.assertEqual(checks["missing-bars"]["count"], 2)

    def test_cross_asset_alignment(self):
        self.report()
        small_frame().iloc[:-1].to_csv(self.root / "OTHER.csv", index=False)
        report = quality_report(self.root, OPTIONS)
        check = report["summary"][-1]
        self.assertEqual(check["id"], "cross-asset-alignment")
        self.assertEqual(check["verdict"], "warn")

    def test_mapping_and_asset_column(self):
        frame = small_frame().rename(columns={"date": "Day", "close": "Last"})
        frame["Ticker"] = "AAA"
        frame.to_csv(self.file, index=False)
        report = quality_report(self.file, {**OPTIONS, "mapping": {"timestamp": "Day", "close": "Last", "asset": "Ticker"}})
        self.assertEqual(report["assets"][0]["asset"], "AAA")
        self.assertEqual(report["verdict"], "pass")

    def test_package_authority_and_no_mutation(self):
        _, package = write_intake_inputs(self.root, observations=10)
        before = {p: p.read_bytes() for p in package.parent.iterdir()}
        report = quality_report(package)
        self.assertEqual(len(report["assets"]), 5)
        self.assertEqual(before, {p: p.read_bytes() for p in package.parent.iterdir()})
        self.assertEqual(inspect_source(package)["package"]["schemaVersion"], 1)

    def test_cli_envelope_and_bad_threshold(self):
        self.report()
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["data", "check", str(self.file), "--json"])
        payload = json.loads(out.getvalue())
        self.assertEqual(code, 0)
        self.assertEqual(payload["command"], "data.check")
        self.assertTrue(payload["ok"])
        for option in ({"jumpThreshold": 0}, {"jumpThreshold": float("nan")}, {"longGapBars": 0}, {"universeStatus": "invented"}, []):
            with self.assertRaises(ValueError):
                quality_report(self.file, option)

    def test_strict_normalization_behavior_unchanged(self):
        frame = small_frame().iloc[::-1]
        self.assertTrue(normalize_ohlcv(frame).date.is_monotonic_increasing)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            normalize_ohlcv(pd.concat([frame, frame.iloc[[0]]]))

    def test_v5_observed_hourly_keeps_unknown_calendar_and_zero_volume(self):
        _, package = write_observed_intraday_inputs(self.root, observations=40)
        report = quality_report(package)
        self.assertEqual(report["frequency"], "1h")
        self.assertEqual(len(report["assets"]), 2)
        self.assertTrue(all(a["missingBarRate"] is None for a in report["assets"]))
        self.assertTrue(any(c["id"] == "zero-volume" and c["count"] > 0 for a in report["assets"] for c in a["checks"]))
        self.assertTrue(all(c["verdict"] == "pass" for a in report["assets"] for c in a["checks"] if c["id"] == "timezone"))

    def test_cross_market_v5_preserves_asynchronous_utc_times(self):
        _, package = write_cross_market_daily_inputs(self.root, observations=10)
        report = quality_report(package)
        self.assertEqual(report["frequency"], "1d")
        self.assertNotEqual(report["assets"][0]["dateRange"]["start"], report["assets"][1]["dateRange"]["start"])
        self.assertEqual(report["summary"][-1]["verdict"], "warn")

    def test_intraday_naive_timestamps_are_not_assumed_to_be_utc(self):
        frame = small_frame(["2024-01-02 01:00:00", "2024-01-02 02:00:00"])
        report = self.report(frame, {**OPTIONS, "calendar": "24/7", "frequency": "1h"})
        self.assertEqual(self.checks(report)["timezone"]["verdict"], "fail")

    def test_xnys_early_close_uses_exact_scheduled_close(self):
        frame = small_frame(["2024-07-03T17:00:00Z", "2024-07-05T20:00:00Z"])
        report = self.report(frame, {**OPTIONS, "calendar": "XNYS"})
        checks = self.checks(report)
        self.assertEqual(checks["session-alignment"]["count"], 0)
        self.assertEqual(checks["missing-bars"]["count"], 0)
