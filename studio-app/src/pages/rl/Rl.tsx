import { uiTemplate, uiText, uiValue } from '../../i18n'
import { useState, type ReactNode } from 'react'
import type { ProjectSnapshot } from '../../api'
import { Info } from '../../components/Info'
import { MetricTile } from '../../components/MetricTile'
import { HeroLine, HeroTiles, type HeroTile } from '../hero'
import { VerdictBand, type Reason, type Verdict } from '../../components/VerdictBand'
import { Section, SectionNav } from '../../design/layout'
import { routeHref } from '../../route'
import { Block, day, finite, fn, Kv, NA, SplitToggle, sn, sp, up } from '../portfolio/pfmt'
import { ActionBars, ActionSwatch, baselineLabel, TrainingChart, TrialChart } from './RlCharts'
import { RlBehavior, RlFusion, RlIncremental, RlOpportunity } from './RlBlocks'
import type { RlDiagnostics } from './rlTypes'
import '../portfolio/portfolio.css'
import './rl.css'
import { Empty } from '../../components/States'

type Split = 'validation' | 'test'
const words = (s: string | undefined | null) => (s ? s.replaceAll('-', ' ').replaceAll('_', ' ') : '—')
const label = (t: { fold: string; seed: number }) => `${t.fold.replace('fold-', 'F')} · s${t.seed}`

/** The server's own boolean: did RL add value over the best validation baseline? Nothing else decides the word. */
function verdictOf(r: RlDiagnostics): { verdict: Verdict; word: string } {
  const v = r.summary?.rlAddedValidationValue
  if (v === true) return { verdict: 'pass', word: uiText("Value added") }
  if (v === false) return { verdict: 'fail', word: uiText("No value added") }
  return { verdict: 'inconclusive', word: uiText("Unavailable") }
}

function Tiles({ r, split }: { r: RlDiagnostics; split: Split }) {
  const s = r.summary
  if (!s) return <p><NA why="summary is not in the payload" /></p>
  const stat = split === 'validation' ? s.validation : s.testAudit
  const fusion = r.factorFusion
  const diag = r.factorFusionDiagnosis?.available ? (split === 'validation' ? r.factorFusionDiagnosis.validation : r.factorFusionDiagnosis.testAudit) : undefined
  const opp = r.factorOpportunity?.available ? r.factorOpportunity[split] : undefined
  const stab = s.withinFoldSeedStability
  const adv = split === 'validation' ? s.meanValidationAdvantageVsBestBaseline : s.meanTestAdvantageVsValidationSelectedBaseline
  const advC = split === 'validation' ? fusion?.meanValidationAdvantageVsCandidateFactor : fusion?.meanTestAdvantageVsCandidateFactor
  const candUse = diag?.candidateFactor?.selectedFrequency ?? (split === 'validation' ? fusion?.meanValidationCandidateActionFrequency : undefined)
  return (
    <dl className="hm-grid">
      <MetricTile label={uiText("RL value-add")} value={sn(adv, 2)} note={uiText("net Sharpe versus the baseline selected on validation, mean over trials")} tone={finite(adv) && adv < 0 ? 'weak' : 'neutral'} toneReason={finite(adv) && adv < 0 ? 'RL trails its baseline' : undefined} />
      <MetricTile label={uiText("Versus candidate factor")} value={fusion?.available ? sn(advC, 2) : '—'} note={fusion?.available ? uiText("net Sharpe versus the content-locked candidate sleeve") : <NA why="factor fusion is not published for this Run" />} />
      <MetricTile label={uiText("Net Sharpe, mean")} value={fn(stat?.mean, 2)} note={uiTemplate("min {0} · max {1} · std {2}", [fn(stat?.minimum, 2), fn(stat?.maximum, 2), fn(stat?.standardDeviation, 2)])} delta={stat?.observations !== undefined ? `${stat.observations} trials` : undefined} />
      <MetricTile label={uiText("Best-action hit rate")} value={opp ? up(opp.oracleHitRate, 1) : '—'} note={opp ? uiTemplate("mean selected rank {0} of {1}", [fn(opp.meanSelectedRank, 2), r.protocol?.actions?.length ?? '—']) : <NA why="same-pretrade opportunity evidence is not published" />} />
      <MetricTile label={uiText("Candidate sleeve used")} value={up(candUse, 1)} note={uiText("share of decisions in the candidate factor")} />
      <MetricTile label={uiText("Failure rate")} value={up(s.failureRate, 1)} note={uiTemplate("{0} declared trials", [s.trialCount ?? '—'])} />
      <MetricTile label={uiText("Mean one-way turnover")} value={split === 'validation' ? fn(s.meanValidationOneWayTurnover, 2) : '—'} note={split === 'validation' ? undefined : <NA why="the summary publishes turnover for validation only" />} />
      <MetricTile label={uiText("Mean cost drag")} value={split === 'validation' ? up(s.meanValidationCostDrag, 2) : '—'} note={split === 'validation' ? uiTemplate("at {0} bps", [fn(r.protocol?.configuration?.costBps, 1)]) : <NA why="the summary publishes cost drag for validation only" />} />
      <MetricTile label={uiText("Seed spread, max std")} value={fn(stab?.maximumStandardDeviation, 2)} note={uiTemplate("{0} of {1} folds with identical actions across seeds", [stab?.exactConsensusFolds ?? '—', stab?.folds ?? '—'])} />
      <MetricTile label={uiText("Seed action mismatch")} value={up(stab?.meanPairwiseActionMismatch, 1)} note={uiTemplate("max {0} pairwise", [up(stab?.maximumPairwiseActionMismatch, 1)])} />
    </dl>
  )
}

