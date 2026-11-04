#!/usr/bin/env python3
"""Package OpenAlice BarService daily bars into an AutoQuant staging package.

Input is the documented `alice market bars --output FILE` JSON
(`{"bars": [{date, open, high, low, close, volume}], "meta": {barId, interval,
freshness, quality, truncatedRows, ...}}`), one file per asset, either supplied
by the caller or exported here with `--fetch-start/--fetch-end` when the
`alice` CLI is on PATH. Caller-owned facts (adjustment, timezone, calendar,
panel policy, terms) are required and never defaulted; OpenAlice bar metadata
does not carry them. The script never fills, repairs, or relabels bars.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


PACKAGE_KIND = "autoquant-ohlcv-dataset-package"
PROVENANCE_KIND = "autoquant-openalice-bars-provenance"
SOURCE_URI_PREFIX = "openalice-bars:v1?"
ADJUSTMENTS = ("raw", "split-adjusted", "split-and-dividend-adjusted", "provider-adjusted")
SAFE_SYMBOL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._=-]{0,63}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ASSET_KEYS = {"symbol", "barId", "venue", "currency"}
OPTIONAL_ASSET_KEYS = {"assetClass", "barsFile"}


class Refusal(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_uri(bar_ids: dict[str, str], *, interval: str, timezone: str, adjustment: str) -> str:
    """Same encoding as autoquant.market_data_identity.encode_openalice_source_uri."""
    pairs = [("interval", interval), ("timezone", timezone), ("adjustment", adjustment)]
    pairs += [(f"bar.{symbol}", bar_ids[symbol]) for symbol in sorted(bar_ids)]
    return SOURCE_URI_PREFIX + urlencode(pairs)


def parse_bar_id(bar_id: object) -> tuple[str, str]:
    # OpenAlice splits on the FIRST "|"; the native symbol may contain separators.
    if not isinstance(bar_id, str) or "|" not in bar_id:
        raise Refusal("openalice.bar-id", f"barId must be '{{sourceId}}|{{nativeSymbol}}': {bar_id!r}")
    source, native = bar_id.split("|", 1)
    if not source or not native:
        raise Refusal("openalice.bar-id", f"barId must be '{{sourceId}}|{{nativeSymbol}}': {bar_id!r}")
    return source, native


def load_assets(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise Refusal("openalice.assets", "The assets file must be a non-empty JSON array")
    symbols = set()
    for index, asset in enumerate(raw):
        if not isinstance(asset, dict) or not ASSET_KEYS <= set(asset) or set(asset) - ASSET_KEYS - OPTIONAL_ASSET_KEYS:
            raise Refusal("openalice.assets", f"assets[{index}] needs exactly symbol, barId, venue, currency "
                                              "and optional assetClass, barsFile")
        if not all(isinstance(asset[k], str) and asset[k].strip() for k in ASSET_KEYS):
            raise Refusal("openalice.assets", f"assets[{index}] has an empty caller-owned field")
        if not SAFE_SYMBOL.fullmatch(asset["symbol"]) or asset["symbol"] in symbols:
            raise Refusal("openalice.assets", f"assets[{index}].symbol must be path-safe and unique")
        parse_bar_id(asset["barId"])
        symbols.add(asset["symbol"])
    classes = ["assetClass" in asset for asset in raw]
    if any(classes) and not all(classes):
        raise Refusal("openalice.assets", "Supply assetClass on every asset or on none")
    return raw


def fetch_with_alice(asset: dict, args: argparse.Namespace, destination: Path) -> Path:
    executable = shutil.which("alice")
    if executable is None:
        raise Refusal("openalice.cli-unavailable", "The alice CLI is not on PATH; export bars in OpenAlice "
                                                   "(alice market bars --output FILE) and pass barsFile")
    target = destination / f"{asset['symbol']}.alice-bars.json"
    command = [executable, "market", "bars", "--bar-id", asset["barId"], "--interval", args.interval,
               "--start", args.fetch_start, "--end", args.fetch_end, "--output", str(target)]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
    if completed.returncode != 0 or not target.is_file():
        raise Refusal("openalice.cli-failed", f"alice market bars failed for {asset['barId']}: "
                                              f"{(completed.stderr or completed.stdout).strip()[:400]}")
    return target


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_bars(symbol: str, bar_id: str, raw_bytes: bytes, interval: str) -> tuple[list[dict], dict]:
    try:
        document = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise Refusal("openalice.json", f"{symbol}: bars file is not UTF-8 JSON: {error}") from error
    if not isinstance(document, dict) or not isinstance(document.get("bars"), list) or not isinstance(document.get("meta"), dict):
        raise Refusal("openalice.shape", f"{symbol}: expected the alice market bars object {{bars, meta}}")
    meta = document["meta"]
    if meta.get("barId") != bar_id:
        raise Refusal("openalice.bar-id-mismatch", f"{symbol}: meta.barId {meta.get('barId')!r} differs from the "
                                                   f"caller's exact barId {bar_id!r}; bars from another source are a different series")
    if meta.get("interval") != interval:
        raise Refusal("openalice.interval", f"{symbol}: meta.interval {meta.get('interval')!r} differs from {interval}")
    if (meta.get("truncatedRows") or 0) > 0:
        raise Refusal("openalice.truncated", f"{symbol}: OpenAlice truncated {meta['truncatedRows']} rows at its "
                                             "response ceiling; request a narrower window")
    freshness = meta.get("freshness") if isinstance(meta.get("freshness"), dict) else {}
    if freshness.get("timestampKind") not in (None, "date"):
        raise Refusal("openalice.timestamp", f"{symbol}: daily packaging requires date-labelled bars")
    rows, previous = [], None
    for index, bar in enumerate(document["bars"]):
        if not isinstance(bar, dict) or not isinstance(bar.get("date"), str) or not DATE.fullmatch(bar["date"]):
            raise Refusal("openalice.date", f"{symbol}: bars[{index}].date must be YYYY-MM-DD")
        values = [bar.get(k) for k in ("open", "high", "low", "close")]
        if not all(finite(v) and v > 0 for v in values):
            raise Refusal("openalice.ohlc", f"{symbol}: bars[{index}] has missing or non-positive OHLC; no fill")
        open_, high, low, close = values
        if high < max(open_, close) or low > min(open_, close):
            raise Refusal("openalice.ohlc-bounds", f"{symbol}: bars[{index}] high/low do not contain open/close")
        volume = bar.get("volume")
        if not finite(volume) or volume < 0:
            raise Refusal("openalice.volume", f"{symbol}: bars[{index}].volume is missing or negative; "
                                              "OpenAlice reports null volume for some sources and Core never invents it")
        if previous is not None and bar["date"] <= previous:
            raise Refusal("openalice.order", f"{symbol}: bar dates must be strictly increasing")
        previous = bar["date"]
        rows.append({"date": bar["date"], "open": open_, "high": high, "low": low, "close": close, "volume": volume})
    if not rows:
        raise Refusal("openalice.empty", f"{symbol}: no bars")
    return rows, meta


def write_csv(path: Path, rows: list[dict]) -> None:
    lines = ["date,open,high,low,close,volume"]
    lines += [f"{r['date']},{r['open']!r},{r['high']!r},{r['low']!r},{r['close']!r},{r['volume']!r}" for r in rows]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


CALLER_FACTS = ("adjustment", "timezone", "calendar", "panel", "terms")


def build(args: argparse.Namespace) -> dict:
    missing = [f"--{name}" for name in CALLER_FACTS if getattr(args, name) in (None, "")]
    if missing:
        raise Refusal("openalice.caller-fact-missing",
                      "Caller-owned facts are required and never defaulted: " + ", ".join(missing))
    if args.interval != "1d":
        raise Refusal("openalice.interval", "Only completed daily (1d) bars are packaged: OpenAlice intraday "
                                            "timestamps are provider bar labels, not verified bar-close instants")
    try:
        ZoneInfo(args.timezone)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise Refusal("openalice.timezone", f"--timezone must be an IANA name: {args.timezone}") from error
    output = Path(args.output).expanduser().absolute()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise Refusal("openalice.output", f"Output directory must be absent or empty: {output}")
    assets = load_assets(Path(args.assets))
    base = Path(args.assets).expanduser().absolute().parent
    output.mkdir(parents=True, exist_ok=True)
    try:
        return _package(args, output, assets, base)
    except Refusal:
        # A refused route leaves no partial package behind (raw exports included).
        shutil.rmtree(output, ignore_errors=True)
        raise


def _package(args: argparse.Namespace, output: Path, assets: list[dict], base: Path) -> dict:
    (output / "raw").mkdir()
    records, frames, fetched = [], {}, []
    for asset in assets:
        if "barsFile" in asset:
            source = (base / asset["barsFile"]).resolve()
        elif args.fetch_start and args.fetch_end:
            source = fetch_with_alice(asset, args, output / "raw")
        else:
            raise Refusal("openalice.bars-file", f"{asset['symbol']}: supply barsFile or --fetch-start/--fetch-end")
        raw_bytes = source.read_bytes()
        rows, meta = validate_bars(asset["symbol"], asset["barId"], raw_bytes, args.interval)
        raw_target = output / "raw" / f"{asset['symbol']}.alice-bars.json"
        if raw_target.resolve() != source:
            raw_target.write_bytes(raw_bytes)
        write_csv(output / f"{asset['symbol']}.csv", rows)
        frames[asset["symbol"]] = rows
        freshness = meta.get("freshness") if isinstance(meta.get("freshness"), dict) else {}
        if isinstance(freshness.get("fetchedAt"), str):
            fetched.append(freshness["fetchedAt"])
        records.append({
            "symbol": asset["symbol"], "barId": asset["barId"], "sourceId": parse_bar_id(asset["barId"])[0],
            "rawPath": f"raw/{raw_target.name}", "rawSha256": sha256(raw_bytes),
            "csvPath": f"{asset['symbol']}.csv", "csvSha256": sha256((output / f"{asset['symbol']}.csv").read_bytes()),
            "rows": len(rows), "first": rows[0]["date"], "last": rows[-1]["date"],
            "meta": {k: meta.get(k) for k in ("provider", "barCapability", "source", "from", "to", "bars",
                                               "quality", "freshness", "truncatedRows")},
        })
    date_sets = {symbol: [r["date"] for r in rows] for symbol, rows in frames.items()}
    if args.panel == "aligned" and len({tuple(v) for v in date_sets.values()}) != 1:
        counts = ", ".join(f"{s}={len(v)}" for s, v in sorted(date_sets.items()))
        raise Refusal("openalice.panel-misaligned", f"Aligned packaging needs identical dates for every asset ({counts}); "
                                                    "choose --panel observed-only for a Factor-only V4 package or re-export")
    bar_ids = {asset["symbol"]: asset["barId"] for asset in assets}
    package = {
        "schemaVersion": 1 if args.panel == "aligned" else 4,
        "kind": PACKAGE_KIND, "id": args.dataset_id, "version": args.dataset_version,
        "assetClass": args.asset_class, "frequency": "1d",
        "market": {"clock": "session", "calendar": args.calendar, "timezone": args.timezone},
        "priceAdjustment": args.adjustment,
        "provider": {
            "name": "openalice",
            # Earliest per-file OpenAlice fetch time; null when the export did not record one.
            "retrievedAt": min(fetched) if len(fetched) == len(assets) else None,
            "sourceUri": source_uri(bar_ids, interval=args.interval, timezone=args.timezone, adjustment=args.adjustment),
            "terms": args.terms,
        },
        "assets": [{"symbol": a["symbol"], **({"assetClass": a["assetClass"]} if "assetClass" in a else {}),
                    "venue": a["venue"], "currency": a["currency"], "path": f"{a['symbol']}.csv"} for a in assets],
    }
    if args.panel == "observed-only":
        package["panelPolicy"] = {"alignment": "observed-only", "missingObservation": "absent-no-fill"}
    manifest_bytes = (json.dumps(package, indent=2, sort_keys=True) + "\n").encode("utf-8")
    (output / "dataset-package.json").write_bytes(manifest_bytes)
    provenance = {
        "schemaVersion": 1, "kind": PROVENANCE_KIND,
        "source": {"system": "openalice", "surface": "alice market bars", "barIdFormat": "{sourceId}|{nativeSymbol}"},
        "callerOwned": {"interval": args.interval, "timezone": args.timezone, "calendar": args.calendar,
                        "adjustment": args.adjustment, "panel": args.panel, "terms": args.terms},
        "packageSha256": sha256(manifest_bytes), "assets": records,
        "limitations": [
            "OpenAlice bar metadata carries no adjustment or exchange-calendar claim; both are caller statements.",
            "freshness.recordAgeSeconds is record age, not measured feed latency.",
            "Rows OpenAlice excluded for invalid OHLC are reported in meta.quality and are absent here, never filled.",
        ],
    }
    (output / "openalice-provenance.json").write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n",
                                                      encoding="utf-8")
    return {"ok": True, "datasetPackage": str(output / "dataset-package.json"), "packageSha256": provenance["packageSha256"],
            "assets": [{k: r[k] for k in ("symbol", "barId", "rows", "first", "last")} for r in records]}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    result.add_argument("--assets", required=True, help="JSON array of {symbol, barId, venue, currency[, assetClass, barsFile]}")
    result.add_argument("--output", required=True, help="absent or empty staging directory")
    result.add_argument("--dataset-id", required=True)
    result.add_argument("--dataset-version", required=True)
    result.add_argument("--asset-class", required=True, help="package asset class, or 'mixed' with per-asset classes")
    result.add_argument("--interval", required=True)
    result.add_argument("--adjustment", choices=ADJUSTMENTS,
                        help="caller-owned price adjustment meaning of the OpenAlice source; never defaulted")
    result.add_argument("--timezone", help="caller-owned IANA session timezone; never defaulted")
    result.add_argument("--calendar", help="caller-owned exchange calendar id, e.g. XNYS")
    result.add_argument("--panel", choices=("aligned", "observed-only"))
    result.add_argument("--terms", help="caller's data-use terms statement")
    result.add_argument("--fetch-start", help="with --fetch-end, export each barId through the alice CLI")
    result.add_argument("--fetch-end")
    return result


def main(argv: list[str] | None = None) -> int:
    try:
        result = build(parser().parse_args(argv))
    except Refusal as refusal:
        print(json.dumps({"ok": False, "error": {"code": refusal.code, "message": str(refusal)}}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
