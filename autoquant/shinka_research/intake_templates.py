"""Quant intake templates: the closed set a person starts from.

A template is keyed by market and scenario (``crypto.ma_trend``). It carries
what the intake needs to turn half an idea into a runnable experiment: the
signal's parameters with defaults and bounds, the data columns it reads, a
proposed refutation criterion and a seed program in the format the frozen
evaluator expects (an EVOLVE-BLOCK defining ``generate_positions`` and a fixed
``run_experiment(bars)`` returning causal positions in [-1, 1]).

Defaults here are starting points, not calibrated values: the owner answers the
questions that change what the test means (market, symbol, an open signal
choice, the refutation criterion and the cost) and `intake` lists everything it
filled in from here as defaulted.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from string import Template as _Template
from typing import Any, Callable, Dict, Mapping, Optional, Tuple

Value = int | float | str


@dataclass(frozen=True)
class Market:
    """What a market changes in a test: bars per year, the cost to start from,
    and whether the position may go short."""

    id: str
    label: str
    periods_per_year: float
    cost_bps: float
    sizing_mode: str
    example_symbol: str


MARKETS: Dict[str, Market] = {
    m.id: m
    for m in (
        Market(
            "cn_equity", "China A-share (daily)", 252.0, 10.0, "long_only", "600519.SH"
        ),
        Market("us_equity", "US equity (daily)", 252.0, 2.0, "long_short", "SPY"),
        Market("futures", "Futures (daily)", 252.0, 3.0, "long_short", "ES"),
        Market(
            "crypto",
            "Crypto spot or perpetual (daily)",
            365.0,
            10.0,
            "long_short",
            "BTCUSDT",
        ),
    )
}


@dataclass(frozen=True)
class Param:
    """One signal parameter. An ``open`` parameter is a meaning-changing choice
    the template leaves to the caller: it is asked, not defaulted."""

    name: str
    kind: str  # "int" | "float" | "choice"
    default: Value
    description: str
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    choices: Tuple[str, ...] = ()
    open: bool = False


def _fast_below_slow(p: Mapping[str, Value]) -> Optional[str]:
    if p["fast"] >= p["slow"]:
        return f"fast ({p['fast']}) must be shorter than slow ({p['slow']})"
    return None


def _exit_within_entry(p: Mapping[str, Value]) -> Optional[str]:
    if p["exit_window"] > p["entry_window"]:
        return (
            f"exit_window ({p['exit_window']}) must not exceed "
            f"entry_window ({p['entry_window']})"
        )
    return None


def _nothing(p: Mapping[str, Value]) -> Optional[str]:
    return None


@dataclass(frozen=True)
class Scenario:
    id: str
    title: str
    signal: str
    columns: Tuple[str, ...]
    params: Tuple[Param, ...]
    block: str
    check: Callable[[Mapping[str, Value]], Optional[str]] = _nothing


MA_TREND_BLOCK = '''\
FAST = $fast
SLOW = $slow


def generate_positions(bars: pd.DataFrame) -> pd.Series:
    """Moving-average trend: long when the fast average is above the slow one,
    short when it is below."""
    close = bars["close"]
    fast = close.rolling(FAST).mean()
    slow = close.rolling(SLOW).mean()
    return np.sign(fast - slow).fillna(0.0)
'''

DONCHIAN_BLOCK = '''\
ENTRY_WINDOW = $entry_window
EXIT_WINDOW = $exit_window
ATR_WINDOW = $atr_window
ATR_STOP_MULT = $atr_stop_mult


def generate_positions(bars: pd.DataFrame) -> pd.Series:
    """Donchian breakout (turtle): enter when the close breaks the prior
    ENTRY_WINDOW-bar channel, leave on a break of the shorter EXIT_WINDOW
    channel or when the close crosses an ATR stop set at entry."""
    close, high, low = bars["close"], bars["high"], bars["low"]
    prev_close = close.shift(1)
    true_range = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    atr = true_range.rolling(ATR_WINDOW).mean().to_numpy(dtype=float)
    enter_up = high.rolling(ENTRY_WINDOW).max().shift(1).to_numpy(dtype=float)
    enter_down = low.rolling(ENTRY_WINDOW).min().shift(1).to_numpy(dtype=float)
    leave_long = low.rolling(EXIT_WINDOW).min().shift(1).to_numpy(dtype=float)
    leave_short = high.rolling(EXIT_WINDOW).max().shift(1).to_numpy(dtype=float)
    px = close.to_numpy(dtype=float)
    out = np.zeros(len(px))
    side, stop = 0, 0.0
    for i in range(len(px)):
        if side == 0:
            if np.isfinite(atr[i]) and px[i] > enter_up[i]:
                side, stop = 1, px[i] - ATR_STOP_MULT * atr[i]
            elif np.isfinite(atr[i]) and px[i] < enter_down[i]:
                side, stop = -1, px[i] + ATR_STOP_MULT * atr[i]
        elif side == 1 and (px[i] < stop or px[i] < leave_long[i]):
            side = 0
        elif side == -1 and (px[i] > stop or px[i] > leave_short[i]):
            side = 0
        out[i] = side
    return pd.Series(out, index=bars.index)
'''

MOMENTUM_BLOCK = '''\
LOOKBACK = $lookback


def generate_positions(bars: pd.DataFrame) -> pd.Series:
    """Time-series momentum: long when the trailing LOOKBACK-bar return is
    positive, short when it is negative."""
    trailing = bars["close"].pct_change(LOOKBACK)
    return np.sign(trailing).fillna(0.0)
'''

MEAN_REVERSION_BLOCK = '''\
WINDOW = $window
ENTRY_Z = $entry_z


def generate_positions(bars: pd.DataFrame) -> pd.Series:
    """Mean reversion: fade a close more than ENTRY_Z rolling standard
    deviations away from its WINDOW-bar average."""
    close = bars["close"]
    spread = close - close.rolling(WINDOW).mean()
    z = spread / close.rolling(WINDOW).std().replace(0.0, np.nan)
    positions = pd.Series(0.0, index=close.index)
    positions[z > ENTRY_Z] = -1.0
    positions[z < -ENTRY_Z] = 1.0
    return positions
'''

PRICE_VOLUME_BLOCK = '''\
WINDOW = $window
DIRECTION = $direction  # "divergence": long when price and volume move apart


def generate_positions(bars: pd.DataFrame) -> pd.Series:
    """Price-volume correlation: the sign of the rolling correlation between
    the close and the volume decides the side. "divergence" is long when the
    correlation is negative and short when it is positive; "confirmation" is
    the opposite."""
    corr = bars["close"].rolling(WINDOW).corr(bars["volume"])
    side = -1.0 if DIRECTION == "divergence" else 1.0
    return (side * np.sign(corr)).fillna(0.0)
'''


def _int(name: str, default: int, description: str, lo: int, hi: int) -> Param:
    return Param(name, "int", default, description, float(lo), float(hi))


def _float(name: str, default: float, description: str, lo: float, hi: float) -> Param:
    return Param(name, "float", default, description, lo, hi)


SCENARIOS: Dict[str, Scenario] = {
    s.id: s
    for s in (
        Scenario(
            "ma_trend",
            "Moving-average trend",
            "Long while the fast moving average is above the slow one, short while below.",
            ("close",),
            (
                _int("fast", 20, "Bars in the fast average.", 2, 200),
                _int("slow", 60, "Bars in the slow average.", 3, 500),
            ),
            MA_TREND_BLOCK,
            _fast_below_slow,
        ),
        Scenario(
            "donchian_atr",
            "Donchian breakout with ATR stop (turtle)",
            "Enter on a break of the prior N-bar high or low, exit on the shorter "
            "channel or an ATR stop set at entry.",
            ("high", "low", "close"),
            (
                _int("entry_window", 20, "Bars in the entry channel.", 5, 250),
                _int("exit_window", 10, "Bars in the exit channel.", 2, 250),
                _int("atr_window", 14, "Bars in the average true range.", 2, 100),
                _float(
                    "atr_stop_mult",
                    2.0,
                    "ATR multiples between entry and stop.",
                    0.5,
                    10.0,
                ),
            ),
            DONCHIAN_BLOCK,
            _exit_within_entry,
        ),
        Scenario(
            "momentum_20d",
            "Time-series momentum",
            "Long when the trailing return over the look-back is positive, short when negative.",
            ("close",),
            (_int("lookback", 20, "Bars in the trailing return.", 2, 250),),
            MOMENTUM_BLOCK,
        ),
        Scenario(
            "mean_reversion",
            "Mean reversion to a rolling average",
            "Fade a close that is far from its rolling average, measured in standard deviations.",
            ("close",),
            (
                _int(
                    "window", 20, "Bars in the rolling average and deviation.", 5, 250
                ),
                _float(
                    "entry_z",
                    1.5,
                    "Standard deviations from the average that trigger a trade.",
                    0.5,
                    4.0,
                ),
            ),
            MEAN_REVERSION_BLOCK,
        ),
        Scenario(
            "price_volume_corr",
            "Price-volume correlation",
            "Trade the sign of the rolling correlation between close and volume.",
            ("close", "volume"),
            (
                _int("window", 20, "Bars in the rolling correlation.", 5, 250),
                Param(
                    "direction",
                    "choice",
                    "divergence",
                    "Trade with the correlation (confirmation) or against it "
                    "(divergence: long when price and volume move apart)?",
                    choices=("divergence", "confirmation"),
                    open=True,
                ),
            ),
            PRICE_VOLUME_BLOCK,
        ),
    )
}


@dataclass(frozen=True)
class Template:
    """One (market, scenario) entry of the catalogue; ``params`` overrides the
    scenario's defaults for this market."""

    market: str
    scenario: str
    params: Mapping[str, Value] = field(default_factory=dict)

    @property
    def id(self) -> str:
        return f"{self.market}.{self.scenario}"

    @property
    def spec(self) -> Scenario:
        return SCENARIOS[self.scenario]

    def default(self, param: Param) -> Value:
        return self.params.get(param.name, param.default)