function TrialTable({ r, split }: { r: RlDiagnostics; split: Split }) {
  const trials = r.trials ?? []
  if (!trials.length) return <NA why="trials is empty in the payload" />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">{uiText("Every declared fold and seed, ")}{split}{uiText(". Advantage is RL net Sharpe minus the baseline selected for that fold on validation.")}</caption>
        <thead>
          <tr>
            <th scope="col">{uiText("Trial")}</th>
            <th scope="col">{uiText("Status")}</th>
            <th scope="col">{uiText("Selected baseline")}</th>
            <th scope="col" className="r">{uiText("Net Sharpe")}</th>
            <th scope="col" className="r">{uiText("Advantage")}</th>
            <th scope="col" className="r">{uiText("Vs candidate")}</th>
            <th scope="col" className="r">{uiText("Net return")}</th>
            <th scope="col" className="r">{uiText("Max drawdown")}</th>
            <th scope="col" className="r">{uiText("Turnover")}</th>
            <th scope="col" className="r">{uiText("Cost drag")}</th>
            <th scope="col" className="r">{uiText("Max exec. vol")}</th>
            <th scope="col" className="r">{uiText("Risk breaches")}</th>
          </tr>
        </thead>
        <tbody>
          {trials.map((t) => {
            const e = t[split]
            const adv = split === 'validation' ? t.validationAdvantage : t.testAdvantage
            const advC = split === 'validation' ? t.validationAdvantageVsCandidateFactor : t.testAdvantageVsCandidateFactor
            return (
              <tr key={`${t.fold}${t.seed}`}>
                <th scope="row">{label(t)}</th>
                <td>{t.status ?? '—'}</td>
                <td className="muted">{baselineLabel(t.selectedBaseline)}</td>
                <td className="r">{fn(e?.netSharpe, 2)}</td>
                <td className="r">{sn(adv, 2)} <span className="faint small">{finite(adv) ? (adv >= 0 ? 'above' : 'below') : ''}</span></td>
                <td className="r">{sn(advC, 2)}</td>
                <td className="r">{sp(e?.netTotalReturn, 1)}</td>
                <td className="r">{sp(e?.maximumDrawdown, 1)}</td>
                <td className="r">{fn(e?.meanOneWayTurnover, 2)}</td>
                <td className="r">{up(e?.totalCostDrag, 2)}</td>
                <td className="r">{up(e?.executionRisk?.maximumExecutedForecastAnnualized, 1)}</td>
                <td className="r">{e?.executionRisk?.available ? e.executionRisk.executedBreachDates ?? '—' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BaselineMatrix({ r, split }: { r: RlDiagnostics; split: Split }) {
  const rows = r.baselines ?? []
  if (!rows.length) return <NA why="baselines is empty in the payload" />
  const names = [...new Set(rows.map((b) => b.name))]
  const folds = [...new Set(rows.map((b) => b.fold))]
  const cell = (name: string, fold: string) => rows.find((b) => b.name === name && b.fold === fold)
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">{uiText("Net Sharpe of every declared comparator in each fold, ")}{split}{uiText(". The bold marked cell is the baseline the fixed Judge selected on validation. Each fold is shown on its own; no average across folds is computed here.")}</caption>
        <thead>
          <tr>
            <th scope="col">{uiText("Comparator")}</th>
            {folds.map((f) => <th scope="col" className="r" key={f}>{f}</th>)}
          </tr>
        </thead>
        <tbody>
          {names.map((n) => (
            <tr key={n}>
              <th scope="row">{baselineLabel(n)}</th>
              {folds.map((f) => {
                const c = cell(n, f)
                return (
                  <td className={`r${c?.selectedOnValidation ? ' rl-sel' : ''}`} key={f}>
                    {c ? fn(c[split]?.netSharpe, 2) : '—'}
                    {c?.selectedOnValidation && <span className="badge">{uiText("selected")}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionDetail({ r, split }: { r: RlDiagnostics; split: Split }) {
  const rows = (r.actionSummaries ?? []).filter((a) => a.split === split)
  const actions = r.protocol?.actions ?? []
  if (!rows.length) return <NA why={`actionSummaries has no ${split} rows`} />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">{uiText("Action use, implementation and execution risk for every trial, ")}{split}.</caption>
        <thead>
          <tr>
            <th scope="col">{uiText("Trial")}</th>
            <th scope="col" className="r">{uiText("Decisions")}</th>
            {actions.map((a, k) => (
              <th scope="col" className="r" key={a}><span className="rl-th"><ActionSwatch index={k} />{a}</span></th>
            ))}
            <th scope="col" className="r">{uiText("Transitions")}</th>
            <th scope="col" className="r">{uiText("Turnover")}</th>
            <th scope="col" className="r">{uiText("Cost drag")}</th>
            <th scope="col" className="r">{uiText("Risk breaches")}</th>
            <th scope="col" className="r">{uiText("Risk-only overrides")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={`${a.fold}${a.seed}`}>
              <th scope="row">{label(a)}</th>
              <td className="r">{a.observations ?? '—'}</td>
              {actions.map((k) => <td className="r" key={k}>{up(a.actionFrequency?.[k], 1)}</td>)}
              <td className="r">{a.actionTransitions ?? '—'}</td>
              <td className="r">{fn(a.meanOneWayTurnover, 2)}</td>
              <td className="r">{up(a.totalCostDrag, 2)}</td>
              <td className="r">{a.executionRisk?.available ? a.executionRisk.executedBreachDates ?? '—' : uiText("legacy")}</td>
              <td className="r">{a.executionRisk?.available ? a.executionRisk.riskRebalanceOverrideDates ?? '—' : uiText("legacy")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RlPage({ project }: { project: ProjectSnapshot }) {
  const r = project.rlExplorer as RlDiagnostics | null
  const [split, setSplit] = useState<Split>('validation')
  const back = routeHref({ view: 'project', id: project.id })
  if (!r) {
    return (
      <div className="pg rl">
        <header className="pg-head">
          <h1>{uiText("Governed RL policy")}</h1>
          <p className="muted small">{uiText("Project ")}<a href={back}>{project.name}</a>{uiText(". A learned policy mixing fixed factor sleeves under a locked mandate; no trading authority.")}</p>
        </header>
        <Empty title={uiText("No evidence in this Project")}>
          <p>{uiText("This Project has no Governed RL Run, so there are no fold and seed trials, baselines, training history or action audit to draw. Nothing is estimated in its place.")}</p>
          <p className="small"><a href={back}>{uiText("Back to the Project")}</a></p>
        </Empty>
      </div>
    )
  }

  // Visibility rule: a test number is drawn only when the protocol calls test a visible diagnostic AND the server published the test audit.
  const testVisible = r.protocol?.testRole === 'visible-diagnostic' && !!r.summary?.testAudit
  const eff: Split = testVisible ? split : 'validation'
  const toggle = <SplitToggle value={eff} onChange={setSplit} testVisible={testVisible} />
  const { verdict, word } = verdictOf(r)
  const s = r.summary
  const d = r.factorFusionDiagnosis
  const stab = s?.withinFoldSeedStability
  const folds = r.protocol?.folds ?? [...new Set((r.trials ?? []).map((t) => t.fold))]
  const actions = r.protocol?.actions ?? []
  const lc = r.protocol?.configuration?.learningContract

  const reasons: Reason[] = []
  reasons.push(
    d?.available && d.diagnosis
      ? { tone: verdict === 'fail' ? 'bad' : 'info', text: d.diagnosis.explanation ?? words(d.diagnosis.stage), field: `factorFusionDiagnosis.diagnosis.stage = ${d.diagnosis.stage}` }
      : { tone: 'info', text: <NA why={d?.reason ?? 'factorFusionDiagnosis is not published for this Run, so there is no stage diagnosis'} />, field: 'factorFusionDiagnosis' },
  )
  if (finite(s?.meanValidationAdvantageVsBestBaseline)) {
    reasons.push({
      tone: s.meanValidationAdvantageVsBestBaseline < 0 ? 'bad' : 'info',
      text: uiTemplate("Mean validation net Sharpe advantage over the baseline selected on validation: {0} (the objective asks for at least {1}).", [sn(s.meanValidationAdvantageVsBestBaseline, 2), fn(r.run?.objective?.minimumImprovement, 2)]),
      field: 'summary.meanValidationAdvantageVsBestBaseline',
    })
  }
  if (r.factorFusion?.available && r.factorFusion.rlBeatCandidateOnValidation !== undefined) {
    reasons.push({
      tone: 'info',
      text: r.factorFusion.rlBeatCandidateOnValidation ? 'RL beat the content-locked candidate factor on validation.' : 'RL did not beat the content-locked candidate factor on validation.',
      field: 'factorFusion.rlBeatCandidateOnValidation',
    })
  }
  if (stab) {
    reasons.push({
      tone: 'info',
      text: uiTemplate("Seed stability: {0} of {1} folds reach identical actions across seeds; the largest within-fold Sharpe spread is {2}.", [stab.exactConsensusFolds ?? '—', stab.folds ?? '—', fn(stab.maximumStandardDeviation, 2)]),
      field: 'summary.withinFoldSeedStability',
    })
  }

  const trials = r.trials ?? []
  const barRows = (r.actionSummaries ?? []).filter((a) => a.split === eff).map((a) => ({ key: `${a.fold}${a.seed}`, name: label(a), freq: a.actionFrequency }))
  const execRisk = r.executedBookRisk?.available ? r.executedBookRisk[eff] : undefined
  const mand = r.portfolioMandate

  const advV = s?.meanValidationAdvantageVsBestBaseline
  const statE = eff === 'validation' ? s?.validation : s?.testAudit
  const advE = eff === 'validation' ? advV : s?.meanTestAdvantageVsValidationSelectedBaseline
  const fusionE = r.factorFusion
  const advCandE = eff === 'validation' ? fusionE?.meanValidationAdvantageVsCandidateFactor : fusionE?.meanTestAdvantageVsCandidateFactor
  const stabE = s?.withinFoldSeedStability
  const tiles: HeroTile[] = [
    { label: uiText("RL value-add"), value: sn(advE, 2), note: finite(advE) && advE < 0 ? 'Weak: trails its baseline' : 'vs validation-selected baseline' },
    { label: uiText("Versus candidate factor"), value: fusionE?.available ? sn(advCandE, 2) : '—', note: fusionE?.available ? 'net Sharpe vs candidate sleeve' : 'fusion not published' },
    { label: uiText("Net Sharpe, mean"), value: fn(statE?.mean, 2), note: uiTemplate("{0} trials · std {1}", [statE?.observations ?? s?.trialCount ?? '—', fn(statE?.standardDeviation, 2)]) },
    { label: uiText("Failure rate"), value: up(s?.failureRate, 1), note: uiTemplate("{0} declared trials", [s?.trialCount ?? '—']) },
    { label: uiText("Mean cost drag"), value: eff === 'validation' ? up(s?.meanValidationCostDrag, 2) : '—', note: eff === 'validation' ? `at ${fn(r.protocol?.configuration?.costBps, 1)} bps` : 'validation only' },
    { label: uiText("Seed spread, max std"), value: fn(stabE?.maximumStandardDeviation, 2), note: uiTemplate("{0} of {1} folds agree", [stabE?.exactConsensusFolds ?? '—', stabE?.folds ?? '—']) },
  ]
  const headText = finite(advV)
    ? `mean validation net Sharpe ${advV < 0 ? 'below' : 'above'} the best baseline by ${fn(Math.abs(advV), 2)} (objective asks for at least ${fn(r.run?.objective?.minimumImprovement, 2)})`
    : 'no validation advantage over the baseline is published for this Run'

  return (
    <div className="pg rl">
      <header className="pg-head">
        <h1>{uiText("Governed RL policy")}</h1>
        <p className="muted small">{uiText("Project ")}<a href={back}>{project.name}</a>{uiText(" · Run ")}<span className="mono">{r.run?.id?.replace(/^run-/, '') ?? '—'}</span>{uiText(" · study ")}<span className="mono">{r.run?.studyId ?? '—'}</span>
          <Info label={uiText("About this page")}>
            <p>{uiText("A Q-learning policy that mixes fixed factor sleeves under a locked mandate. Research diagnostics; no trading authority. Selection uses the ")}{r.protocol?.selectionSplit ?? uiText("validation")}{uiText(" split only. Test is ")}<span className="mono">{r.protocol?.testRole ?? '—'}</span>
              {r.protocol?.testEntersSelection === false ? uiText(" and never enters selection") : ''}.
              {!testVisible && uiText(" No test audit is published for this Run, so no test number is drawn on this page.")}
            </p>
          </Info>
        </p>
      </header>

      <SectionNav
        items={[
          { id: 'rl-summary', label: uiText("Verdict and metrics") },
          { id: 'rl-baselines', label: uiText("Baselines") },
          { id: 'rl-training', label: uiText("Training") },
          { id: 'rl-actions', label: uiText("Actions") },
          { id: 'rl-fusion', label: uiText("Fusion diagnosis") },
          { id: 'rl-incremental', label: uiText("Attribution") },
          { id: 'rl-behavior', label: uiText("Behavior") },
          { id: 'rl-opportunity', label: uiText("Opportunity") },
          { id: 'rl-mandate', label: uiText("Mandate and protocol") },
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone={verdict === 'fail' ? 'bad' : verdict === 'pass' ? 'ok' : 'warn'}
          word={word}
          why={
            <Info label={uiText("Why this verdict")}>
              <p>{uiText("Read from ")}<span className="mono">{uiText("summary.rlAddedValidationValue")}</span>{uiText(" only. ")}{r.run?.summary ? <>{r.run.summary.replace(/\.$/, '')}. </> : null}{uiText("Test is a visible audit and never enters promotion.")}</p>
            </Info>
          }
        >
          {headText}
        </HeroLine>

        <section aria-labelledby="rl-trials" className="pf-hero-chart">
          <div className="pf-hero-head">
            <h2 id="rl-trials">{uiText("RL against the selected baseline")}</h2>
            {toggle}
          </div>
          {trials.length ? <TrialChart trials={trials} baselines={r.baselines ?? []} folds={folds} split={eff} /> : <NA why="trials is empty in the payload" />}
        </section>

        <HeroTiles items={tiles} label={uiTemplate("Core numbers, {0} split", [eff])} />
      </div>

      <div className="band">
        <Section title={uiText("Verdict and metrics")} id="rl-summary" caption={uiTemplate("{0} fold/seed trials over {1} folds; {2}.", [s?.trialCount ?? '—', folds.length, lc ? 'train-only frozen learner' : 'legacy learner'])}>
          <div className="vstack">
            <VerdictBand
              id="rl-verdict-word"
              kicker="Verdict · validation split · RL value-add"
              verdict={verdict}
              word={word}
              detail={<>{uiText("Objective ")}{words(r.run?.objective?.metric)}.</>}
              reasons={reasons}
            />
            <details className="pf-allmetrics">
              <summary>{uiText("All ")}{eff}{uiText(" metrics")}</summary>
              <Tiles r={r} split={eff} />
            </details>
            {testVisible && eff === 'test' && (
              <p className="small muted">{uiText("Test is a visible audit.")}<Info label={uiText("About the test split")}>
                  <p>{uiText("Test is a visible audit. It did not enter selection, and looking at it more than once spends the held-out evidence.")}</p>
                </Info>
              </p>
            )}
            <TrialTable r={r} split={eff} />
          </div>
        </Section>
      </div>

      <Section title={uiText("Comparators")} id="rl-baselines" caption={uiText("All fixed comparators, fold by fold.")}>
        <div className="vstack">
          <div className="rl-bar-row">{toggle}</div>
          <BaselineMatrix r={r} split={eff} />
        </div>
      </Section>

      <Section title={uiText("Training behavior")} id="rl-training" caption={uiText("Fixed-budget training history; descriptive only.")}>
        <TrainingChart rows={r.training ?? []} trials={trials} episodes={r.protocol?.episodes ?? 0} contextual={r.contextualBaselines ?? []} />
      </Section>

      <Section title={uiText("Factor-sleeve allocation")} id="rl-actions" caption={uiText("Decision split across the fixed sleeves.")}>
        <div className="vstack">
          <div className="rl-bar-row">{toggle}</div>
          {barRows.length ? <ActionBars rows={barRows} actions={actions} /> : <NA why={`actionSummaries has no ${eff} rows`} />}
          <ActionDetail r={r} split={eff} />
          {r.actionPath?.transitions?.length ? (
            <details className="datatable">
              <summary>{uiText("Action transitions on the sampled path (")}{r.actionPath.sampledRows ?? '—'}{uiText(" of ")}{r.actionPath.totalRows ?? '—'}{uiText(" rows, all splits)")}</summary>
              <div className="tablewrap">
                <table className="tbl">
                  <thead><tr><th scope="col">{uiText("From")}</th><th scope="col">{uiText("To")}</th><th scope="col" className="r">{uiText("Count")}</th></tr></thead>
                  <tbody>
                    {[...r.actionPath.transitions].sort((a, b) => b.count - a.count).map((t) => (
                      <tr key={`${t.from}${t.to}`}><td>{t.from}</td><td>{t.to}</td><td className="r">{t.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
          <p className="small muted">{uiText("Actions select the candidate factor, reference factors or a governed blend.")}<Info label={uiText("About actions")}>
              <p>{uiText("Actions select the content-locked candidate factor, fixed reference factors or their governed blend. Final post-drift books are risk-checked before reward. All values are historical research evidence, not orders or account positions.")}</p>
            </Info>
          </p>
        </div>
      </Section>

      <Section title={uiText("Factor-fusion diagnosis")} id="rl-fusion" caption={uiText("Where adaptive value stops.")}>
        <RlFusion r={r} testVisible={testVisible} />
      </Section>

      <Section title={uiText("Incremental attribution")} id="rl-incremental" caption={uiText("Full-path RL minus the selected baseline.")}>
        <div className="vstack">
          <div className="rl-bar-row">{toggle}</div>
          <RlIncremental r={r} split={eff} />
        </div>
      </Section>

      <Section title={uiText("Policy behavior")} id="rl-behavior" fold caption={uiText("Action runs, Q margins and the features behind them.")}>
        <div className="vstack">
          <div className="rl-bar-row">{toggle}</div>
          <RlBehavior r={r} split={eff} />
        </div>
      </Section>

      <Section title={uiText("Factor opportunity")} id="rl-opportunity" fold caption={uiText("Same-pretrade one-step audit of every sleeve against the selected one.")}>
        <div className="vstack">
          <div className="rl-bar-row">{toggle}</div>
          <RlOpportunity r={r} split={eff} />
        </div>
      </Section>

      <Section title={uiText("Mandate and protocol")} id="rl-mandate" fold caption={uiText("The locked portfolio mandate, executed-book risk, learning contract and fold ranges.")}>
        <div className="vstack">
          <div className="cols">
            <Block title={uiText("Locked mandate")}>
              {mand ? (
                <Kv
                  rows={[
                    ['Direction / construction', `${words(mand.direction)} · ${words(mand.family)}`],
                    ['Tradable assets', mand.tradableAssets?.join(', ') || '—'],
                    ['Context-only assets', mand.contextAssets?.length ? mand.contextAssets.join(', ') : 'none'],
                    ['Gross limit / default cap', `${fn(mand.grossLimit, 2)} / ${up(mand.maxAbsWeight, 1)}`],
                    ['Side limits', finite(mand.longGrossLimit) && finite(mand.shortGrossLimit) ? `long ${fn(mand.longGrossLimit, 2)} · short ${fn(mand.shortGrossLimit, 2)}` : 'legacy'],
                    ['Risk ceiling', mand.riskPolicy ? `${up(mand.riskPolicy.annualizedVolatilityCeiling, 1)} · ${mand.riskPolicy.scaleUp ? 'scale up allowed' : 'scale-down only'}` : 'legacy · none'],
                    ['Cost / band / NAV', mand.implementationPolicy ? `${fn(mand.implementationPolicy.baseCostBps, 1)} bps · ${up(mand.implementationPolicy.noTradeOneWay, 1)} band · NAV ${finite(mand.implementationPolicy.referenceNav) ? mand.implementationPolicy.referenceNav.toLocaleString('en-US') : '—'}` : 'legacy defaults'],
                    ['Decision cadence', r.decisionCadence ? `${words(r.decisionCadence.kind)} · ${r.decisionCadence.bars ?? '—'} bar(s) · ${up(r.decisionCadence.eligibleRate, 0)} eligible` : '—'],
                    ['Benchmark', `${words(mand.benchmark?.kind)}${mand.benchmark?.asset ? ` (${mand.benchmark.asset})` : ''} · evaluation only`],
                    ['Mandate', `${mand.available ? 'locked' : 'legacy implicit'} ${mand.id ? `· ${mand.id.slice(-8)}` : ''}`],
                  ]}
                />
              ) : (
                <NA why="portfolioMandate is not in the payload" />
              )}
            </Block>
            <Block title={uiText("Executed-book risk")}>
              {execRisk ? (
                <Kv
                  rows={[
                    ['Active dates', String(execRisk.activeDates ?? '—')],
                    ['Forecast coverage', up(execRisk.forecastCoverage, 0)],
                    ['Pre-trade breach dates', String(execRisk.pretradeBreachDates ?? '—')],
                    ['Executed breach dates', String(execRisk.executedBreachDates ?? '—')],
                    ['Risk-only rebalance overrides', String(execRisk.riskRebalanceOverrideDates ?? '—')],
                    ['Max executed forecast volatility', up(execRisk.maximumExecutedForecastAnnualized, 2)],
                    ['Ceiling', up(r.executedBookRisk?.policy?.riskPolicy?.annualizedVolatilityCeiling, 1)],
                    ['Max constraint error', finite(execRisk.maximumExecutedConstraintError) ? execRisk.maximumExecutedConstraintError.toExponential(2) : '—'],
                  ]}
                />
              ) : (
                <NA why={r.executedBookRisk?.available === false ? 'this Run predates executed-book risk checks (legacy)' : 'executedBookRisk is not in the payload'} />
              )}
            </Block>
          </div>
          <div className="cols">
            <Block title={uiText("Learning contract")}>
              <Kv
                rows={[
                  ['Method', lc?.method ?? 'legacy learner'],
                  ['Candidate configurations', String(lc?.candidate_configurations ?? '—')],
                  ['Development scope', lc?.development_selection_scope ?? '—'],
                  ['Validation role', words(lc?.validation_role)],
                  ['Test role', words(lc?.test_role ?? r.protocol?.testRole)],
                  ['Episodes / learning rate / discount', `${r.protocol?.episodes ?? '—'} / ${fn(r.protocol?.configuration?.learningRate, 3)} / ${fn(r.protocol?.configuration?.discount, 2)}`],
                  ['Exploration (start to end)', `${fn(r.protocol?.configuration?.epsilonStart, 2)} to ${fn(r.protocol?.configuration?.epsilonEnd, 2)}`],
                  ['Cost assumption', `${fn(r.protocol?.configuration?.costBps, 1)} bps`],
                  ['Seeds', r.protocol?.seeds?.join(', ') ?? '—'],
                ]}
              />
            </Block>
            <Block title={uiText("Fold ranges")}>
              {r.protocol?.ranges ? (
                <div className="tablewrap">
                  <table className="tbl">
                    <thead><tr><th scope="col">{uiText("Fold")}</th><th scope="col">{uiText("Split")}</th><th scope="col">{uiText("Range")}</th><th scope="col" className="r">{uiText("Rows")}</th></tr></thead>
                    <tbody>
                      {Object.entries(r.protocol.ranges).flatMap(([fold, parts]) =>
                        (['train', 'validation', 'test'] as const)
                          .filter((k) => parts[k] && (k !== 'test' || testVisible))
                          .map((k) => (
                            <tr key={fold + k}>
                              <th scope="row">{fold}</th>
                              <td>{k} · {parts[k].role ?? ''}</td>
                              <td className="mono">{day(parts[k].start)}{uiText(" to ")}{day(parts[k].end)}</td>
                              <td className="r">{parts[k].observations ?? '—'}</td>
                            </tr>
                          )),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <NA why="protocol.ranges is not in the payload" />
              )}
            </Block>
          </div>
          {r.protocol?.semantics && (
            <details className="datatable">
              <summary>{uiText("Protocol semantics, as written by the Run")}</summary>
              <Kv rows={Object.entries(r.protocol.semantics).map(([k, v]): [string, ReactNode] => [words(k.replace(/([A-Z])/g, ' $1').toLowerCase()), v])} />
            </details>
          )}
          {r.warning && <p className="small muted">{uiValue(r.warning)}</p>}
        </div>
      </Section>
    </div>
  )
}
