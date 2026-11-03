import { getLanguage } from '../i18n'

/**
 * The one place Studio defines the numbers it displays. Every entry describes how AutoQuant Core actually computes the
 * value (autoquant/project_templates/ohlcv_factor_lab/{factor_diagnostics,judge}.py, autoquant/factor_explorer.py,
 * autoquant/selection.py, autoquant/project_templates/ohlcv_portfolio_lab/portfolio_core.py). Wording is our own;
 * `sources` name reference libraries whose conventions a reader may know, so differences can be stated, not copied.
 * Static text only: no entry may quote a Run value, so an explanation can never reveal a hidden test number.
 */
export type Bi = { en: string; zh: string }
export type MetricSource = { name: string; url: string; license: string }
export type MetricEntry = {
  /** Short label as Studio shows it. */
  label: Bi
  /** One sentence: what the number is. */
  definition: Bi
  /** Direction, typical ranges and what they do and do not mean. */
  read: Bi
  /** One line, accurate to Core. */
  core: Bi
  caveat?: Bi
  sources?: MetricSource[]
}

const ALPHALENS: MetricSource = { name: 'Alphalens (alphalens-reloaded)', url: 'https://github.com/stefan-jansen/alphalens-reloaded', license: 'Apache-2.0' }
const JQFACTOR: MetricSource = { name: 'JoinQuant jqfactor_analyzer', url: 'https://github.com/JoinQuant/jqfactor_analyzer', license: 'MIT' }

const TEMPORAL_NOTE: Bi = {
  en: 'In single-asset (or two-asset spread) temporal mode the per-bar values are contributions whose mean equals the split’s time-series correlation, not one IC per bar.',
  zh: '在单资产（或双资产价差）时间序列模式下，逐K线数值是“贡献值”，其均值等于该数据划分的时间序列相关系数，而不是每根K线一个 IC。',
}

const SPREAD_CORE: Bi = {
  en: 'Each bar, assets are sorted by factor and split into three equal-weight groups (low, middle, high); the spread is high minus low at the primary horizon, gross of costs.',
  zh: '每根K线按因子值排序，把资产分成低、中、高三个等权组；价差为主预测周期上高组减低组，未扣成本。',
}
const SPREAD_CAVEAT: Bi = {
  en: 'Alphalens and jqfactor_analyzer default to five quantile groups; AutoQuant uses three. With a horizon above 1 bar, overlapping multi-bar returns are compounded bar by bar, which overstates totals and drawdowns. Not available in single-asset temporal mode.',
  zh: 'Alphalens 与 jqfactor_analyzer 默认五分组；AutoQuant 用三组。预测周期大于 1 根K线时，重叠的多周期收益被逐K线复利，会夸大总收益和回撤。单资产时间序列模式下不提供。',
}

const PORTFOLIO_LEDGER: Bi = {
  en: 'Per bar: executed weights at close t times the next bar’s close-to-close return, minus modelled cost; cash earns 0. Annualised with bars per year inferred from timestamps (252 for date-only daily data).',
  zh: '逐K线：t 收盘的成交后权重乘以下一根K线收盘到收盘收益，再减去模型成本；现金收益为 0。年化所用的每年K线数由时间戳推断（只有日期的日频数据取 252）。',
}

