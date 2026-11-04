import { coreWord, uiTemplate, uiText } from '../../i18n'
import type { ReactNode } from 'react'
import { MetricTile } from '../../components/MetricTile'
import { day, finite, fn, NA, sn, sp, up } from '../portfolio/pfmt'
import { ActionSwatch } from './RlCharts'
import type { FusionSplit, RlDiagnostics } from './rlTypes'

type Split = 'validation' | 'test'
const words = coreWord
const label = (t: { fold: string; seed: number }) => `${t.fold.replace('fold-', 'F')} · s${t.seed}`

function Legacy({ children }: { children: string }) {
  return <p className="pf-na">{uiText("not available: ")}{children}</p>
}

/* ---------------------------------------------------------------- fusion diagnosis */

function Chain({ n, title, value, sub, good }: { n: string; title: string; value: string; sub: ReactNode; good: boolean | null }) {
  return (
    <li className={`rl-step${good === null ? '' : good ? ' rl-step--ok' : ' rl-step--bad'}`}>
      <small>{n} · {title}</small>
      <b>{value}</b>
      <i>{sub}</i>
      <em>{good === null ? uiText("no verdict") : good ? uiText("supportive") : uiText("adverse")}</em>
    </li>
  )
}

export function RlFusion({ r, testVisible }: { r: RlDiagnostics; testVisible: boolean }) {
  const f = r.factorFusionDiagnosis
  if (!f?.available) return <Legacy>{f?.reason ?? uiText("this Run predates candidate-factor fusion diagnosis")}</Legacy>
  const v = f.validation
  const t: FusionSplit | undefined = testVisible ? f.testAudit : undefined
  const c = v?.candidateFactor
  const tr = v?.adaptiveTransmission
  const stab = v?.stability
  const loss = v?.lossLocator
  return (
    <div className="vstack">
      <p className="rl-diag">
        <b>{words(f.diagnosis?.stage)}</b>
        <span className="muted small">{uiText(" · next focus ")}{words(f.diagnosis?.iterationFocus)}</span>
        <br />
        {f.diagnosis?.explanation ?? <NA why="diagnosis.explanation is not in the payload" />}
      </p>
      <ol className="rl-chain" aria-label={uiText("Validation RL factor-fusion value chain")}>
        <Chain n="01" title={uiText("Candidate sleeve")} value={`${sn(c?.fixedSleeveSharpeDeltaVsBalanced, 2)} Sharpe vs balanced`} sub={words(c?.assessment)} good={finite(c?.fixedSleeveSharpeDeltaVsBalanced) ? c.fixedSleeveSharpeDeltaVsBalanced > 0 : null} />
        <Chain n="02" title={uiText("Local opportunity capture")} value={`${up(c?.oracleCaptureRate, 1)} captured`} sub={`${up(c?.selectedFrequency, 1)} selected · ${up(c?.localBestFrequency, 1)} locally best`} good={finite(c?.meanLocalRewardDeltaVsBalanced) ? c.meanLocalRewardDeltaVsBalanced > 0 : null} />
        <Chain n="03" title={uiText("Adaptive book selection")} value={sp(tr?.meanTrialGrossActiveReturn, 1)} sub="gross active return, independent paths" good={finite(tr?.meanTrialGrossActiveReturn) ? tr.meanTrialGrossActiveReturn > 0 : null} />
        <Chain n="04" title={uiText("Incremental cost")} value={sp(tr?.meanTrialIncrementalCost, 2)} sub={`${up(tr?.policySwitchRate, 0)} policy switches`} good={finite(tr?.meanTrialIncrementalCost) ? tr.meanTrialIncrementalCost <= 0 : null} />
        <Chain n="05" title={uiText("Stable net adaptive value")} value={sp(tr?.meanTrialNetActiveReturn, 1)} sub={`Sharpe ${sn(tr?.meanSharpeAdvantageVsSelectedBaseline, 2)} · ${up(stab?.positiveNetTrialRate, 0)} positive trials`} good={finite(tr?.meanTrialNetActiveReturn) && finite(tr?.meanSharpeAdvantageVsSelectedBaseline) ? tr.meanTrialNetActiveReturn > 0 && tr.meanSharpeAdvantageVsSelectedBaseline > 0 : null} />
      </ol>
      <dl className="hm-grid">
        <MetricTile label={uiText("Selected equals local best")} value={up(v?.policySelection?.oracleHitRate, 1)} note={uiTemplate("mean selected rank {0}", [fn(v?.policySelection?.meanSelectedRank, 2)])} />
        <MetricTile label={uiText("Mean one-step regret")} value={fn(v?.policySelection?.meanOneStepRealizedRegret, 4)} />
        <MetricTile label={uiText("Active-day win rate")} value={up(tr?.conditionalActiveWinRate, 1)} note={uiTemplate("{0} active days", [up(tr?.activeDecisionRate, 1)])} />
      </dl>
      <dl className="hm-grid rl-wide">
        <MetricTile label={uiText("Worst causal regime")} value={loss?.worstRegime?.key ?? '—'} note={uiTemplate("{0} decisions · {1} net active", [loss?.worstRegime?.decisions ?? '—', sp(loss?.worstRegime?.totalNetActiveReturn, 1)])} />
        <MetricTile label={uiText("Worst action pair")} value={loss?.worstActionPair?.key ?? '—'} note={uiTemplate("{0} decisions · {1} net active", [loss?.worstActionPair?.decisions ?? '—', sp(loss?.worstActionPair?.totalNetActiveReturn, 1)])} />
        <MetricTile label={uiText("Worst switch state")} value={loss?.worstSwitchState?.key ?? '—'} note={uiTemplate("{0} decisions · {1} net active", [loss?.worstSwitchState?.decisions ?? '—', sp(loss?.worstSwitchState?.totalNetActiveReturn, 1)])} />
        <MetricTile label={uiText("Worst asset")} value={loss?.worstAssetGrossContribution?.asset ?? '—'} note={uiTemplate("gross contribution {0}", [sp(loss?.worstAssetGrossContribution?.totalGrossActiveContribution, 1)])} />
        <MetricTile label={uiText("Worst trial")} value={stab?.worstTrial ? label({ fold: stab.worstTrial.fold ?? '', seed: stab.worstTrial.seed ?? 0 }) : '—'} note={uiTemplate("net active {0} · Sharpe {1}", [sp(stab?.worstTrial?.netActiveReturn, 1), sn(stab?.worstTrial?.sharpeAdvantage, 1)])} />
      </dl>
      {t ? (
        <div className="rl-audit">
          <p className="h-small">{uiText("Test · visible audit only · never enters the diagnosis")}</p>
          <dl className="hm-grid">
            <MetricTile label={uiText("Candidate Sharpe vs balanced")} value={sn(t.candidateFactor?.fixedSleeveSharpeDeltaVsBalanced, 2)} />
            <MetricTile label={uiText("Gross to net active")} value={`${sp(t.adaptiveTransmission?.meanTrialGrossActiveReturn, 1)} to ${sp(t.adaptiveTransmission?.meanTrialNetActiveReturn, 1)}`} />
            <MetricTile label={uiText("Sharpe advantage")} value={sn(t.adaptiveTransmission?.meanSharpeAdvantageVsSelectedBaseline, 2)} />
            <MetricTile label={uiText("Positive net trials")} value={up(t.stability?.positiveNetTrialRate, 0)} />
          </dl>
        </div>
      ) : (
        <p className="small muted"><NA why="no test audit is published for this Run, so no test figure is drawn here" /></p>
      )}
      <p className="small muted">{uiText("Candidate fixed-sleeve evidence and same-pretrade one-step opportunity are distinct. Adaptive gross, cost and net use independent complete policy paths. Local best is ex-post, Q margins are uncalibrated, and validation alone sets the research focus. Research prioritization only; no training, promotion or trading authority.")}</p>
    </div>
  )
}

