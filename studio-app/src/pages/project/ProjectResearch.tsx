import { uiTemplate, uiText, uiValue } from '../../i18n'
import { useId } from 'react'
import type { ProjectSnapshot, ReportRow, SessionSnapshot, TrialRow } from '../../api'
import { num, when } from '../../format'
import './project.css'
import { routeHref } from '../../route'
import { Info } from '../../components/Info'
import { useFitWidth } from '../../design/useFitWidth'

const NA = (text: string) => <p className="pj-na">{uiText("Not available: ")}{uiValue(text)}</p>

/** Session fields moved under `session` in the verified snapshot; the flat shape is kept as a fallback. */
export function sessionMeta(s: SessionSnapshot) {
  return {
    id: s.session?.id ?? s.id,
    status: s.session?.status ?? s.status,
    studyId: s.session?.studyId ?? s.studyId,
  }
}

/** Signed value with an explicit minus sign; null shows as a dash, never zero. */
const signed = (v: number | null | undefined, d = 4) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}` : '—'

export function runHref(projectId: string, runId: string): string {
  return routeHref({ view: 'run', id: projectId, run: runId })
}

function Verdict({ v }: { v: string }) {
  return (
    <span className="chip" data-v={v}>
      {v}
    </span>
  )
}

function shortRun(id: string): string {
  return id.replace(/^run-/, '').slice(0, 24)
}

function ptClass(t: TrialRow): string {
  return ['pt', t.isCurrentLeader ? 'lead' : '', t.verdict === 'KEEP' ? 'keep' : '', t.verdict === 'CRASH' ? 'crash' : ''].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------------------------

export function Trajectory({ trials, metric, show = 'both' }: { trials: TrialRow[]; metric: string; show?: 'line' | 'ranked' | 'both' }) {
  const id = useId()
  const [figRef, W] = useFitWidth<HTMLElement>(360, 640)
  const pts = trials.filter((t) => typeof t.primaryValue === 'number')
  if (pts.length === 0) return NA('no trial has a primary value yet.')
  const H = 300
  const L = 56
  const R = 16
  const T = 14
  const B = 34
  const values = pts.map((t) => t.primaryValue as number)
  let lo = Math.min(0, ...values)
  let hi = Math.max(0, ...values)
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const maxSeq = Math.max(1, ...pts.map((t) => t.sequence))
  const x = (seq: number) => L + (seq / maxSeq) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const xv = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R)
  const baseline = trials.find((t) => t.role === 'baseline')
  const sorted = [...pts].sort((a, b) => (b.primaryValue as number) - (a.primaryValue as number))
  const ordered = [...pts].sort((a, b) => a.sequence - b.sequence)
  const line = (
      <figure ref={show === 'ranked' ? undefined : figRef} className="pj-fig" aria-labelledby={`${id}-t`}>
        <h3 className="pj-sub" id={`${id}-t`}>{uiText("Trajectory of the selection metric (")}{metric})
        </h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={uiTemplate("{0} for each trial by sequence; {1} trials", [metric, pts.length])}>
          <line className="ax" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
          <text x={L - 6} y={y(0) + 4} textAnchor="end">
            0
          </text>
          <text x={L - 6} y={T + 8} textAnchor="end">
            {hi.toFixed(3)}
          </text>
          <text x={L - 6} y={H - B} textAnchor="end">
            {lo.toFixed(3)}
          </text>
          {baseline && typeof baseline.primaryValue === 'number' && (
            <>
              <line className="ref" x1={L} x2={W - R} y1={y(baseline.primaryValue)} y2={y(baseline.primaryValue)} />
              <text x={W - R} y={y(baseline.primaryValue) - 5} textAnchor="end">{uiText("baseline ")}{signed(baseline.primaryValue)}
              </text>
            </>
          )}
          <polyline className="ln" points={ordered.map((t) => `${x(t.sequence)},${y(t.primaryValue as number)}`).join(' ')} />
          {ordered.map((t) => (
            <circle key={t.runId} cx={x(t.sequence)} cy={y(t.primaryValue as number)} r={t.isCurrentLeader ? 6 : 4.5} className={ptClass(t)}>
              <title>{`#${t.sequence} ${t.verdict}: ${signed(t.primaryValue)}`}</title>
            </circle>
          ))}
          {ordered.map((t) => (
            <text key={`l${t.runId}`} x={x(t.sequence)} y={H - B + 16} textAnchor="middle">
              {t.role === 'baseline' ? uiText("base") : `#${t.sequence}`}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{uiText("Trial sequence")}</text>
        </svg>
        <p className="muted small">{uiText("Orange marks the current leader.")}<Info label={uiText("About the trajectory")}>
            <p>{uiText("Orange marks the current leader. Validation metric chosen by the fixed Judge. The test split is not drawn.")}</p>
          </Info>
        </p>
      </figure>
  )
  const ranked = (
      <figure ref={show === 'ranked' ? figRef : undefined} className="pj-fig">
        <h3 className="pj-sub">{uiText("Trials ranked by ")}{metric}</h3>
        <svg viewBox={`0 0 ${W} ${24 + sorted.length * 26}`} role="img" aria-label={uiTemplate("Ranked trial values, best first, {0} trials", [sorted.length])}>
          {sorted.map((t, i) => {
            const cy = 18 + i * 26
            return (
              <g key={t.runId}>
                <text x={0} y={cy + 4}>
                  {t.role === 'baseline' ? uiText("base") : `#${t.sequence}`}
                </text>
                <line className="ax" x1={L} x2={W - R} y1={cy} y2={cy} />
                <line className="ref" x1={xv(0)} x2={xv(0)} y1={cy - 9} y2={cy + 9} />
                <circle cx={xv(t.primaryValue as number)} cy={cy} r={t.isCurrentLeader ? 6 : 4.5} className={ptClass(t)} />
                <text x={W - R} y={cy - 7} textAnchor="end" className="lbl">
                  {signed(t.primaryValue)} {uiValue(t.verdict)}
                </text>
              </g>
            )
          })}
        </svg>
      </figure>
  )
  if (show === 'line') return line
  if (show === 'ranked') return ranked
  return (
    <div className="cols">
      {line}
      {ranked}
    </div>
  )
}

export function TrialMatrix({
  trials,
  scope,
}: {
  trials: TrialRow[]
  scope?: { totalCandidateTrials: number; displayedCandidateTrials: number; omittedCandidateTrials: number }
}) {
  return (
    <>
      <div className="pj-key" aria-hidden="true">
        <span>
          <i style={{ background: 'var(--text)' }} />{uiText(" KEEP")}</span>
        <span>
          <i />{uiText(" REVERT")}</span>
        <span>
          <i style={{ borderStyle: 'dashed' }} />{uiText(" baseline")}</span>
        <span>
          <i style={{ borderColor: 'var(--signal)', borderStyle: 'dotted', borderWidth: 2 }} />{uiText(" CRASH")}</span>
        <span>
          <i style={{ outline: '2px solid var(--signal-graphic)', outlineOffset: 1 }} />{uiText(" current leader")}</span>
      </div>
      <ul className="pj-matrix" aria-label={uiText("Trial matrix")}>
        {trials.map((t) => (
          <li
            key={t.runId}
            className="pj-cell"
            data-v={t.verdict}
            data-leader={t.isCurrentLeader}
            data-failed={t.status !== 'succeeded'}
            title={uiTemplate("{0} · {1} · Run {2} · {3}{4}", [t.role === 'baseline' ? 'Baseline' : `Trial ${t.sequence}`, t.verdict, t.status, signed(t.primaryValue), t.isCurrentLeader ? ' · current leader' : ''])}
          >
            {t.role === 'baseline' ? 'B' : t.sequence}
            {t.isCurrentLeader && <small>{uiText("lead")}</small>}
          </li>
        ))}
      </ul>
      {scope && scope.omittedCandidateTrials > 0 && (
        <p className="muted small">{uiText("Showing ")}{scope.displayedCandidateTrials}{uiText(" of ")}{scope.totalCandidateTrials}{uiText(" candidate trials; ")}{scope.omittedCandidateTrials}{uiText(" omitted by the server.")}</p>
      )}
    </>
  )
}

/** The Session the first screen is about: the active one, else the newest. */
export function focusSessionIndex(project: ProjectSnapshot): number {
  const active = project.sessions.findIndex((s) => sessionMeta(s).status === 'active')
  return active >= 0 ? active : project.sessions.length - 1
}

/** Where the Project stands, in one line, from server fields only (valid, review, latest Experiment verdict). */
export function projectHeadline(project: ProjectSnapshot): { tone: 'bad' | 'ok'; word: string; text: string; why: string[] } {
  const review = project.agentWorkBrief?.review
  const bad = !project.valid || review?.status === 'blocked'
  const idx = focusSessionIndex(project)
  const exps = idx >= 0 ? (project.sessions[idx].experiments ?? []) : []
  const last = exps.length ? exps.reduce((a, b) => (b.sequence > a.sequence ? b : a)) : null
  const parts: string[] = []
  if (review?.detail) parts.push(review.detail.replace(/\.$/, ''))
  if (last) {
    const head = last.hypothesis.split(':')[0].trim()
    const id = head.length <= 12 ? head : `Trial ${last.sequence}`
    const held = last.verdict === 'KEEP' ? 'held' : last.verdict === 'CRASH' ? 'crashed' : 'did not hold'
    parts.push(`${id} ${held} (${last.verdict})`)
  }
  if (parts.length === 0) parts.push(`${project.studies.length} Study, ${project.runs.length} Runs, no Experiment yet`)
  const why = [review?.label, review?.next, review?.boundary].filter((v): v is string => !!v)
  return { tone: bad ? 'bad' : 'ok', word: bad ? 'Needs attention' : 'Verified', text: parts.join('; '), why }
}

/** First-screen chart: trajectory of the selection metric, next to the trial matrix of the focus Session. */
export function TrialHero({ project }: { project: ProjectSnapshot }) {
  const idx = focusSessionIndex(project)
  if (idx < 0) return NA('this Project has no Research Session, so there is no trial trajectory yet.')
  const s = project.sessions[idx]
  const dm = s.decisionMatrix
  const trials = dm?.trials ?? []
  if (trials.length === 0) return NA('the Session has no decision matrix.')
  return (
    <div className="cols cols--3-2 pj-hero">
      <Trajectory trials={trials} metric={dm?.objective?.metric ?? 'primary metric'} show="line" />
      <div>
        <h3 className="pj-sub">{uiText("Trial matrix")}</h3>
        <TrialMatrix trials={trials} scope={dm?.scope} />
      </div>
    </div>
  )
}

export function ExperimentsBlock({ project }: { project: ProjectSnapshot }) {
  const sessions = project.sessions
  if (sessions.length === 0) return NA('this Project has no Research Session, so there is no Experiment ledger.')
  const focus = focusSessionIndex(project)
  return (
    <>
      {sessions.map((s, i) => {
        const meta = sessionMeta(s)
        const exps = s.experiments ?? []
        const dm = s.decisionMatrix
        const trials = dm?.trials ?? []
        return (
          <div key={meta.id ?? i}>
            {sessions.length > 1 && (
              <h3 className="pj-sub mono" translate="no">
                {meta.id}
              </h3>
            )}
            <h3 className="pj-sub">{uiText("Experiments")}</h3>
            {exps.length === 0 ? (
              <p className="pj-na">{uiText("No Experiment has been run in this Session: only the baseline exists.")}</p>
            ) : (
              <div className="tablewrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">{uiText("Hypothesis")}</th>
                      <th scope="col">{uiText("Verdict")}</th>
                      <th scope="col" className="r">{uiText("Leader")}</th>
                      <th scope="col" className="r">{uiText("Candidate")}</th>
                      <th scope="col" className="r">{uiText("Improvement")}</th>
                      <th scope="col">{uiText("Run")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exps.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">{e.sequence}</td>
                        <td className="pj-hyp">
                          {e.hypothesis}
                          <span className="faint small mono" translate="no">
                            {e.id} · {when(e.completedAt)}
                          </span>
                        </td>
                        <td>
                          <Verdict v={e.verdict} />
                        </td>
                        <td className="r num mono">{num(e.leaderValue, 4)}</td>
                        <td className="r num mono">{num(e.candidateValue, 4)}</td>
                        <td className="r num mono">{signed(e.improvement)}</td>
                        <td className="mono small" translate="no">
                          <a href={runHref(project.id, e.runId)}>{shortRun(e.runId)}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted small">{uiText("Values are the validation selection metric; the Judge assigns verdicts.")}<Info label={uiText("About the Experiment ledger")}>
                <p>
                  {dm?.objective
                    ? uiTemplate("Objective: {0} {1}; an Experiment must beat the leader by at least {2} to be kept.", [dm.objective.direction, dm.objective.metric, dm.objective.minimumImprovement])
                    : ''}{uiText("The Judge assigns verdicts. Values are the validation selection metric.")}</p>
              </Info>
            </p>
            {trials.length > 0 && i !== focus && (
              <>
                <h3 className="pj-sub">{uiText("Trial matrix")}</h3>
                <TrialMatrix trials={trials} scope={dm?.scope} />
              </>
            )}
            {trials.length > 0 && <Trajectory trials={trials} metric={dm?.objective?.metric ?? 'primary metric'} show={i === focus ? 'ranked' : 'both'} />}
          </div>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------------------------

function pValue(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '—'
}

export function SelectionBlock({ project }: { project: ProjectSnapshot }) {
  const withIntegrity = project.sessions.filter((s) => s.selectionIntegrity)
  if (withIntegrity.length === 0) return NA('no Session has selection-integrity evidence.')
  return (
    <>
      {withIntegrity.map((s, i) => {
        const si = s.selectionIntegrity!
        const fam = si.researchFamily
        const adj = si.selectionAdjustment
        const passes = adj?.passes === true
        const meta = sessionMeta(s)
        return (
          <div key={meta.id ?? i}>
            <div className="pj-callout" role="note">
              <p>
                <strong>{passes ? uiText("The selection adjustment passes.") : uiText("Headline numbers on this page are in-sample.")}</strong>
                <Info label={uiText("About the selection adjustment")}>
                  <p>
                    {passes
                      ? uiText("The selected validation result survives the family-wise threshold. This is diagnostic evidence only and has no trading authority.")
                      : uiTemplate("They have not survived the multiple-testing adjustment{0}, so treat every IC and verdict here as selected from the trials counted below, not as a confirmed effect.", [adj ? '' : ' (it is not available)'])}
                  </p>
                </Info>
              </p>
              {si.externalHoldoutRequired && <p>{uiText("An external holdout is required before any production-grade claim.")}</p>}
            </div>
            <div className="cols cols--2-3">
            <dl className="stats">
              <div>
                <dt>{uiText("Unique source trials")}</dt>
                <dd className="mono">{fam ? fam.uniqueSourceTrials : '—'}</dd>
              </div>
              <div>
                <dt>{uiText("Failed trials")}</dt>
                <dd className="mono">{fam?.failedSourceTrials ?? '—'}</dd>
              </div>
              <div>
                <dt>{uiText("Total executions")}</dt>
                <dd className="mono">{fam ? fam.totalExecutions : '—'}</dd>
              </div>
              <div>
                <dt>{uiText("Adjustment passes")}</dt>
                <dd className="mono">{adj?.passes === true ? uiText("yes") : adj?.passes === false ? uiText("no") : '—'}</dd>
              </div>
            </dl>
            <dl className="pj-kv">
              <dt>{uiText("Adjustment method")}</dt>
              <dd className="mono">
                {adj?.method ?? uiText("not available")}
                {adj && uiTemplate("({0}% confidence)", [Math.round(adj.confidenceLevel * 100)])}
              </dd>
              {adj?.statistics && (
                <>
                  <dt>{uiText("Selected mean IC")}</dt>
                  <dd className="mono">{signed(adj.statistics.observedMeanIc)}</dd>
                  <dt>{uiText("HAC p, raw / family-wise")}</dt>
                  <dd className="mono">
                    {pValue(adj.statistics.rawHacPValue)} / {pValue(adj.statistics.familywiseAdjustedPValue)}{uiText(" over ")}{adj.statistics.uniqueTrials}{uiText(" trials")}</dd>
                </>
              )}
              {adj && !adj.statistics && adj.reason && (
                <>
                  <dt>{uiText("Why unavailable")}</dt>
                  <dd>{uiValue(adj.reason)}</dd>
                </>
              )}
              <dt>{uiText("Interpretation")}</dt>
              <dd>{adj?.interpretation ?? uiText("not available")}</dd>
              <dt>{uiText("Trial count rule")}</dt>
              <dd className="mono">
                {fam?.trialCountAssumption ?? '—'}
                {fam && (fam.reproducible ? ' · reproducible ledger' : ' · ledger not reproducible')}
              </dd>
              <dt>{uiText("External holdout required")}</dt>
              <dd>
                {si.externalHoldoutRequired === true ? uiText("Yes") : si.externalHoldoutRequired === false ? uiText("No") : uiText("Not stated")}
                {si.externalHoldoutReason && <span className="faint small mono"> · {si.externalHoldoutReason}</span>}
              </dd>
            </dl>
            </div>
            {si.warning && (
              <p className="muted small">{uiText("Server warning")}<Info label={uiText("Server warning")}>
                  <p>{uiValue(si.warning)}</p>
                </Info>
              </p>
            )}
          </div>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------------------------

function Bullets({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <>
      <h3 className="pj-sub">{title}</h3>
      <ul className="pj-list">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </>
  )
}

export function QuestionBlock({ project }: { project: ProjectSnapshot }) {
  const q = project.agentWorkBrief?.question
  const req = project.sessions.find((s) => s.delegation?.request)?.delegation?.request
  const fe = project.factorExplorer
  const claim = fe?.factorQualification?.claim
  const horizon = fe?.researchHorizon
  if (!q && !req && !claim && !horizon) return NA('the Agent Work Brief and the delegated request carry no question.')
  const text = q?.text ?? req?.question
  return (
    <div className="cols cols--3-2">
      <div>
        <h3 className="pj-sub">{uiText("Question")}</h3>
        {text ? <blockquote className="pj-quote">{uiValue(text)}</blockquote> : <p className="pj-na">{uiText("Not available: no question text.")}</p>}
        {q?.origin && <p className="muted small">{uiText("Origin: ")}{q.origin}</p>}
        {req?.decisionContext && (
          <>
            <h3 className="pj-sub">{uiText("Decision it supports")}</h3>
            <p>{req.decisionContext}</p>
          </>
        )}
        <Bullets title={uiText("Hypotheses")} items={req?.hypotheses} />
      </div>
      <div>
        <h3 className="pj-sub">{uiText("Claim and horizon")}</h3>
        {claim || horizon ? (
          <dl className="pj-kv">
            {claim?.claim && (
              <>
                <dt>{uiText("Claim")}</dt>
                <dd className="mono">{claim.claim}</dd>
              </>
            )}
            {claim?.outcome && (
              <>
                <dt>{uiText("Outcome")}</dt>
                <dd className="mono">{claim.outcome}</dd>
              </>
            )}
            {claim && claim.knownStyle !== undefined && (
              <>
                <dt>{uiText("Known style")}</dt>
                <dd className="mono">{claim.knownStyle ?? uiText("none")}</dd>
              </>
            )}
            {claim?.selectionAuthority && (
              <>
                <dt>{uiText("Selection authority")}</dt>
                <dd className="mono">{claim.selectionAuthority}</dd>
              </>
            )}
            {claim?.tradingAuthority && (
              <>
                <dt>{uiText("Trading authority")}</dt>
                <dd className="mono">{uiValue(claim.tradingAuthority)}</dd>
              </>
            )}
            {horizon?.primaryForwardBars !== undefined && (
              <>
                <dt>{uiText("Primary horizon")}</dt>
                <dd className="mono">{horizon.primaryForwardBars}{uiText(" bars")}</dd>
              </>
            )}
            {horizon?.diagnosticForwardBars && (
              <>
                <dt>{uiText("Context horizons")}</dt>
                <dd className="mono">{horizon.diagnosticForwardBars.join(', ')}{uiText(" bars")}</dd>
              </>
            )}
            {horizon?.source?.horizon && (
              <>
                <dt>{uiText("Caller wording")}</dt>
                <dd>{horizon.source.horizon}</dd>
              </>
            )}
            {horizon?.targetSemantics && (
              <>
                <dt>{uiText("Target")}</dt>
                <dd className="mono">{horizon.targetSemantics}</dd>
              </>
            )}
          </dl>
        ) : (
          NA('no Factor Run has recorded a claim or horizon yet.')
        )}
        <Bullets title={uiText("Constraints")} items={req?.constraints} />
        <Bullets title={uiText("Deliverables")} items={req?.deliverables} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function DocList({ title, rows, empty }: { title: string; rows: ReportRow[]; empty: string }) {
  return (
    <>
      <h3 className="pj-sub">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="pj-na">{empty}</p>
      ) : (
        <ul className="plain">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="lane">
              <span translate="no">{r.title ?? r.id ?? 'untitled'}</span>
              <span className="mono small faint">{[r.status, r.createdAt ? when(r.createdAt) : null].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function EvidenceDocsBlock({ project }: { project: ProjectSnapshot }) {
  const sessionReports = project.sessions.flatMap((s) => s.reports ?? [])
  const agenda = project.agentWorkBrief?.researchAgenda
  const holdout = project.externalHoldout
  const required = project.sessions.some((s) => s.selectionIntegrity?.externalHoldoutRequired === true)
  return (
    <>
      <DocList title={uiText("Session Reports")} rows={sessionReports} empty="Not available: no Session Report has been published." />
      <DocList title={uiText("Run Reports")} rows={project.runReports ?? []} empty="Not available: no Run Report has been published." />
      <DocList title={uiText("Reviews")} rows={project.reviews ?? []} empty="Not available: no independent Review exists." />
      <DocList title={uiText("Dossiers")} rows={project.dossiers ?? []} empty="Not available: no Dossier has been published." />
      <h3 className="pj-sub">{uiText("External holdout")}</h3>
      {holdout ? (
        <p>{uiText("Recorded, status: ")}<span className="mono">{holdout.status ?? holdout.state ?? uiText("present")}</span>{uiText(". Holdout numbers are not drawn until the Holdout Assessment is verified.")}</p>
      ) : (
        <p className="pj-na">{uiText("Not available: no external holdout has been run for this Project.")}{required && uiText(" One is required before a production-grade claim.")}
        </p>
      )}
      <h3 className="pj-sub">{uiText("Research agenda")}</h3>
      {agenda?.status === 'available' && agenda.moves && agenda.moves.length > 0 ? (
        <>
          {agenda.diagnosis?.explanation && <p className="muted small">{uiValue(agenda.diagnosis.explanation)}</p>}
          <ol className="pj-list">
            {agenda.moves.map((m) => (
              <li key={m.id}>
                <strong>{m.title}.</strong> {m.hypothesis} <span className="faint small">{m.rationale}</span>
              </li>
            ))}
          </ol>
          {agenda.moveRole && <p className="muted small">{uiText("Role: ")}{agenda.moveRole}{uiText(". Moves are diagnostic guidance, never an instruction to run.")}</p>}
        </>
      ) : (
        <p className="pj-na">{uiText("Not available: ")}{agenda?.reason ?? uiText("the Agent Work Brief has no research agenda.")}</p>
      )}
    </>
  )
}

export function NextMoveBlock({ project }: { project: ProjectSnapshot }) {
  const brief = project.agentWorkBrief
  if (!brief) return NA('the Project has no Agent Work Brief.')
  const action = brief.primaryAction
  const review = brief.review
  return (
    <>
      {review?.label && (
        <p>
          <span className="chip" data-v={review.status === 'blocked' ? 'CRASH' : 'BASELINE'}>
            {uiValue(review.label)}
          </span>
        </p>
      )}
      {action?.description ? (
        <>
          <p>{uiValue(action.description)}</p>
          {action.display && (
            <pre className="cmd mono" translate="no">
              {action.display}
            </pre>
          )}
        </>
      ) : (
        !review?.label && <p className="pj-na">{uiText("Not available: the Agent Work Brief recommends no action.")}</p>
      )}
      <p className="muted small">
        {brief.focus?.studyName ? uiTemplate("Study {0}", [brief.focus.studyName]) : uiText("Next move")}
        {brief.authority && <>{uiText(" · trading authority ")}{uiValue(brief.authority.tradingAuthority)}</>}
        <Info label={uiText("About this move")}>
          {brief.reasons && brief.reasons.some((r) => r.message !== review?.detail) && (
            <ul className="pj-list">
              {brief.reasons
                .filter((r) => r.message !== review?.detail)
                .map((r, i) => (
                  <li key={r.code ?? i}>{r.message}</li>
                ))}
            </ul>
          )}
          <p>
            {brief.focus?.studyName && <>{uiText("Study ")}{brief.focus.studyName}. </>}
            {brief.focus?.laneName && <>{uiText("Lane ")}{brief.focus.laneName}. </>}
            {brief.focus?.scientificStage && <>{uiText("Stage ")}{brief.focus.scientificStage}. </>}
            {brief.authority && (
              <>{uiText("Selection uses the ")}{brief.authority.selectionSplit}{uiText(" split; the test split is ")}{brief.authority.testEntersSelection ? uiText("part of") : uiText("never part of")}{uiText(" selection. Trading authority: ")}{brief.authority.tradingAuthority}.
              </>
            )}
          </p>
        </Info>
      </p>
    </>
  )
}

/** The question in one line, for the folded Question section's summary. */
export function questionLine(project: ProjectSnapshot): string {
  const text = project.agentWorkBrief?.question?.text ?? project.sessions.find((s) => s.delegation?.request)?.delegation?.request?.question
  return text ?? 'No question recorded'
}