export const METRIC_CATALOGUE = {
  overlapCorrelation: {
    label: { en: 'Overlap correlation', zh: '重叠相关性' },
    definition: { en: 'Validation-only rank association with another published Workspace factor on the same evaluation basis.', zh: '在相同评估基础上，与工作区另一个已发布因子之间仅使用验证集计算的秩相关性。' },
    read: { en: 'Near +1 or −1 indicates strong overlap. Possible duplicate is a display heuristic: |correlation| ≥ 0.7 and |residual IC| < half |target validation IC|. It never changes a verdict.', zh: '接近 +1 或 −1 表示高度重叠。“可能重复”仅为展示启发式：|相关性| ≥ 0.7 且 |剩余 IC| < |目标验证集 IC| 的一半。它不改变判决。' },
    core: { en: 'Core matches exact dataset id/hash, prediction population, Judge, split/purge windows, outcome and numerical horizon. It averages per-bar cross-sectional Spearman correlations on common published validation pairs (at least 4 assets). Single-asset Runs use within-validation temporal Spearman correlation.', zh: 'Core 匹配精确的数据集 id/哈希、预测总体、Judge、划分/剔除窗口、结果和数值周期；在共同已发布验证配对上，平均逐 K 线横截面 Spearman 相关性（至少 4 个资产）。单资产运行使用验证集内时间序列 Spearman 相关性。' },
    caveat: { en: 'Latest successful Run per Project/Study/source; sorted by absolute mean correlation, not mean absolute correlation. Historical Runs without published pairs are unavailable. Negative correlation can still indicate duplication.', zh: '每个项目/研究/源代码仅取最近成功运行；按平均相关性的绝对值排序，并非绝对相关性的均值。缺少配对证据的历史运行不可用。负相关也可能重复。' },
  },
  residualRankIc: {
    label: { en: 'Residual rank IC', zh: '剩余秩 IC' },
    definition: { en: 'Validation rank IC remaining after removing one peer factor from the target cross-sectionally at each bar.', zh: '逐 K 线在横截面上去除一个已有因子后，目标因子剩余的验证集秩 IC。' },
    read: { en: 'Small magnitude with high overlap suggests repetition. Possible duplicate uses |correlation| ≥ 0.7 and |residual IC| < half |target validation IC|, solely as a display heuristic, never a verdict.', zh: '高重叠且剩余幅度小提示可能重复。展示启发式为 |相关性| ≥ 0.7 且 |剩余 IC| < |目标验证集 IC| 的一半，绝不是判决。' },
    core: { en: 'Core reuses component diagnostics: average-tie percentile ranks, centered-rank OLS of target on peer (with intercept), then Spearman of residual against the Judge-published primary forward outcome, averaged over validation bars. Exact zero residual (tolerance 1e−12) contributes 0 rather than ranking floating-point noise.', zh: 'Core 复用组件诊断：并列取平均的百分位秩，对目标和已有因子中心化后做含截距 OLS，再计算残差与 Judge 已发布主周期前瞻结果的 Spearman 相关性，最后平均验证集各 K 线。绝对值不超过 1e−12 的零残差贡献 0，避免对浮点噪声排名。' },
    caveat: { en: 'Cross-sectional residualization does not apply to single-asset temporal Runs; residual IC is unavailable there. Counts disclose valid bars/pairs and residual bars separately. No test or holdout values enter this diagnostic.', zh: '单资产时间序列运行不适用横截面残差化，其剩余 IC 不可用。有效 K 线/配对数与残差 K 线数分别披露。本诊断不使用测试集或留出集数值。' },
  },
  deflatedSharpe: {
    label: { en: 'Deflated Sharpe probability', zh: '折减 Sharpe 概率' },
    definition: { en: 'Core probability that the selected validation Sharpe exceeds the trial-family expected maximum.', zh: 'Core 估计所选验证集 Sharpe 超过试验族预期最大值的概率。' },
    read: { en: 'Read with minimum track record and the family trial count; it is development evidence, not independent confirmation.', zh: '需结合最小样本长度和研究族试验数阅读；这是开发阶段证据，不是独立确认。' },
    core: { en: 'Core deflates the period Sharpe against the expected maximum from unique source trials and their dispersion, with skewness and kurtosis corrections.', zh: 'Core 根据不同候选源码试验数及其离散度计算预期最大值，对逐周期 Sharpe 做折减，并校正偏度和峰度。' },
    caveat: { en: 'The fixed parameter neighborhood has no cell-level adjustment; this probability belongs only to the base Run source family.', zh: '固定参数邻域没有逐配置校正；此概率仅属于基准运行的源码试验族。' },
  },
  minimumTrackRecord: {
    label: { en: 'Minimum track record', zh: '最小样本长度' },
    definition: { en: 'The observations required by Core for the selected Sharpe to clear the family expected maximum at its fixed confidence level.', zh: '在固定置信水平下，所选 Sharpe 超过试验族预期最大值所需的观测数，由 Core 计算。' },
    read: { en: 'Compare with the actual validation observations; a large requirement signals insufficient history.', zh: '与实际验证集观测数比较；要求很高意味着历史证据不足。' },
    core: { en: 'Core minimum-track-record calculation uses the same period Sharpe, expected maximum and return moments as its deflated-Sharpe adjustment.', zh: 'Core 使用与折减 Sharpe 校正相同的逐周期 Sharpe、预期最大值和收益矩计算最小样本长度。' },
  },
  primaryObjective: {
    label: { en: 'Primary validation objective', zh: '验证集主目标' },
    definition: { en: 'The immutable Study objective measured on validation, when explicitly declared.', zh: '固定研究明确声明的验证集主目标数值。' },
    read: { en: 'Read the Study direction and protocol; a difference does not grant selection or trading authority.', zh: '请结合研究的优化方向和协议阅读；差值不授予选择或交易权限。' },
    core: { en: 'The verified RunResult objective metric. An objective without an explicit validation scope is unavailable here.', zh: '来自已验证 RunResult 的目标指标；未明确声明验证集范围的目标在此不展示。' },
  },
  // ---------------------------------------------------------------- Factor: rank-IC summary
  meanRankIc: {
    label: { en: 'Mean rank IC', zh: '平均秩 IC' },
    definition: {
      en: 'The average Spearman rank correlation between the factor and the forward return over the next h bars, measured bar by bar.',
      zh: '因子值与未来 h 根K线收益之间 Spearman 秩相关系数的平均值，逐K线计算。',
    },
    read: {
      en: 'Above 0: higher factor values went with higher later returns. In daily cross-sectional stock research, |IC| of about 0.02–0.05 is often called useful and above 0.10 is rare; few assets, short windows or a single asset can give much larger values, so read it with HAC t and observations.',
      zh: '大于 0：因子值越高，后续收益越高。日频横截面股票研究中 |IC| 约 0.02–0.05 常被视为有用，超过 0.10 少见；资产少、窗口短或单资产时数值可能大得多，需结合 HAC t 和观测数阅读。',
    },
    core: {
      en: 'Cross-sectional mode (4+ prediction assets): per-bar Spearman across assets against the simple close-to-close h-bar return; rows whose target crosses a split boundary are purged.',
      zh: '横截面模式（预测资产不少于 4 个）：每根K线在资产间计算与 h 根K线简单收盘到收盘收益的 Spearman 相关；目标跨越数据划分边界的行会被剔除。',
    },
    caveat: TEMPORAL_NOTE,
    sources: [ALPHALENS, JQFACTOR],
  },
  meanPearsonIc: {
    label: { en: 'Mean Pearson IC', zh: '平均 Pearson IC' },
    definition: {
      en: 'The same average correlation computed on raw values instead of ranks (linear correlation).',
      zh: '用原始数值而非排名计算的同一平均相关系数（线性相关）。',
    },
    read: {
      en: 'Compare it with the mean rank IC. A different sign means a few extreme values drive the linear relation; Core then lists the disagreement as a verdict reason.',
      zh: '与平均秩 IC 对照阅读。两者符号不同说明少数极端值主导了线性关系；Core 会把这一分歧列为判决原因。',
    },
    core: {
      en: 'Same bars, purge and forward return as the rank IC, without ranking.',
      zh: '与秩 IC 相同的K线、剔除规则和前瞻收益，只是不做排名。',
    },
    caveat: TEMPORAL_NOTE,
  },
  rankIcStd: {
    label: { en: 'Rank IC std', zh: '秩 IC 标准差' },
    definition: {
      en: 'How much the per-bar rank IC varies within the split.',
      zh: '数据划分内逐K线秩 IC 的波动程度。',
    },
    read: {
      en: 'For the same mean, lower is steadier. It is the denominator of the IC IR.',
      zh: '平均值相同时，越低越稳定。它是 IC IR 的分母。',
    },
    core: {
      en: 'Population standard deviation (ddof 0) of the per-bar values, per bar and not annualised.',
      zh: '逐K线数值的总体标准差（ddof 为 0），按K线计，不年化。',
    },
    caveat: TEMPORAL_NOTE,
  },
  rankIcir: {
    label: { en: 'Rank IC IR', zh: '秩 IC 信息比率' },
    definition: {
      en: 'Mean rank IC divided by its standard deviation: how consistently the factor ranks.',
      zh: '平均秩 IC 除以其标准差：衡量因子排序能力的稳定性。',
    },
    read: {
      en: 'Higher is steadier. Values here are per bar; some tools annualise by √(bars per year), so compare across tools only after checking. Useful daily cross-sectional factors often sit roughly between 0.1 and 0.3 per bar.',
      zh: '越高越稳定。此处按K线计；部分工具会乘以 √(每年K线数) 年化，跨工具比较前需先确认。有用的日频横截面因子按K线计通常大约在 0.1 到 0.3 之间。',
    },
    core: {
      en: 'Mean divided by the population standard deviation; empty when the standard deviation is effectively 0.',
      zh: '均值除以总体标准差；标准差近似为 0 时留空。',
    },
    caveat: TEMPORAL_NOTE,
    sources: [ALPHALENS, JQFACTOR],
  },
  pearsonIcir: {
    label: { en: 'Pearson IC IR', zh: 'Pearson IC 信息比率' },
    definition: {
      en: 'Mean Pearson IC divided by its standard deviation.',
      zh: '平均 Pearson IC 除以其标准差。',
    },
    read: {
      en: 'Read like the rank IC IR; a large gap between the two points to outliers.',
      zh: '读法同秩 IC IR；两者差距大说明存在离群值。',
    },
    core: {
      en: 'Mean divided by the population standard deviation, per bar and not annualised.',
      zh: '均值除以总体标准差，按K线计，不年化。',
    },
    caveat: TEMPORAL_NOTE,
  },
  rankHitRate: {
    label: { en: 'Hit rate', zh: '命中率' },
    definition: {
      en: 'The share of bars whose rank IC is strictly above 0.',
      zh: '秩 IC 严格大于 0 的K线占比。',
    },
    read: {
      en: '0.5 is a coin flip; above 0.5 the sign was right more often than not. It says nothing about size.',
      zh: '0.5 相当于抛硬币；高于 0.5 说明方向判断正确的次数更多。它不反映幅度。',
    },
    core: {
      en: 'Count of per-bar values above 0 divided by observations.',
      zh: '逐K线数值大于 0 的次数除以观测数。',
    },
    caveat: TEMPORAL_NOTE,
  },
  hacT: {
    label: { en: 'HAC t', zh: 'HAC t 值' },
    definition: {
      en: 'Mean IC divided by a Newey–West (HAC) standard error that allows for autocorrelated, overlapping observations.',
      zh: '平均 IC 除以 Newey–West（HAC）标准误，该标准误允许观测之间自相关和重叠。',
    },
    read: {
      en: '|t| ≥ 1.96 is roughly two-sided 5% significance. Core’s qualification needs t ≥ 1.96 with a positive mean IC. It is not adjusted for how many candidates were tried.',
      zh: '|t| ≥ 1.96 约相当于双侧 5% 显著性。Core 的资格判定要求 t ≥ 1.96 且平均 IC 为正。它没有按尝试过的候选数量校正。',
    },
    core: {
      en: 'Bartlett-kernel Newey–West; maximum lag min(5, n−1) in cross-sectional mode, min(h, n−1) in single-asset temporal mode.',
      zh: 'Bartlett 核 Newey–West；横截面模式最大滞后 min(5, n−1)，单资产时间序列模式为 min(h, n−1)。',
    },
    caveat: {
      en: 'In cross-sectional mode the lag stays 5 even for longer horizons, so overlap beyond 6 bars is only partly corrected. Alphalens reports a plain one-sample t-test of the IC series, without HAC.',
      zh: '横截面模式下即使预测周期更长，滞后仍为 5，因此超过 6 根K线的重叠只得到部分校正。Alphalens 报告的是 IC 序列的普通单样本 t 检验，不做 HAC。',
    },
    sources: [ALPHALENS],
  },
  hacP: {
    label: { en: 'HAC p', zh: 'HAC p 值' },
    definition: {
      en: 'The two-sided p-value of the HAC t, from the normal approximation.',
      zh: 'HAC t 值的双侧 p 值，基于正态近似。',
    },
    read: {
      en: 'Smaller is stronger evidence that the mean IC is not 0. A raw p ignores how many candidates were tried; see the adjusted p.',
      zh: '越小，平均 IC 不为 0 的证据越强。原始 p 值没有考虑尝试过的候选数量；请看校正 p 值。',
    },
    core: {
      en: 'erfc(|t| / √2); empty when the standard error is effectively 0.',
      zh: 'erfc(|t| / √2)；标准误近似为 0 时留空。',
    },
    caveat: {
      en: 'Two-sided: the positive-direction requirement is checked separately.',
      zh: '双侧检验：“方向为正”的要求单独检查。',
    },
  },
  observations: {
    label: { en: 'Observations', zh: '观测数' },
    definition: {
      en: 'The number of bars with a defined IC inside the purged split.',
      zh: '剔除边界后，数据划分内 IC 有定义的K线数量。',
    },
    read: {
      en: 'Core needs at least 20 per split and horizon (3 for folds and regimes); fewer is marked weak. Overlapping forward returns mean observations are not independent.',
      zh: 'Core 要求每个数据划分和预测周期至少 20 个（分折和市场状态为 3 个）；不足会标记为弱。前瞻收益重叠，观测之间并不独立。',
    },
    core: {
      en: 'Counted after removing rows whose forward target crosses the split end; a cross-sectional bar needs 4+ assets with values.',
      zh: '先剔除前瞻目标跨越数据划分终点的行再计数；横截面的一根K线需要至少 4 个有值的资产。',
    },
  },
  trialsCounted: {
    label: { en: 'Trials counted', zh: '计入的试验' },
    definition: {
      en: 'How many candidate evaluations this Project’s research family has recorded.',
      zh: '本项目研究族记录的候选评估次数。',
    },
    read: {
      en: 'More trials raise the bar: the family-wise rule multiplies the raw p by the number of distinct candidate sources. Ideas tried outside this Project are not counted.',
      zh: '试验越多，门槛越高：族错误率规则把原始 p 值乘以不同候选源码的数量。项目之外尝试过的想法不计入。',
    },
    core: {
      en: 'Executions = every Run in the family; the adjustment uses distinct candidate source hashes under the same Study, Judge, dataset and objective, failed sources included.',
      zh: '执行次数 = 研究族中的全部运行；校正使用同一研究、评判器、数据集和目标下不同的候选源码哈希数，失败的源码也计入。',
    },
  },
  adjustedP: {
    label: { en: 'Adj. p', zh: '校正 p 值' },
    definition: {
      en: 'The validation HAC p multiplied by the number of distinct candidate sources tried (Bonferroni), capped at 1.',
      zh: '验证集 HAC p 值乘以尝试过的不同候选源码数量（Bonferroni），上限为 1。',
    },
    read: {
      en: 'The family-wise rule passes when the mean IC is positive and the adjusted p is at most 0.05. Conservative when trials are similar.',
      zh: '平均 IC 为正且校正 p 值不超过 0.05 时，族错误率规则通过。候选彼此相似时该校正偏保守。',
    },
    core: {
      en: 'Method bonferroni-hac-v1 from the Session ledger: min(1, p × max(1, distinct sources)).',
      zh: '方法 bonferroni-hac-v1，来自会话记录：min(1, p × max(1, 不同源码数))。',
    },
    caveat: {
      en: 'It describes the Session’s selected leader, which may be a different Run from the one on screen. Factor evidence uses no deflated Sharpe ratio.',
      zh: '它描述的是会话选出的领先候选，可能不是当前显示的运行。因子证据不使用缩减夏普比率（DSR）。',
    },
  },
  chronologicalFolds: {
    label: { en: 'Chronological folds', zh: '时间分折' },
    definition: {
      en: 'Each split cut into two consecutive halves in time order, each scored on its own.',
      zh: '每个数据划分按时间顺序切成前后两半，分别评分。',
    },
    read: {
      en: 'A decision-signal claim needs a positive mean rank IC in every validation fold; one negative half shows the edge is not stable in time.',
      zh: '决策信号主张要求每个验证分折的平均秩 IC 都为正；任一半为负说明优势在时间上不稳定。',
    },
    core: {
      en: 'Halves of train, validation and test, each purged at the primary horizon; minimum 3 observations per fold.',
      zh: '训练、验证、测试各分两半，均按主预测周期剔除边界；每个分折至少 3 个观测。',
    },
  },
  qualificationStage: {
    label: { en: 'Qualification stage', zh: '资格阶段' },
    definition: {
      en: 'Core’s ordered diagnosis of the Factor evidence: the first check that fails names the stage.',
      zh: 'Core 对因子证据的顺序诊断：第一个未通过的检查决定阶段名称。',
    },
    read: {
      en: 'decision-signal-positive means every required check passed on validation. Any other stage is not established; it is not a refutation of the idea.',
      zh: 'decision-signal-positive 表示验证集上所有必需检查都通过。其他阶段表示尚未成立，并不等于否定这个想法。',
    },
    core: {
      en: 'In order: validation mean IC above 0, HAC t ≥ 1.96, every validation fold positive; Portfolio factor claims also test the style-neutral residual and the blend.',
      zh: '依次检查：验证集平均 IC 大于 0、HAC t ≥ 1.96、每个验证分折为正；组合因子主张还要检查风格中性残差和混合因子。',
    },
  },

  // ---------------------------------------------------------------- Factor: long-short spread
  spreadTotalReturn: {
    label: { en: 'Total return', zh: '总收益' },
    definition: {
      en: 'The compounded return of the per-bar long-short spread (high group minus low group) over the split.',
      zh: '数据划分内逐K线多空价差（高组减低组）的复利收益。',
    },
    read: {
      en: 'Positive: the high-factor group beat the low group. It is gross of costs and not a tradable portfolio result.',
      zh: '为正：高因子组跑赢低因子组。未扣成本，不是可交易组合的结果。',
    },
    core: SPREAD_CORE,
    caveat: SPREAD_CAVEAT,
    sources: [ALPHALENS, JQFACTOR],
  },
  spreadMaxDrawdown: {
    label: { en: 'Max drawdown', zh: '最大回撤' },
    definition: {
      en: 'The largest peak-to-trough fall of the compounded long-short spread within the split.',
      zh: '数据划分内复利多空价差从峰值到谷底的最大跌幅。',
    },
    read: {
      en: 'Closer to 0 is better. Compare it with the total return to judge the path, not just the end point.',
      zh: '越接近 0 越好。与总收益对照，判断路径而不只看终点。',
    },
    core: SPREAD_CORE,
    caveat: SPREAD_CAVEAT,
  },
  spreadSharpePerBar: {
    label: { en: 'Sharpe per bar', zh: '每K线夏普' },
    definition: {
      en: 'Mean of the per-bar spread divided by its standard deviation.',
      zh: '逐K线价差的均值除以其标准差。',
    },
    read: {
      en: 'Per bar, not annualised, so it is much smaller than an annual Sharpe. Above 0 means the spread was positive on average.',
      zh: '按K线计，不年化，因此远小于年化夏普。大于 0 表示价差平均为正。',
    },
    core: {
      en: 'Arithmetic mean divided by the sample standard deviation (ddof 1) of the gross spread.',
      zh: '毛价差的算术均值除以样本标准差（ddof 为 1）。',
    },
    caveat: SPREAD_CAVEAT,
  },
  spreadHitRate: {
    label: { en: 'Hit rate', zh: '命中率' },
    definition: {
      en: 'The share of bars on which the long-short spread was above 0.',
      zh: '多空价差大于 0 的K线占比。',
    },
    read: {
      en: '0.5 is a coin flip. A high hit rate with a negative total means rare large losses.',
      zh: '0.5 相当于抛硬币。命中率高但总收益为负，说明有少数大额亏损。',
    },
    core: SPREAD_CORE,
  },
  spreadMeanPerBar: {
    label: { en: 'Mean per bar', zh: '每K线均值' },
    definition: {
      en: 'The arithmetic mean of the per-bar long-short spread.',
      zh: '逐K线多空价差的算术平均值。',
    },
    read: {
      en: 'The average gap between high and low groups each bar, before costs. Compare with the cost per trade before calling it tradable.',
      zh: '每根K线高组与低组的平均差距，未扣成本。判断能否交易前请与单次交易成本比较。',
    },
    core: SPREAD_CORE,
    caveat: SPREAD_CAVEAT,
  },
  spreadObservations: {
    label: { en: 'Observations', zh: '观测数' },
    definition: {
      en: 'The number of bars with a long-short spread in the split.',
      zh: '数据划分内有多空价差的K线数量。',
    },
    read: {
      en: 'A bar needs at least 4 assets and 3 distinct factor values to form groups.',
      zh: '一根K线至少需要 4 个资产和 3 个不同的因子值才能分组。',
    },
    core: SPREAD_CORE,
  },

  // ---------------------------------------------------------------- Factor: stability and qualification
  assetRankCorrelation: {
    label: { en: 'Rank correlation', zh: '秩相关' },
    definition: {
      en: 'For one asset, the time-series Spearman correlation between its factor values and its forward returns within the split.',
      zh: '单个资产在数据划分内，其因子值与前瞻收益的时间序列 Spearman 相关。',
    },
    read: {
      en: 'Shows whether the edge comes from a few assets. It is not the cross-sectional IC.',
      zh: '用来查看优势是否只来自少数资产。它不是横截面 IC。',
    },
    core: {
      en: 'Primary horizon, purged split mask, at least 10 observations per asset.',
      zh: '主预测周期、剔除边界后的数据划分，每个资产至少 10 个观测。',
    },
  },
  styleMeanRankCorrelation: {
    label: { en: 'Mean rank correlation', zh: '平均秩相关' },
    definition: {
      en: 'The average per-bar cross-sectional Spearman correlation between the candidate and a known style.',
      zh: '候选因子与已知风格之间逐K线横截面 Spearman 相关的平均值。',
    },
    read: {
      en: 'Near +1 or −1: the candidate is largely that style (or its mirror). Near 0: little overlap.',
      zh: '接近 +1 或 −1：候选因子基本就是该风格（或其反向）。接近 0：重叠很少。',
    },
    core: {
      en: 'Styles momentum_20, reversal_5, realized_volatility_20 and relative_volume_20, at the primary horizon’s split mask.',
      zh: '风格包括 momentum_20、reversal_5、realized_volatility_20 和 relative_volume_20，按主预测周期的数据划分计算。',
    },
  },
  styleMeanAbsRankCorrelation: {
    label: { en: 'Mean |rank correlation|', zh: '平均 |秩相关|' },
    definition: {
      en: 'The average of the absolute per-bar rank correlation with the style.',
      zh: '与风格逐K线秩相关绝对值的平均值。',
    },
    read: {
      en: 'Catches overlap that changes sign over time and would average out in the plain mean.',
      zh: '能发现随时间变号、在普通均值中被抵消的重叠。',
    },
    core: {
      en: 'Same bars and styles as the mean rank correlation, absolute value taken per bar.',
      zh: '与平均秩相关使用相同的K线和风格，每根K线先取绝对值。',
    },
  },
  styleNeutralIcRetention: {
    label: { en: 'Style-neutral IC retention', zh: '风格中性 IC 保留率' },
    definition: {
      en: 'The share of the candidate’s validation IC kept after removing the dominant style.',
      zh: '去除主导风格后，候选因子保留下来的验证集 IC 比例。',
    },
    read: {
      en: 'Near 1: the edge is mostly the candidate’s own. Near 0 or negative: it was mostly the style.',
      zh: '接近 1：优势主要来自候选因子本身。接近 0 或为负：主要来自风格。',
    },
    core: {
      en: 'Residual IC ÷ raw IC. Each bar the candidate’s percentile rank is regressed on the style’s (OLS) and the residual is scored; the target never enters; the style is chosen on train.',
      zh: '残差 IC ÷ 原始 IC。每根K线把候选因子的百分位排名对风格排名做 OLS 回归，用残差评分；目标不参与；风格在训练集上选定。',
    },
  },
  styleNeutralIcDelta: {
    label: { en: 'Style-neutral IC delta', zh: '风格中性 IC 差值' },
    definition: {
      en: 'The style-neutral IC minus the candidate IC on validation.',
      zh: '验证集上风格中性 IC 减去候选因子 IC。',
    },
    read: {
      en: 'Negative: removing the style cost IC. Around 0: the style explained little.',
      zh: '为负：去除风格损失了 IC。接近 0：风格解释得很少。',
    },
    core: {
      en: 'Primary-horizon validation mean rank IC of the residual minus that of the raw candidate.',
      zh: '主预测周期验证集上，残差的平均秩 IC 减去原始候选的平均秩 IC。',
    },
  },
  blendUpliftVsStyle: {
    label: { en: 'Blend uplift vs style', zh: '混合相对风格的提升' },
    definition: {
      en: 'The IC of an equal-rank blend of candidate and style, minus the style’s own IC.',
      zh: '候选因子与风格等权排名混合后的 IC，减去风格自身的 IC。',
    },
    read: {
      en: 'Positive: adding the candidate improves on the style alone.',
      zh: '为正：加入候选因子优于单用风格。',
    },
    core: {
      en: 'Blend = (percentile rank of candidate + percentile rank of style) ÷ 2 where both exist; validation, primary horizon.',
      zh: '混合 = (候选百分位排名 + 风格百分位排名) ÷ 2，仅在两者都有值时计算；验证集、主预测周期。',
    },
  },
  blendUpliftVsCandidate: {
    label: { en: 'Blend uplift vs candidate', zh: '混合相对候选的提升' },
    definition: {
      en: 'The IC of the equal-rank blend minus the candidate’s own IC.',
      zh: '等权排名混合的 IC 减去候选因子自身的 IC。',
    },
    read: {
      en: 'Positive: the style adds information the candidate lacks.',
      zh: '为正：风格提供了候选因子缺少的信息。',
    },
    core: {
      en: 'Same blend as above; validation, primary horizon.',
      zh: '与上一项相同的混合；验证集、主预测周期。',
    },
  },

  // ---------------------------------------------------------------- Portfolio
  netTotalReturn: {
    label: { en: 'Net total return', zh: '净总收益' },
    definition: {
      en: 'The compounded return over the split after modelled trading costs.',
      zh: '数据划分内扣除模型交易成本后的复利收益。',
    },
    read: {
      en: 'Above 0 made money in this window after costs. Compare it with the benchmark; one split is a short sample.',
      zh: '大于 0 表示该窗口扣成本后盈利。请与基准比较；单个数据划分样本较短。',
    },
    core: PORTFOLIO_LEDGER,
  },
  netAnnualReturn: {
    label: { en: 'Net annual return', zh: '净年化收益' },
    definition: {
      en: 'The net total return converted to a yearly compound rate.',
      zh: '把净总收益换算成年复合收益率。',
    },
    read: {
      en: 'Short windows annualise noisily: a few good months can look like a large annual rate.',
      zh: '短窗口年化噪声大：几个月的好表现可能显得年化很高。',
    },
    core: {
      en: 'growth^(A ÷ bars) − 1, with A = bars per year inferred from timestamps; −100% if the book is wiped out.',
      zh: '增长倍数^(A ÷ K线数) − 1，A 为由时间戳推断的每年K线数；组合归零时为 −100%。',
    },
  },
  netSharpe: {
    label: { en: 'Net Sharpe', zh: '净夏普' },
    definition: {
      en: 'Annualised mean net return divided by annualised volatility.',
      zh: '年化平均净收益除以年化波动率。',
    },
    read: {
      en: 'Above 1 over a long window is good; short windows are noisy. It is not deflated for the number of trials on this page.',
      zh: '长窗口下大于 1 算好；短窗口噪声大。本页未按试验次数做缩减。',
    },
    core: {
      en: 'mean ÷ population std × √A of per-bar net returns; no risk-free rate is subtracted (cash earns 0).',
      zh: '逐K线净收益的均值 ÷ 总体标准差 × √A；不扣无风险利率（现金收益为 0）。',
    },
  },
  netSortino: {
    label: { en: 'Net Sortino', zh: '净索提诺' },
    definition: {
      en: 'Like the Sharpe ratio, but only losses count as risk.',
      zh: '类似夏普比率，但只把亏损算作风险。',
    },
    read: {
      en: 'Higher than the Sharpe when losses are smaller than gains in size.',
      zh: '亏损幅度小于盈利幅度时，它会高于夏普。',
    },
    core: {
      en: 'mean ÷ √(mean of min(r, 0)²) × √A, target 0, averaged over all bars.',
      zh: '均值 ÷ √(min(r, 0)² 的均值) × √A，目标收益为 0，对全部K线取平均。',
    },
  },
  maxDrawdown: {
    label: { en: 'Max drawdown', zh: '最大回撤' },
    definition: {
      en: 'The largest peak-to-trough fall of compounded net equity within the split.',
      zh: '数据划分内复利净值从峰值到谷底的最大跌幅。',
    },
    read: {
      en: 'Closer to 0 is better; it is the pain a holder would have sat through in this window.',
      zh: '越接近 0 越好；它是持有者在该窗口内要承受的最大损失。',
    },
    core: {
      en: 'Measured on the compounded net return path of the split.',
      zh: '在数据划分的复利净收益路径上计算。',
    },
  },
  calmar: {
    label: { en: 'Calmar', zh: '卡玛比率' },
    definition: {
      en: 'Net annual return divided by the size of the max drawdown.',
      zh: '净年化收益除以最大回撤的幅度。',
    },
    read: {
      en: 'Higher is better. Computed over this split only, not the usual 36-month window, so short splits overstate it.',
      zh: '越高越好。只在本数据划分上计算，而不是常见的 36 个月窗口，短窗口会高估。',
    },
    core: {
      en: 'annual return ÷ |max drawdown|; 0 when there was no drawdown.',
      zh: '年化收益 ÷ |最大回撤|；没有回撤时为 0。',
    },
  },
  annualVolatility: {
    label: { en: 'Volatility (ann.)', zh: '年化波动率' },
    definition: {
      en: 'The standard deviation of per-bar net returns, scaled to a year.',
      zh: '逐K线净收益的标准差，换算到年。',
    },
    read: {
      en: 'Size of typical swings, not direction. Compare it with the mandate’s risk ceiling.',
      zh: '表示常见波动幅度，不表示方向。可与授权的风险上限比较。',
    },
    core: {
      en: 'Population std (ddof 0) × √A.',
      zh: '总体标准差（ddof 为 0）× √A。',
    },
  },
  expectedShortfall95: {
    label: { en: 'Exp. shortfall 95%', zh: '95% 预期亏损' },
    definition: {
      en: 'The average loss on the worst 5% of bars in the split.',
      zh: '数据划分内最差 5% 的K线上的平均亏损。',
    },
    read: {
      en: 'Reported as a positive loss per bar; larger means a heavier bad tail. It is historical, not a forecast.',
      zh: '以正数表示每根K线的亏损；越大说明坏尾部越重。它是历史值，不是预测。',
    },
    core: {
      en: 'Minus the mean of the worst ceil(5% × bars) per-bar net returns.',
      zh: '最差 ceil(5% × K线数) 个逐K线净收益均值的相反数。',
    },
  },
  positiveRate: {
    label: { en: 'Positive-day rate', zh: '正收益日占比' },
    definition: {
      en: 'The share of bars with a net return above 0.',
      zh: '净收益大于 0 的K线占比。',
    },
    read: {
      en: 'Counted per bar: it equals days only on daily bars. A high rate with a poor total means rare large losses.',
      zh: '按K线计数：只有日频K线时才等于天数。占比高但总收益差说明有少数大额亏损。',
    },
    core: {
      en: 'Count of per-bar net returns above 0 divided by bars.',
      zh: '逐K线净收益大于 0 的次数除以K线数。',
    },
  },
  activeReturn: {
    label: { en: 'Active return', zh: '主动收益' },
    definition: {
      en: 'The annualised average of net return minus benchmark return.',
      zh: '净收益减去基准收益后的年化平均值。',
    },
    read: {
      en: 'Above 0 beat the benchmark. It is an arithmetic average, not the difference of two compound rates.',
      zh: '大于 0 表示跑赢基准。它是算术平均，不是两个复合收益率之差。',
    },
    core: {
      en: 'mean(net − benchmark) × A; the benchmark (cash or a named asset) comes from the mandate.',
      zh: 'mean(净收益 − 基准) × A；基准（现金或指定资产）来自授权。',
    },
  },
  informationRatio: {
    label: { en: 'Information ratio', zh: '信息比率' },
    definition: {
      en: 'Active return divided by its volatility (tracking error).',
      zh: '主动收益除以其波动率（跟踪误差）。',
    },
    read: {
      en: 'Higher means the benchmark was beaten more consistently. Above 0.5 sustained over years is good.',
      zh: '越高说明跑赢基准越稳定。多年持续高于 0.5 算好。',
    },
    core: {
      en: 'mean(active) ÷ population std(active) × √A.',
      zh: 'mean(主动收益) ÷ 总体标准差(主动收益) × √A。',
    },
  },
  turnover: {
    label: { en: '1-way turnover / yr', zh: '年单边换手' },
    definition: {
      en: 'How much of the book is traded in a year, counting one side of each trade.',
      zh: '一年内组合被交易的比例，每笔交易只计一边。',
    },
    read: {
      en: '1.0x means the book is replaced about once a year. Higher turnover makes the result more sensitive to costs.',
      zh: '1.0x 表示每年大约换仓一次。换手越高，结果对成本越敏感。',
    },
    core: {
      en: 'Per bar 0.5 × Σ|Δw| from post-drift weights to executed weights; mean × A.',
      zh: '逐K线 0.5 × Σ|Δw|（从漂移后权重到成交后权重）；均值 × A。',
    },
  },
  costDrag: {
    label: { en: 'Total cost drag', zh: '总成本拖累' },
    definition: {
      en: 'The total modelled trading cost over the split, as a fraction of the book.',
      zh: '数据划分内模型交易成本的总和，以组合价值的比例表示。',
    },
    read: {
      en: 'Compare it with the gross return: a drag close to the gross edge leaves little after costs.',
      zh: '与毛收益比较：成本拖累接近毛优势时，扣成本后所剩无几。',
    },
    core: {
      en: 'Sum of per-bar costs Σ|Δw| × bps ÷ 10,000 (default 10 bps on every traded unit), not compounded.',
      zh: '逐K线成本 Σ|Δw| × bps ÷ 10,000 的总和（默认每个成交单位 10 bps），不复利。',
    },
  },
} satisfies Record<string, MetricEntry>

