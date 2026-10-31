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
import './eventStudy.css'

const GUARD_LABEL: Record<EnvelopeRate['guard'], string> = {
  ok: 'Sample sufficient',
  'small-sample': 'Small sample',
  withheld: 'Estimate withheld',
}

const CONCLUSION: Record<string, { word: string; signal: boolean }> = {
  'insufficient-events': { word: 'Insufficient events', signal: true },
  'observed-advantage': { word: 'Observed advantage', signal: false },
  'no-observed-advantage': { word: 'No observed advantage', signal: false },
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
        N={rate.n} · {rate.successes} {rate.successes === 1 ? 'hit' : 'hits'} · no estimate below the minimum sample
      </span>
    )
  }
  return (
    <span className="mono">
      {pct(rate.estimate)} · N={rate.n} · {rate.successes} hits · 95% CI {pct(rate.ci95[0])}–{pct(rate.ci95[1])}
    </span>
  )
}

/** The 95% Wilson interval on a 0–100% track, with the point estimate marked. */
function IntervalBar({ rate, label }: { rate: EnvelopeRate; label: string }) {
  if (rate.estimate === null || rate.ci95 === null) {
    return <div className="ibar is-empty" role="img" aria-label={`${label}: no interval, N=${rate.n}`} />
  }
  const [low, high] = rate.ci95
  return (
    <div
      className="ibar"
      role="img"
      aria-label={`${label}: ${pct(rate.estimate)} with 95% interval ${pct(low)} to ${pct(high)}, N=${rate.n}`}
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
        {verdict}
        {value.agree === null && ' · a half has too few events for an interval'}
        {value.agree === false && ' · the rate is not stable across time'}
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
      <h4>Stability</h4>
      <Stability value={outcome.stability} />
      <h4>Per year</h4>
      {outcome.perYear.length === 0 ? (
        <p className="muted small">No primary events.</p>
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
            <th scope="col" className="r">Min</th>
            {keys.map((key) => (
              <th key={key} scope="col" className="r">{key.toUpperCase()}</th>
            ))}
            <th scope="col" className="r">Max</th>
            <th scope="col" className="r">Mean</th>
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
        <h1>Price event study</h1>
        <p className="muted small">
          <span className="state">
            <Glyph kind={look.signal ? 'error' : 'supported'} signal={look.signal} />
            <span className={look.signal ? 'sig' : undefined}>{look.word}</span>
          </span>
          {' · '}
          {conclusion.observedPrimaryEvents}/{conclusion.minimumEvents} minimum primary events
          {' · '}
          <a href={routeHref({ view: 'project', id: projectId })}>Back to Project</a>
        </p>
        <p className="lede">
          <span translate="no" className="mono">{policy.event.asset}</span> opening gap ≤ {ret(policy.event.thresholdReturn)}, wait{' '}
          {policy.timing.waitBars} bars, hold {policy.timing.holdingBars} bars, matched against{' '}
          <span translate="no" className="mono">{policy.references.matchedAsset}</span>. Rates use the{' '}
          {plural(populations.primaryEvents, 'primary non-overlapping event')} of {populations.qualifyingEvents} qualifying.
        </p>
      </header>

      <Notice kind="info" label="Info" title="Read every rate with its sample size." subtitle={envelope.disclaimer} />

      <Section title="Outcome rates" id="sec-rates">
        <div className="ocards">
          <OutcomeCard title="Asset return above zero" outcome={positive} />
          <OutcomeCard title="Beats the matched reference" outcome={excess} />
        </div>
        <p className="muted small">
          Wilson {pct(envelope.confidenceLevel, 0)} intervals. An estimate is withheld below {envelope.guards.withholdBelow} events and
          flagged below {envelope.guards.warnBelow}. Event returns still cluster in volatile regimes, so treat intervals as optimistic.
        </p>
      </Section>

      <Section title="Reference" id="sec-reference">
        <dl className="stats">
          <div>
            <dt>Unconditional hit rate, same asset</dt>
            <dd className="mono">{pct(unconditional.estimate)}</dd>
            <dd className="faint small mono">N={unconditional.n} · {unconditional.successes} hits · no interval</dd>
          </div>
          <div>
            <dt>Primary hit rate</dt>
            <dd className="mono">{pct(positive.estimate)}</dd>
            <dd className="faint small mono">N={positive.n} · {positive.successes} hits</dd>
          </div>
        </dl>
        <p className="muted small">
          Unconditional observations overlap by construction (one per entry date across the holding window), so no interval is drawn
          for them.
        </p>
      </Section>

      <Section title="Return distribution (primary events)" id="sec-distribution">
        <Distribution title="Asset return" value={envelope.returnDistribution} />
        <Distribution title="Excess over matched reference" value={envelope.excessDistribution} />
      </Section>

      <Section title="Events behind every number" id="sec-events">
        <p className="muted small">
          {populations.qualifyingEvents} qualifying · {populations.completeEvents} complete · {populations.primaryEvents} primary ·{' '}
          {populations.overlapExcludedEvents} overlap-excluded · {populations.rightCensoredEvents} right-censored.
        </p>
        {study.events.length === 0 ? (
          <p className="muted">No event met the threshold in this dataset.</p>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" className="r">#</th>
                  <th scope="col">Event date</th>
                  <th scope="col" className="r">Gap</th>
                  <th scope="col">Entry</th>
                  <th scope="col">Exit</th>
                  <th scope="col" className="r">Asset</th>
                  <th scope="col" className="r">Reference</th>
                  <th scope="col" className="r">Excess</th>
                  <th scope="col">Status</th>
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
        {study.warning} Run <span className="mono" translate="no">{study.run.id}</span>, dataset {day(study.dataset.timeRange?.start)} to {day(study.dataset.timeRange?.end)}.
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
            <h1>Price event study</h1>
          </header>
          <Notice
            kind="info"
            label="Info"
            title="This Project has no verified Event Study Run."
            subtitle="Run the fixed Study with aq run, then reload."
          />
          <p>
            <a href={routeHref({ view: 'project', id: project.id })}>Back to Project</a>
          </p>
        </>
      )}
    </div>
  )
}
