/** Authored definitions; formula references, no copied implementation. */
const sources = [
  { name: 'JoinQuant jqfactor_analyzer', url: 'https://github.com/JoinQuant/jqfactor_analyzer/blob/master/jqfactor_analyzer/performance.py', license: 'MIT' },
  { name: 'Alphalens / alphalens-reloaded', url: 'https://github.com/stefan-jansen/alphalens-reloaded/blob/main/src/alphalens/performance.py', license: 'Apache-2.0' },
]
const read = { en: 'Diagnostic evidence only; no verdict, selection or trading authority.', zh: '仅为诊断证据；不具有判定、选择或交易权限。' }
export const TEAR_SHEET_METRICS = {
  tearQuantiles: {
    label: { en: 'Frozen quantiles', zh: '固定分组数' }, read,
    definition: { en: 'The Study fixes 3, 5 or 10 equal-name groups.', zh: '研究冻结为 3、5 或 10 个等标的数分组。' },
    core: { en: 'Study judge.quantiles defaults to 3 without rewriting absent fields. Stable ascending factor sort, asset-column tie order, array_split; minimum N=1 per group and at least Q distinct scores. Insufficient bars are refused, not filled.', zh: 'Study 的 judge.quantiles 默认 3，不重写省略字段。因子升序稳定排序，同值按资产列顺序；array_split 分组，每组最低 N=1 且至少 Q 个不同因子值。不足的 K 线拒绝分组，不填充。' },
    caveat: { en: 'Singleton bins are noisy. Stable ordinal ties differ from Alphalens qcut value boundaries; unequal group sizes differ by at most one.', zh: '单成员分组噪声较大。稳定序数同值分配不同于 Alphalens 的 qcut 数值边界；组大小最多相差一个。' }, sources,
  },
  tearQuantileMean: {
    label: { en: 'Quantile mean outcome', zh: '分组平均结果' }, read,
    definition: { en: 'Mean primary-horizon forward outcome for every frozen group.', zh: '每个固定分组的主周期平均前瞻结果。' },
    core: { en: 'At each eligible close, equally average finite paired names in each group, then equally average the bar means within the purged split. Raw outcomes, no market/group demeaning or annualization.', zh: '每个合格收盘时点对各组有限配对标的等权平均，再对剔除边界后的划分内各 K 线均值等权平均。使用原始结果，不做市场或行业去均值，也不年化。' },
    caveat: { en: 'Units are primary-horizon returns or forward realized volatility, as fixed by the request. These are not per-day rates for a multi-bar horizon.', zh: '单位是请求冻结的主周期收益或前瞻已实现波动率。多 K 线预测周期下不表示每日收益率。' }, sources,
  },
  tearGroupGrowth: {
    label: { en: 'Cumulative group index', zh: '分组累计指数' }, read,
    definition: { en: 'All groups compounded from one independently within each split.', zh: '各分组在各自划分内独立从一开始复利累计。' },
    core: { en: 'Product of (1 + each published primary-horizon group mean). Compute full history before sampling. A return <= -1 makes that path unavailable from then on; never clip it.', zh: '对已发布的主周期分组均值逐期连乘 (1 + 均值)。完整历史计算后采样。若收益 <= -1，该路径从该处起不可用，不裁剪。' },
    caveat: { en: 'Overlapping multi-bar returns are compounded each bar; this is a descriptive index and can overstate investable growth. No Alphalens staggered subportfolio adjustment, costs, drift, or fills. Not a risk-outcome curve.', zh: '重叠的多期收益逐 K 线复利，属于描述性指数，可能夸大可投资增长。未使用 Alphalens 交错子组合调整，无成本、漂移或成交。不适用于风险结果。' }, sources,
  },
  tearLongShort: {
    label: { en: 'Gross and cost-adjusted spread', zh: '毛收益与扣成本价差' }, read,
    definition: { en: 'Top minus bottom primary-horizon return, gross and net of a locked cost model when present.', zh: '最高减最低分组的主周期收益；有锁定成本模型时同时提供毛收益和净收益。' },
    core: { en: 'Equal weights +1 in the top group and -1 in the bottom (gross 2). Net = gross - sum(abs(target - prior target))*baseCostBps/10000. Initial entry charged from cash, no terminal liquidation. Exact Study dependency strategies/portfolio-mandate.json supplies the linear-traded-notional-v1 rate, or the fixed Study request explicitly supplies portfolioPolicy.baseCostBps. Absent means no cost model, not zero cost.', zh: '最高组等权 +1，最低组等权 -1（总敞口 2）。净收益 = 毛收益 - sum(abs(目标权重 - 上次目标权重))*baseCostBps/10000。首次从现金建仓收费，不计末期清仓。从 Study 精确固定依赖 strategies/portfolio-mandate.json 读取 linear-traded-notional-v1 费率，或读取固定 Study 请求明确提供的 portfolioPolicy.baseCostBps。缺失表示无成本模型，不表示成本为零。' },
    caveat: { en: 'Target-change diagnostic, not Portfolio accounting: no drift, impact, borrow or financing. Multi-bar outcomes overlap; costs charged once per rebalance, compounded net curve is descriptive. No long-short return for a volatility outcome.', zh: '目标变动诊断并非组合会计：无漂移、冲击、借券或融资。多期结果重叠，成本每次调仓收取一次，净收益复利曲线仅供描述。波动率结果无多空收益。' }, sources,
  },
  tearTurnover: {
    label: { en: 'Group turnover', zh: '分组换手率' }, read,
    definition: { en: 'Share of current group names newly entering since the preceding eligible bar.', zh: '相对前一个合格 K 线，新进入标的占当前分组标的的比例。' },
    core: { en: '|current group minus previous group| / |current group|, averaged per group within the split. First bar and a bar after refused grouping have no turnover observation. Entry/exit names count, no cross-split history.', zh: '|当前组减前组的标的集合| / |当前组|，在划分内按组平均。首根及拒绝分组后的 K 线无换手率观测。纳入进出标的，不跨划分延续。' },
    caveat: { en: 'Range 0..1. Name turnover is not traded notional or existing mean_rank_turnover (absolute percentile rank change).', zh: '范围 0..1。标的换手率不等于交易名义金额，也不同于已有的 mean_rank_turnover（百分位秩变动绝对值）。' }, sources,
  },
  tearIcDecay: {
    label: { en: 'IC decay', zh: 'IC 衰减' }, read,
    definition: { en: 'Mean cross-sectional rank IC at every forward horizon 1..H.', zh: '前瞻周期 1..H 的横截面秩 IC 均值。' },
    core: { en: 'H is max(request diagnosticForwardBars), including the canonical primary horizon. Per bar Spearman with average ties on finite pairs, minimum four names; mean within each horizon-specific purged split. Request-fixed outcome, no inferred return claim.', zh: 'H 为请求 diagnosticForwardBars 的最大值（包含规范化后的主周期）。逐 K 线对有限配对值计算平均同值秩的 Spearman，最低四个标的；在各周期独立剔除边界的划分内求均值。使用请求固定的结果，不推断收益主张。' },
    caveat: { en: 'Horizons have different purged populations. No annualization, smoothing or additional selection objective. Existing HAC inference remains unchanged.', zh: '不同周期的边界剔除后总体不同。不年化、不平滑、不增加选择目标。已有 HAC 推断保持不变。' }, sources,
  },
  tearAutocorrelation: {
    label: { en: 'Factor rank autocorrelation', zh: '因子秩自相关' }, read,
    definition: { en: 'Mean correlation of same-name cross-sectional ranks at lags 1..H.', zh: '滞后 1..H 时同名标的横截面秩相关性的均值。' },
    core: { en: 'Rank each observed cross-section with average ties, shift by observed union bars within the split, Pearson-correlate the two rank vectors on at least four common names, average finite bars. Both endpoints must remain in the same split.', zh: '对每个已观测横截面按平均同值秩排名，在划分内按已观测并集 K 线滞后，对至少四个共同标的的两组秩求 Pearson，再对有限 K 线平均。两端必须位于同一划分。' },
    caveat: { en: 'Rank persistence is not predictiveness. Missing observations are never filled or aligned to a synthetic calendar.', zh: '秩持续性不等于预测能力。不填补缺失观测，不对齐到虚构日历。' }, sources,
  },
  tearSample: {
    label: { en: 'Short-sample warning', zh: '短样本警告' }, read,
    definition: { en: 'A diagnostic has fewer than 20 usable bar observations.', zh: '一项诊断的可用 K 线观测数少于 20。' },
    core: { en: 'Count finite bar means/correlations separately for every group, lag, horizon and split. Fewer than 20 sets shortSample=true; zero observations retains null. The UI warns if any displayed diagnostic is short.', zh: '分别对各分组、滞后、周期、划分统计有限均值或相关性的 K 线数。少于 20 设置 shortSample=true；零观测保留 null。界面对任一展示诊断不足均给出提示。' },
    caveat: { en: 'Twenty is a disclosure threshold, not statistical sufficiency or a verdict gate. Cost absence is distinct from a short return sample.', zh: '20 是披露阈值，不代表统计充分性，也不构成判定门槛。成本缺失不同于收益短样本。' },
  },
}
