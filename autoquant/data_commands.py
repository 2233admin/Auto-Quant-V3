"""Small CLI registration and dispatch for read-only data quality inspection."""
import json
from pathlib import Path

from .data_quality import quality_report


def add_data_parser(subcommands, json_argument):
    data = subcommands.add_parser("data", help="inspect staged OHLCV without network or mutation")
    actions = data.add_subparsers(dest="data_action", required=True)
    command = actions.add_parser("check", help="report deterministic OHLCV quality diagnostics")
    command.add_argument("path")
    command.add_argument("--options", help="JSON file declaring column mapping and quality authority")
    command.add_argument("--options-json", help="Inline JSON options, mutually exclusive with --options")
    command.add_argument("--calendar")
    command.add_argument("--timezone")
    command.add_argument("--frequency")
    command.add_argument("--jump-threshold", type=float)
    command.add_argument("--long-gap-bars", type=int)
    command.add_argument("--universe-status", choices=("unknown", "currently-listed-only", "contains-delisted"))
    command.set_defaults(command_id="data.check")
    json_argument(command)


def run_data_check(args):
    if args.options and args.options_json:
        raise ValueError("Choose --options or --options-json")
    options = json.loads(Path(args.options).read_text(encoding="utf-8")) if args.options else {}
    if args.options_json:
        options = json.loads(args.options_json)
    for name, key in (("calendar", "calendar"), ("timezone", "timezone"), ("frequency", "frequency"),
                      ("jump_threshold", "jumpThreshold"), ("long_gap_bars", "longGapBars"), ("universe_status", "universeStatus")):
        value = getattr(args, name)
        if value is not None:
            options[key] = value
    return quality_report(args.path, options)