export type MetricId = keyof typeof METRIC_CATALOGUE

export const METRIC_IDS = Object.keys(METRIC_CATALOGUE) as MetricId[]

export function metricEntry(id: MetricId): MetricEntry {
  return METRIC_CATALOGUE[id]
}

/** The current-language side of a bilingual text. */
export function bi(text: Bi): string {
  return getLanguage() === 'zh' ? text.zh : text.en
}

/** Fill `{0}`-style placeholders in the current-language side of a bilingual template. Values are inserted verbatim. */
export function biTemplate(text: Bi, values: unknown[]): string {
  return bi(text).replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''))
}

// ---------------------------------------------------------------------------------------------
// Fixed reading order of a Factor answer card

export type AdjustmentState = 'passes' | 'fails' | 'none'

const READING_ORDER = {
  verdict: {
    en: 'The verdict word. Supported needs Core’s positive decision-signal diagnosis and a passing trial-family adjustment; Inconclusive means not established and not disproved; Could not be tested means there is no scientific conclusion.',
    zh: '结论词。“支持”需要 Core 的决策信号诊断为正且试验族校正通过；“不确定”表示尚未成立、也未被否定；“无法检验”表示没有科学结论。',
  },
  tested: {
    en: 'What was tested. Your original question, scored on the validation split ({0}) at the {1}-bar horizon. This is development evidence, not independent confirmation.',
    zh: '检验了什么。你的原始问题，在验证集（{0}）上按 {1} 个周期的预测范围评分。这是开发阶段证据，不是独立确认。',
  },
  numbers: {
    en: 'The focal numbers. Rank IC gives the direction and size of the ranking skill; HAC t and p say whether it differs from zero; the long-short tiles compare the high and low groups before costs. Each ? defines one number.',
    zh: '核心数字。秩 IC 表示排序能力的方向和大小；HAC t 和 p 值说明它是否显著异于零；多空指标比较高组和低组，未扣成本。每个问号解释一个数字。',
  },
  trials: {
    en: 'Trials and adjustment. {0} executions from {1} distinct candidate sources are counted; the family-wise rule multiplies the raw p by the distinct sources and needs at most 0.05. {2}',
    zh: '试验与校正。共计入 {0} 次执行、{1} 个不同候选源码；族错误率规则把原始 p 值乘以不同源码数，要求不超过 0.05。{2}',
  },
  hidden: {
    en: 'What is hidden and why. Test-split numbers stay hidden until the Study publishes its test audit, so they cannot steer the next trial; the sealed holdout is not opened by this flow.',
    zh: '隐藏了什么、为什么。测试集数字在研究发布测试审计前保持隐藏，以免影响下一次试验；本流程不会打开封存的留出数据。',
  },
} satisfies Record<string, Bi>

