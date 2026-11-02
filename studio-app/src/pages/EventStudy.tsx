import { uiTemplate, uiText, uiValue } from '../i18n'
import type { ReactNode } from 'react'
import type {
  EnvelopeDistribution,
  EnvelopeOutcome,
  EnvelopeRate,
  EnvelopeStability,
  EventStudyDiagnostics,
  EventStudyEvent,
  ProjectSnapshot,
} from '../api'
import { Glyph } from '../design/icons'
import { pct, plural, ret } from '../format'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { Info } from '../components/Info'
import { HeroLine, HeroTiles } from './hero'
import './eventStudy.css'

const GUARD_LABEL: Record<EnvelopeRate['guard'], string> = {
  ok: 'Sample sufficient',
  'small-sample': 'Small sample',
  withheld: 'Estimate withheld',
}

const CONCLUSION: Record<string, { word: string; signal: boolean }> = {
  'insufficient-events': { get word() { return uiText("Insufficient events") }, signal: true },
  'observed-advantage': { get word() { return uiText("Observed advantage") }, signal: false },
  'no-observed-advantage': { get word() { return uiText("No observed advantage") }, signal: false },
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

/** N is always printed; a withheld rate shows its counts and says why there is no percentage. */
function RateLine({ rate }: { rate: EnvelopeRate }) {
  if (rate.estimate === null || rate.ci95 === null) {
    return (
      <span className="mono">
        N={rate.n} · {rate.successes} {rate.successes === 1 ? uiText("hit") : uiText("hits")}{uiText(" · no estimate below the minimum sample")}</span>
    )
  }
  return (
    <span className="mono">
      {pct(rate.estimate)} · N={rate.n} · {rate.successes}{uiText(" hits · 95% CI ")}{pct(rate.ci95[0])}–{pct(rate.ci95[1])}
    </span>
  )
}

/** The 95% Wilson interval on a 0–100% track, with the point estimate marked. */
function IntervalBar({ rate, label }: { rate: EnvelopeRate; label: string }) {
  if (rate.estimate === null || rate.ci95 === null) {
    return <div className="ibar is-empty" role="img" aria-label={uiTemplate("{0}: no interval, N={1}", [label, rate.n])} />
  }
  const [low, high] = rate.ci95
  return (
    <div
      className="ibar"
      role="img"
      aria-label={uiTemplate("{0}: {1} with 95% interval {2} to {3}, N={4}", [label, pct(rate.estimate), pct(low), pct(high), rate.n])}
    >
      <span className="ibar-half" />
      <span className="ibar-range" style={{ left: `${low * 100}%`, width: `${Math.max((high - low) * 100, 0.5)}%` }} />
      <span className="ibar-point" style={{ left: `${rate.estimate * 100}%` }} />
    </div>
  )
}

function Stability({ value }: { value: EnvelopeStability }) {
  const verdict =
    value.agree === null ? 'Not assessed' : value.agree ? 'Halves agree' : 'Halves differ'
  return (
    <div className="half-split">
      {([
        ['First half', value.firstHalf],
        ['Second half', value.secondHalf],
      ] as const).map(([name, rate]) => (
        <div key={name} className="half">
          <span className="faint small">{name}</span>
          <RateLine rate={rate} />
          <IntervalBar rate={rate} label={name} />
        </div>
      ))}
      <p className={value.agree === false ? 'sig small' : 'muted small'}>
        {uiValue(verdict)}
        {value.agree === null && uiText(" · a half has too few events for an interval")}
        {value.agree === false && uiText(" · the rate is not stable across time")}
      </p>
    </div>
  )
}

function OutcomeCard({ title, outcome }: { title: string; outcome: EnvelopeOutcome }) {
  return (
    <article className="ocard" aria-label={title}>
      <header>
        <h3>{title}</h3>
        <span className={outcome.guard === 'ok' ? 'badge' : 'badge is-warn'}>{GUARD_LABEL[outcome.guard]}</span>
      </header>
      <p className="big mono">{outcome.estimate === null ? '—' : pct(outcome.estimate)}</p>
      <p>
        <RateLine rate={outcome} />
      </p>
      <IntervalBar rate={outcome} label={title} />
      <h4>{uiText("Stability")}</h4>
      <Stability value={outcome.stability} />
      <h4>{uiText("Per year")}</h4>
      {outcome.perYear.length === 0 ? (
        <p className="muted small">{uiText("No primary events.")}</p>
      ) : (
        <ul className="chips">
          {outcome.perYear.map((year) => (
            <li key={year.year} className="chip">
              <span className="mono">{year.year}</span>
              <span className="mono">
                {year.successes}/{year.n}
              </span>
              <span className="faint mono small">{year.estimate === null ? 'n<10' : pct(year.estimate, 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Distribution({ title, value }: { title: string; value: EnvelopeDistribution }) {
  const keys = ['p10', 'p25', 'p50', 'p75', 'p90'] as const
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="r">N</th>
            <th scope="col" className="r">{uiText("Min")}</th>
            {keys.map((key) => (
              <th key={key} scope="col" className="r">{key.toUpperCase()}</th>
            ))}
            <th scope="col" className="r">{uiText("Max")}</th>
            <th scope="col" className="r">{uiText("Mean")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="r mono">{value.n}</td>
            <td className="r mono">{ret(value.minimum)}</td>
            {keys.map((key) => (
              <td key={key} className="r mono">{ret(value.quantiles[key])}</td>
            ))}
            <td className="r mono">{ret(value.maximum)}</td>
            <td className="r mono">{ret(value.mean)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const OVERLAP_LABEL: Record<string, string> = {
  eligible: 'Primary',
  'overlapping-prior-primary': 'Overlaps earlier event',
  'right-censored': 'Right-censored',
}

function EventRow({ event }: { event: EventStudyEvent }) {
  const label = OVERLAP_LABEL[event.overlapReason] ?? event.overlapReason
  const hit = event.assetReturn !== null && event.assetReturn > 0
  return (
    <tr className={event.primaryEligible ? undefined : 'is-excluded'}>
      <td className="mono r">{event.eventIndex}</td>
      <td className="mono">{event.eventTimestamp.slice(0, 10)}</td>
      <td className="mono r">{ret(event.gapReturn)}</td>
      <td className="mono">{event.entryTimestamp?.slice(0, 10) ?? '—'}</td>
      <td className="mono">{event.exitTimestamp?.slice(0, 10) ?? '—'}</td>
      <td className="mono r">{ret(event.assetReturn)}</td>
      <td className="mono r">{ret(event.referenceReturn)}</td>
      <td className="mono r">{ret(event.excessReturn)}</td>
      <td>
        <span className="state">
          <Glyph kind={event.primaryEligible ? (hit ? 'supported' : 'error') : 'empty'} signal={event.primaryEligible && !hit} />
          <span>{event.primaryEligible ? `${label} · ${hit ? 'hit' : 'miss'}` : label}</span>
        </span>
      </td>
    </tr>
  )
}

function Content({ study, projectId }: { study: EventStudyDiagnostics; projectId: string }) {
  const { envelope, policy, populations, conclusion } = study
  const look = CONCLUSION[conclusion.status] ?? { word: conclusion.status, signal: false }
  const positive = envelope.outcomes.primaryPositiveReturn
  const excess = envelope.outcomes.primaryPositiveExcess
  const unconditional = envelope.unconditionalPositiveReturn
  return (
    <>
      <header className="pg-head">
        <h1>{uiText("Price event study")}</h1>
        <p className="muted small">
          <span translate="no" className="mono">{policy.event.asset}</span>{uiText(" gap ≤ ")}{ret(policy.event.thresholdReturn)}{uiText(", wait ")}{policy.timing.waitBars}{uiText(", hold ")}{policy.timing.holdingBars}{uiText(" bars")}{' · '}
          <a href={routeHref({ view: 'project', id: projectId })}>{uiText("Back to Project")}</a>
          <Info label={uiText("About this study")}>
            <p>
              <span translate="no" className="mono">{policy.event.asset}</span>{uiText(" opening gap ≤ ")}{ret(policy.event.thresholdReturn)}{uiText(", wait")}{' '}
              {policy.timing.waitBars}{uiText(" bars, hold ")}{policy.timing.holdingBars}{uiText(" bars, matched against")}{' '}
              <span translate="no" className="mono">{policy.references.matchedAsset}</span>{uiText(". Rates use the")}{' '}
              {plural(populations.primaryEvents, 'primary non-overlapping event')}{uiText(" of ")}{populations.qualifyingEvents}{uiText(" qualifying.")}</p>
          </Info>
        </p>
      </header>

      <div className="hero-stack">
        <HeroLine
          tone={look.signal ? 'bad' : 'warn'}
          word={look.word}
          why={
            <Info label={uiText("Read every rate with its sample size")}>
              <p>{envelope.disclaimer}</p>
            </Info>
          }
        >
          {conclusion.observedPrimaryEvents}{uiText(" of ")}{conclusion.minimumEvents}{uiText(" minimum primary events")}{positive.estimate !== null ? uiTemplate("; asset return above zero in {0} (N={1})", [pct(positive.estimate), positive.n]) : uiTemplate("; asset-return rate withheld (N={0})", [positive.n])}
        </HeroLine>

        <section className="sec" aria-labelledby="sec-rates">
          <h2 id="sec-rates">{uiText("Outcome rates")}</h2>
          <div className="ocards">
            <OutcomeCard title={uiText("Asset return above zero")} outcome={positive} />
            <OutcomeCard title={uiText("Beats the matched reference")} outcome={excess} />
          </div>
          <p className="muted small">{uiText("Wilson ")}{pct(envelope.confidenceLevel, 0)}{uiText(" intervals; read each with its N.")}<Info label={uiText("About these intervals")}>
              <p>{uiText("Wilson ")}{pct(envelope.confidenceLevel, 0)}{uiText(" intervals. An estimate is withheld below ")}{envelope.guards.withholdBelow}{uiText(" events and flagged below ")}{envelope.guards.warnBelow}{uiText(". Event returns still cluster in volatile regimes, so treat intervals as optimistic.")}</p>
            </Info>
          </p>
        </section>

        <HeroTiles
          label={uiText("Core numbers")}
          items={[
            { label: uiText("Primary events"), value: String(populations.primaryEvents), note: uiTemplate("{0} qualifying", [populations.qualifyingEvents]) },
            { label: uiText("Minimum events"), value: String(conclusion.minimumEvents), note: uiTemplate("{0} observed", [conclusion.observedPrimaryEvents]) },
            { label: uiText("Primary hit rate"), value: pct(positive.estimate), note: `N=${positive.n}` },
            { label: uiText("Unconditional hit rate"), value: pct(unconditional.estimate), note: `N=${unconditional.n}` },
            { label: uiText("Beats reference"), value: pct(excess.estimate), note: `N=${excess.n}` },
            { label: uiText("Right-censored"), value: String(populations.rightCensoredEvents), note: uiTemplate("{0} overlap-excluded", [populations.overlapExcludedEvents]) },
          ]}
        />
      </div>

      <Section title={uiText("Reference")} id="sec-reference">
        <dl className="stats">
          <div>
            <dt>{uiText("Unconditional hit rate, same asset")}</dt>
            <dd className="mono">{pct(unconditional.estimate)}</dd>
            <dd className="faint small mono">N={unconditional.n} · {unconditional.successes}{uiText(" hits · no interval")}</dd>
          </div>
          <div>
            <dt>{uiText("Primary hit rate")}</dt>
            <dd className="mono">{pct(positive.estimate)}</dd>
            <dd className="faint small mono">N={positive.n} · {positive.successes}{uiText(" hits")}</dd>
          </div>
        </dl>
        <p className="muted small">{uiText("Unconditional rate has no interval.")}<Info label={uiText("About the unconditional rate")}>
            <p>{uiText("Unconditional observations overlap by construction (one per entry date across the holding window), so no interval is drawn for them.")}</p>
          </Info>
        </p>
      </Section>

      <Section title={uiText("Return distribution (primary events)")} id="sec-distribution">
        <Distribution title={uiText("Asset return")} value={envelope.returnDistribution} />
        <Distribution title={uiText("Excess over matched reference")} value={envelope.excessDistribution} />
      </Section>

      <Section title={uiText("Events behind every number")} id="sec-events">
        <p className="muted small">
          {populations.qualifyingEvents}{uiText(" qualifying · ")}{populations.completeEvents}{uiText(" complete · ")}{populations.primaryEvents}{uiText(" primary ·")}{' '}
          {populations.overlapExcludedEvents}{uiText(" overlap-excluded · ")}{populations.rightCensoredEvents}{uiText(" right-censored.")}</p>
        {study.events.length === 0 ? (
          <p className="muted">{uiText("No event met the threshold in this dataset.")}</p>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" className="r">#</th>
                  <th scope="col">{uiText("Event date")}</th>
                  <th scope="col" className="r">{uiText("Gap")}</th>
                  <th scope="col">{uiText("Entry")}</th>
                  <th scope="col">{uiText("Exit")}</th>
                  <th scope="col" className="r">{uiText("Asset")}</th>
                  <th scope="col" className="r">{uiText("Reference")}</th>
                  <th scope="col" className="r">{uiText("Excess")}</th>
                  <th scope="col">{uiText("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {study.events.map((event) => (
                  <EventRow key={event.eventIndex} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="muted small">
        {uiValue(study.warning)}{uiText(" Run ")}<span className="mono" translate="no">{study.run.id}</span>{uiText(", dataset ")}{day(study.dataset.timeRange?.start)}{uiText(" to ")}{day(study.dataset.timeRange?.end)}.
      </p>
    </>
  )
}

export function EventStudyPage({ project }: { project: ProjectSnapshot }) {
  const study = project.eventStudyExplorer
  return (
    <div className="pg">
      {study ? (
        <Content study={study} projectId={project.id} />
      ) : (
        <>
          <header className="pg-head">
            <h1>{uiText("Price event study")}</h1>
          </header>
          <Notice
            kind="info"
            label={uiText("Info")}
            title={uiText("This Project has no verified Event Study Run.")}
            subtitle={uiText("Run the fixed Study with aq run, then reload.")}
          />
          <p>
            <a href={routeHref({ view: 'project', id: project.id })}>{uiText("Back to Project")}</a>
          </p>
        </>
      )}
    </div>
  )
}