TEMPLATES: Dict[str, Template] = {
    t.id: t
    for t in (
        Template("crypto", "ma_trend", {"fast": 10, "slow": 50}),
        Template("cn_equity", "ma_trend"),
        Template("futures", "donchian_atr"),
        Template("us_equity", "momentum_20d"),
        Template("cn_equity", "mean_reversion"),
        Template("cn_equity", "price_volume_corr"),
    )
}

REFUTATION_PROPOSAL = (
    "Refuted if the out-of-sample Sharpe after costs on the untouched holdout "
    "is zero or negative."
)


SEED = _Template(
    '''\
"""Seed program for $title ($template).

Rendered by `aq shinka intake apply`. Only the EVOLVE-BLOCK is mutated: the
position limits and the stop below it come from the intake spec and stay fixed.
"""

import numpy as np
import pandas as pd


# EVOLVE-BLOCK-START
$block# EVOLVE-BLOCK-END

LOWER = $lower
UPPER = $upper
STOP_LOSS = $stop_loss  # fraction against the entry price, or None


def _stop_out(positions: pd.Series, close: pd.Series, stop: float) -> pd.Series:
    """Flat once the close is `stop` against the entry price, until the signal
    leaves that side. Uses only bars up to the current one."""
    px = close.to_numpy(dtype=float)
    want = np.sign(positions.to_numpy(dtype=float))
    out = positions.to_numpy(dtype=float).copy()
    side, entry, blocked = 0.0, 0.0, 0.0
    for i in range(len(px)):
        if want[i] != blocked:
            blocked = 0.0
        if want[i] != 0.0 and want[i] == blocked:
            out[i] = 0.0
            continue
        if want[i] != side:
            side, entry = want[i], px[i]
        if side != 0.0 and side * (px[i] / entry - 1.0) <= -stop:
            blocked, side = side, 0.0
            out[i] = 0.0
    return pd.Series(out, index=positions.index)


def run_experiment(bars: pd.DataFrame) -> pd.Series:
    raw = pd.Series(generate_positions(bars), index=bars.index, dtype=float)
    positions = raw.fillna(0.0).clip(LOWER, UPPER)
    if STOP_LOSS is not None:
        positions = _stop_out(positions, bars["close"], STOP_LOSS)
    return positions
'''
)


def render_block(scenario: Scenario, params: Mapping[str, Value]) -> str:
    return _Template(scenario.block).substitute({k: repr(v) for k, v in params.items()})


def render_seed(
    template: Template,
    params: Mapping[str, Value],
    *,
    title: str,
    lower: float,
    upper: float,
    stop_loss_pct: Optional[float],
) -> str:
    """The seed ``initial.py`` for one resolved intake spec."""
    values: Dict[str, Any] = {
        "title": title.replace('"""', "'''").replace("\n", " "),
        "template": template.id,
        "block": render_block(template.spec, params),
        "lower": repr(float(lower)),
        "upper": repr(float(upper)),
        "stop_loss": repr(stop_loss_pct),
    }
    return SEED.substitute(values)