/* ---------------------------------------------------------------- incremental attribution */

export function RlIncremental({ r, split }: { r: RlDiagnostics; split: Split }) {
  const a = r.incrementalAttribution
  if (!a?.available) return <Legacy>{uiText("this Run did not record full-path incremental attribution (legacy).")}</Legacy>
  const s = a[split]
  if (!s) return <NA why={`incrementalAttribution.${split} is not in the payload`} />
  const regimes = [...(s.byRegime ?? [])].sort((x, y) => x.dimension.localeCompare(y.dimension) || x.bucket.localeCompare(y.bucket))
  const assets = [...(s.byAsset ?? [])].sort((x, y) => Math.abs(y.totalGrossActiveContribution ?? 0) - Math.abs(x.totalGrossActiveContribution ?? 0) || x.asset.localeCompare(y.asset))
  const pairs = [...(s.byActionPair ?? [])].sort((x, y) => (y.decisions ?? 0) - (x.decisions ?? 0) || x.key.localeCompare(y.key))
  const switches = [...(s.bySwitchState ?? [])].sort((x, y) => x.key.localeCompare(y.key))
  return (
    <div className="vstack">
      <dl className="hm-grid">
        <MetricTile label={uiText("Gross selection edge")} value={sp(s.meanTrialTotalGrossActiveReturn, 1)} note={uiText("mean trial path")} />
        <MetricTile label={uiText("Incremental cost")} value={sp(s.meanTrialTotalIncrementalCost, 2)} note={uiText("mean trial path")} />
        <MetricTile label={uiText("Net active return")} value={sp(s.meanTrialTotalNetActiveReturn, 1)} note={uiText("mean trial path")} />
        <MetricTile label={uiText("Information ratio")} value={fn(s.informationRatio, 2)} note={uiTemplate("tracking error {0}", [up(s.annualizedTrackingError, 1)])} />
        <MetricTile label={uiText("Active-day win rate")} value={up(s.conditionalActiveWinRate, 1)} note={uiTemplate("{0} of days active", [up(s.activeDecisionRate, 1)])} />
        <MetricTile label={uiText("Relative max drawdown")} value={sp(s.relativeMaximumDrawdown, 1)} note={uiTemplate("relative total return {0}", [sp(s.relativeTotalReturn, 1)])} />
        <MetricTile label={uiText("Daily net active, p05 / median / p95")} value={`${sp(s.p05NetActiveReturn, 2)} / ${sp(s.medianNetActiveReturn, 2)} / ${sp(s.p95NetActiveReturn, 2)}`} note={uiTemplate("worst {0} · best {1}", [sp(s.worstNetActiveReturn, 2), sp(s.bestNetActiveReturn, 2)])} />
        <MetricTile label={uiText("Policy / baseline switch rate")} value={`${up(s.policySwitchRate, 0)} / ${up(s.baselineSwitchRate, 0)}`} note={uiTemplate("actions differ on {0} of days", [up(s.actionsDifferRate, 0)])} />
      </dl>
      <div className="cols">
        <div>
          <h3 className="h-small">{uiText("Where the active return appears")}</h3>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Regime")}</th><th scope="col" className="r">{uiText("Days")}</th><th scope="col" className="r">{uiText("Mean net active")}</th><th scope="col" className="r">{uiText("Win")}</th></tr></thead>
              <tbody>
                {regimes.map((x) => (
                  <tr key={x.key}><th scope="row">{x.dimension} · {x.bucket}</th><td className="r">{x.decisions ?? '—'}</td><td className="r">{sp(x.meanNetActiveReturn, 3)}</td><td className="r">{up(x.conditionalActiveWinRate, 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="h-small">{uiText("Asset gross contribution")}</h3>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Asset")}</th><th scope="col" className="r">{uiText("Mean trial total")}</th><th scope="col" className="r">{uiText("Mean per day")}</th></tr></thead>
              <tbody>
                {assets.map((x) => (
                  <tr key={x.asset}><th scope="row">{x.asset}</th><td className="r">{sp(x.meanTrialTotalGrossActiveContribution, 2)}</td><td className="r">{sp(x.meanGrossActiveContribution, 3)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="cols">
        <div>
          <h3 className="h-small">{uiText("Policy to baseline action pairs")}</h3>
          <div className="tablewrap tablewrap--tall">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Pair")}</th><th scope="col" className="r">{uiText("Days")}</th><th scope="col" className="r">{uiText("Mean net active")}</th><th scope="col" className="r">{uiText("Win")}</th></tr></thead>
              <tbody>
                {pairs.map((x) => (
                  <tr key={x.key}><th scope="row">{x.policyAction}{uiText(" to ")}{x.baselineAction}</th><td className="r">{x.decisions ?? '—'}</td><td className="r">{sp(x.meanNetActiveReturn, 3)}</td><td className="r">{up(x.conditionalActiveWinRate, 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="h-small">{uiText("Switch state")}</h3>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("State")}</th><th scope="col" className="r">{uiText("Days")}</th><th scope="col" className="r">{uiText("Cost")}</th><th scope="col" className="r">{uiText("Net active")}</th><th scope="col" className="r">{uiText("Win")}</th></tr></thead>
              <tbody>
                {switches.map((x) => (
                  <tr key={x.key}><th scope="row">{words(x.key)}</th><td className="r">{x.decisions ?? '—'}</td><td className="r">{sp(x.totalIncrementalCost, 2)}</td><td className="r">{sp(x.meanNetActiveReturn, 3)}</td><td className="r">{up(x.conditionalActiveWinRate, 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="small muted">{uiText("Each policy carries its own holdings, drift, no-trade decisions, risk repair, turnover and costs. Gross edge minus incremental cost equals net active return; asset contributions reconcile gross edge. Regime tables describe where active return fell and are not selection rules.")}{s.reconciliation ? uiTemplate("Server reconciliation {0}.", [s.reconciliation.passed ? 'passed' : 'FAILED']) : ''}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- behavior */

export function RlBehavior({ r, split }: { r: RlDiagnostics; split: Split }) {
  const b = r.policyBehavior
  if (!b?.available) return <Legacy>{uiText("this Run did not record exact policy-rationale evidence (legacy).")}</Legacy>
  const s = b[split]
  if (!s) return <NA why={`policyBehavior.${split} is not in the payload`} />
  const actions = r.protocol?.actions ?? []
  const byAction = [...(s.byAction ?? [])].sort((x, y) => (y.frequency ?? 0) - (x.frequency ?? 0) || x.action.localeCompare(y.action))
  const features = [...(s.byFeature ?? [])].sort((x, y) => (y.dominantRate ?? 0) - (x.dominantRate ?? 0) || (y.meanAbsoluteMarginContribution ?? 0) - (x.meanAbsoluteMarginContribution ?? 0) || x.feature.localeCompare(y.feature))
  const decisions = [...(b.representativeDecisions ?? [])].filter((d) => d.split === split).sort((x, y) => (x.actionMargin ?? 0) - (y.actionMargin ?? 0) || x.timestamp.localeCompare(y.timestamp))
  const reps = decisions.length > 6 ? [...decisions.slice(0, 3).map((d) => ({ d, k: 'Low margin' })), ...decisions.slice(-3).map((d) => ({ d, k: 'High margin' }))] : decisions.map((d) => ({ d, k: 'Representative' }))
  return (
    <div className="vstack">
      <dl className="hm-grid">
        <MetricTile label={uiText("Mean action run")} value={`${fn(s.meanActionRunLength, 2)} bars`} note={uiTemplate("longest {0}", [s.maximumActionRunLength ?? '—'])} />
        <MetricTile label={uiText("Transition / retention")} value={`${up(s.transitionRate, 0)} / ${up(s.retentionRate, 0)}`} />
        <MetricTile label={uiText("Single-bar runs")} value={up(s.singleBarRunRate, 0)} />
        <MetricTile label={uiText("Median Q margin")} value={fn(s.medianActionMargin, 4)} note={uiText("uncalibrated linear score, not a probability")} />
        <MetricTile label={uiText("Q ties")} value={up(s.tieRate, 1)} />
        <MetricTile label={uiText("Evidence coverage")} value={`${s.decisions ?? '—'} decisions`} note={uiTemplate("{0} trial paths", [s.trialPaths ?? '—'])} />
      </dl>
      <div className="cols">
        <div>
          <h3 className="h-small">{uiText("Action sleeves")}</h3>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Action")}</th><th scope="col" className="r">{uiText("Use")}</th><th scope="col" className="r">{uiText("Run")}</th><th scope="col" className="r">{uiText("Q margin")}</th><th scope="col" className="r">{uiText("Reward")}</th><th scope="col" className="r">{uiText("Turnover")}</th></tr></thead>
              <tbody>
                {byAction.map((x) => (
                  <tr key={x.action}>
                    <th scope="row"><span className="rl-th"><ActionSwatch index={Math.max(0, actions.indexOf(x.action))} />{x.action}</span></th>
                    <td className="r">{up(x.frequency, 1)}</td>
                    <td className="r">{fn(x.meanActionRunLength, 2)}</td>
                    <td className="r">{fn(x.meanActionMargin, 4)}</td>
                    <td className="r">{sn(x.meanReward, 4)}</td>
                    <td className="r">{fn(x.meanOneWayTurnover, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="h-small">{uiText("Dominant margin drivers")}</h3>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Feature")}</th><th scope="col" className="r">{uiText("Dominant")}</th><th scope="col" className="r">{uiText("Mean |contribution|")}</th><th scope="col" className="r">{uiText("Mean signed")}</th></tr></thead>
              <tbody>
                {features.slice(0, 8).map((x) => (
                  <tr key={x.feature}><th scope="row">{x.feature}</th><td className="r">{up(x.dominantRate, 0)}</td><td className="r">{fn(x.meanAbsoluteMarginContribution, 4)}</td><td className="r">{sn(x.meanSignedMarginContribution, 4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        <h3 className="h-small">{uiText("Representative low and high margin decisions")}</h3>
        {reps.length ? (
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Kind")}</th><th scope="col">{uiText("Trial")}</th><th scope="col">{uiText("Date")}</th><th scope="col">{uiText("Chose over runner-up")}</th><th scope="col" className="r">{uiText("Q margin")}</th><th scope="col">{uiText("Dominant feature")}</th><th scope="col" className="r">{uiText("Realized reward")}</th></tr></thead>
              <tbody>
                {reps.map(({ d, k }) => (
                  <tr key={`${d.fold}${d.seed}${d.timestamp}`}>
                    <td>{k}</td><td>{label(d)}</td><td className="mono">{day(d.timestamp)}</td>
                    <td>{d.selectedAction}{uiText(" over ")}{d.runnerUpAction}</td>
                    <td className="r">{fn(d.actionMargin, 4)}</td>
                    <td>{d.dominantMarginFeature ?? '—'} · {sn(d.dominantMarginContribution, 4)}</td>
                    <td className="r">{sn(d.reward, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NA why={`no representative ${split} decision is published`} />
        )}
      </div>
      <p className="small muted">{uiText("Q margins are uncalibrated linear-model scores, not probabilities or confidence. Feature contributions exactly decompose the chosen-minus-runner-up margin but are not causal importance. Realized rewards are descriptive and conditioned on the policy&apos;s own actions.")}{s.reconciliation ? uiTemplate("Server reconciliation {0}.", [s.reconciliation.passed ? 'passed' : 'FAILED']) : ''}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- opportunity */

export function RlOpportunity({ r, split }: { r: RlDiagnostics; split: Split }) {
  const o = r.factorOpportunity
  if (!o?.available) return <Legacy>{uiText("this Run did not record same-pretrade one-step factor opportunity evidence (legacy).")}</Legacy>
  const s = o[split]
  if (!s) return <NA why={`factorOpportunity.${split} is not in the payload`} />
  const actions = r.protocol?.actions ?? []
  const byAction = [...(s.byAction ?? [])].sort((x, y) => (y.oracleFrequency ?? 0) - (x.oracleFrequency ?? 0) || x.action.localeCompare(y.action))
  const decisions = [...(o.representativeDecisions ?? [])].filter((d) => d.split === split).sort((x, y) => (y.realizedRegret ?? 0) - (x.realizedRegret ?? 0) || x.timestamp.localeCompare(y.timestamp)).slice(0, 6)
  const c = s.candidate
  return (
    <div className="vstack">
      <dl className="hm-grid">
        <MetricTile label={uiText("Selected equals local best")} value={up(s.oracleHitRate, 1)} />
        <MetricTile label={uiText("Mean selected rank")} value={`${fn(s.meanSelectedRank, 2)} / ${actions.length || '—'}`} />
        <MetricTile label={uiText("Mean one-step regret")} value={fn(s.meanRealizedRegret, 4)} note={uiTemplate("positive on {0} of decisions", [up(s.positiveRegretRate, 0)])} />
        <MetricTile label={uiText("P90 / max regret")} value={`${fn(s.p90RealizedRegret, 4)} / ${fn(s.maximumRealizedRegret, 4)}`} />
        <MetricTile label={uiText("Candidate locally best")} value={up(c?.oracleFrequency, 1)} note={uiTemplate("captured {0} · missed {1}", [up(c?.oracleCaptureRate, 1), up(c?.missedOpportunityRate, 1)])} />
        <MetricTile label={uiText("Candidate vs balanced")} value={up(c?.winRateVsBalanced, 1)} note={uiTemplate("mean reward delta {0} (vs selected {1})", [sn(c?.meanVsBalancedReward, 4), sn(c?.meanVsSelectedReward, 4)])} />
      </dl>
      <div>
        <h3 className="h-small">{uiText("Selected mix against the ex-post local-best mix")}</h3>
        <div className="tablewrap">
          <table className="tbl">
            <thead><tr><th scope="col">{uiText("Sleeve")}</th><th scope="col" className="r">{uiText("Selected")}</th><th scope="col" className="r">{uiText("Locally best")}</th><th scope="col" className="r">{uiText("Mean reward")}</th><th scope="col" className="r">{uiText("Turnover")}</th><th scope="col" className="r">{uiText("Risk repair")}</th></tr></thead>
            <tbody>
              {byAction.map((x) => (
                <tr key={x.action}>
                  <th scope="row"><span className="rl-th"><ActionSwatch index={Math.max(0, actions.indexOf(x.action))} />{x.action}</span></th>
                  <td className="r">{up(x.selectedFrequency, 1)}</td>
                  <td className="r">{up(x.oracleFrequency, 1)}</td>
                  <td className="r">{sn(x.meanLocalReward, 4)}</td>
                  <td className="r">{fn(x.meanOneWayTurnover, 2)}</td>
                  <td className="r">{up(x.riskRepairRate, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="h-small">{uiText("Largest realized one-step opportunity gaps")}</h3>
        {decisions.length ? (
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">{uiText("Trial")}</th><th scope="col">{uiText("Date")}</th><th scope="col">{uiText("Selected, then local best")}</th><th scope="col" className="r">{uiText("Rank")}</th><th scope="col" className="r">{uiText("Selected / best reward")}</th><th scope="col" className="r">{uiText("Regret")}</th><th scope="col" className="r">{uiText("Candidate vs selected / balanced")}</th></tr></thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={`${d.fold}${d.seed}${d.timestamp}`}>
                    <td>{label(d)}</td><td className="mono">{day(d.timestamp)}</td>
                    <td>{d.selectedAction}{uiText(" then ")}{d.oracleAction}</td>
                    <td className="r">{d.selectedRank ?? '—'}</td>
                    <td className="r">{sn(d.selectedReward, 4)} / {sn(d.oracleReward, 4)}</td>
                    <td className="r">{fn(d.realizedRegret, 4)}</td>
                    <td className="r">{sn(d.candidateMinusSelectedReward, 4)} / {sn(d.candidateMinusBalancedReward, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NA why={`no representative ${split} decision is published`} />
        )}
      </div>
      <p className="small muted">{uiText("Each alternative starts from the selected policy path&apos;s exact actual pretrade book, uses the same target, no-trade, volatility-risk, cost and next-bar reward primitives, then stops. &ldquo;Local best&rdquo; is an ex-post audit upper bound, not an achievable policy.")}{s.reconciliation ? uiTemplate("Server reconciliation {0}.", [s.reconciliation.passed ? 'passed' : 'FAILED']) : ''}
      </p>
    </div>
  )
}
