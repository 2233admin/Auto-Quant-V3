"""Read-only, confined source discovery shared by data diagnostics and Studio.

No downloads, inferred market authority, source rewrites or silent row repairs.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

from .intake import _read_source, _validate_package_manifest
from .workspace import confined_path


@dataclass
class SourceAsset:
    symbol: str
    path: Path
    frame: pd.DataFrame
    market: dict[str, Any]


def no_links(path: Path) -> Path:
    """Reject links/reparse points even when their destination remains in scope."""
    path = path.absolute()
    for part in (path, *path.parents):
        info = part.lstat()
        if part.is_symlink() or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("Symlinks and junctions are not permitted")
    return path


def mapped_frame(frame: pd.DataFrame, mapping: dict[str, str]) -> pd.DataFrame:
    allowed = {"timestamp", "open", "high", "low", "close", "volume", "asset"}
    if not isinstance(mapping, dict) or set(mapping) - allowed:
        raise ValueError("Unsupported column mapping")
    used = [value for value in mapping.values() if value]
    if any(value not in frame.columns for value in used) or len(used) != len(set(used)):
        raise ValueError("Mapped columns must exist and be distinct")
    renamed = frame.rename(columns={v: ("date" if k == "timestamp" else k) for k, v in mapping.items() if v})
    if renamed.columns.duplicated().any():
        raise ValueError("Column mapping creates duplicate canonical columns")
    return renamed


def load_sources(path: str | Path, options: dict | None = None):
    options = options or {}
    if not isinstance(options, dict):
        raise ValueError("Quality options must be an object")
    source = no_links(Path(path))
    package = None
    if source.suffix.lower() == ".json":
        package = _validate_package_manifest(json.loads(source.read_text(encoding="utf-8")), source)
        entries = [(a["symbol"], no_links(confined_path(source.parent, a["path"], "asset path")), a) for a in package["assets"]]
    elif source.is_dir():
        entries = [(p.stem, no_links(p), {}) for p in sorted(source.glob("*.csv"))]
    elif source.suffix.lower() == ".csv":
        entries = [(source.stem, source, {})]
    else:
        raise ValueError("Choose a dataset package JSON, CSV, or directory of CSV files")
    if not entries:
        raise ValueError("No CSV files found in this staged folder")
    if len(entries) > 128:
        raise ValueError("At most 128 asset files may be inspected at once")
    market = dict((package or {}).get("market", {}))
    if not package:
        market.update({k: options[k] for k in ("calendar", "timezone", "clock") if k in options})
    frequency = (package or {}).get("frequency", (package or {}).get("baseInterval", options.get("frequency", "1d")))
    digest = hashlib.sha256(json.dumps(options, sort_keys=True, allow_nan=False).encode())
    if package:
        digest.update(source.read_bytes())
    assets = []
    for symbol, file, metadata in entries:
        digest.update(str(file.relative_to(source if source.is_dir() else source.parent)).encode())
        with file.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        frame = mapped_frame(_read_source(file), options.get("mapping", {}) if not package else {})
        per_market = {**market, **options.get("assetMarkets", {}).get(symbol, {})}
        if "asset" in frame and not package:
            if frame["asset"].isna().any():
                raise ValueError("Asset column contains missing identifiers")
            for name, group in frame.groupby("asset", sort=True):
                assets.append(SourceAsset(str(name), file, group.reset_index(drop=True), per_market))
        else:
            assets.append(SourceAsset(symbol, file, frame, per_market))
    if not assets:
        raise ValueError("No asset observations found in the staged source")
    symbols = [a.symbol for a in assets]
    if len(symbols) != len(set(symbols)):
        raise ValueError("Asset identifiers must be unique across CSV files")
    return source, package, assets, frequency, digest.hexdigest()


def inspect_source(path: Path) -> dict:
    """Bounded mapping preview, keeping data values separate from UI copy."""
    _, package, assets, frequency, digest = load_sources(path)
    frame = _read_source(assets[0].path)
    columns = [str(c) for c in frame.columns]
    mapping = {}
    for target in ("timestamp", "open", "high", "low", "close", "volume", "asset"):
        aliases = ("timestamp", "date", "datetime", "time") if target == "timestamp" else (target, "symbol") if target == "asset" else (target,)
        mapping[target] = next((c for c in columns if c.strip().lower() in aliases), "")
    market = (package or {}).get("market", {})
    return {"columns": columns, "sample": frame.head(4).fillna("").astype(str).to_dict("records"),
            "mapping": mapping, "frequency": frequency, "market": market,
            "assets": [a.symbol for a in assets], "package": package, "sha256": digest}