const ADJUSTMENT_STATE: Record<AdjustmentState, Bi> = {
  passes: { en: 'For this Run the adjustment passes.', zh: '本次运行的校正已通过。' },
  fails: { en: 'For this Run the adjustment does not pass.', zh: '本次运行的校正未通过。' },
  none: { en: 'No adjustment is recorded for this Run.', zh: '本次运行没有记录校正结果。' },
}

const NO_RANGE: Bi = { en: 'no validated range', zh: '无已验证区间' }

/**
 * The five reading steps of the answer card, in their fixed order. Inputs are only values the card already shows
 * (validation window, horizon, trial counts, adjustment state): no test-split number can enter.
 */
export function readingOrder({ range, horizon, executions, sources, adjustment }: { range: string | null; horizon: number | string; executions: number; sources: number; adjustment: AdjustmentState }): string[] {
  return [
    bi(READING_ORDER.verdict),
    biTemplate(READING_ORDER.tested, [range ?? bi(NO_RANGE), horizon]),
    bi(READING_ORDER.numbers),
    biTemplate(READING_ORDER.trials, [executions, sources, bi(ADJUSTMENT_STATE[adjustment])]),
    bi(READING_ORDER.hidden),
  ]
}

/** Every bilingual text the catalogue owns, for completeness tests. */
export const READING_TEXTS: Bi[] = [...Object.values(READING_ORDER), ...Object.values(ADJUSTMENT_STATE), NO_RANGE]
