import { useId } from 'react'
import type { ProjectSnapshot, ReportRow, SessionSnapshot, TrialRow } from '../../api'
import { num, when } from '../../format'
import './project.css'
import { routeHref } from '../../route'

const NA = (text: string) => <p className="pj-na">Not available: {text}</p>

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

function Trajectory({ trials, metric }: { trials: TrialRow[]; metric: string }) {
  const id = useId()
  const pts = trials.filter((t) => typeof t.primaryValue === 'number')
  if (pts.length === 0) return NA('no trial has a primary value yet.')
  const W = 640
  const H = 220
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
  return (
    <div className="cols">
      <figure className="pj-fig" aria-labelledby={`${id}-t`}>
        <h3 className="pj-sub" id={`${id}-t`}>
          Trajectory of the selection metric ({metric})
        </h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric} for each trial by sequence; ${pts.length} trials`}>
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
              <text x={W - R} y={y(baseline.primaryValue) - 5} textAnchor="end">
                baseline {signed(baseline.primaryValue)}
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
              {t.role === 'baseline' ? 'base' : `#${t.sequence}`}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">
            Trial sequence
          </text>
        </svg>
        <p className="muted small">Orange marks the current leader. Validation metric chosen by the fixed Judge. The test split is not drawn.</p>
      </figure>
      <figure className="pj-fig">
        <h3 className="pj-sub">Trials ranked by {metric}</h3>
        <svg viewBox={`0 0 ${W} ${24 + sorted.length * 26}`} role="img" aria-label={`Ranked trial values, best first, ${sorted.length} trials`}>
          {sorted.map((t, i) => {
            const cy = 18 + i * 26
            return (
              <g key={t.runId}>
                <text x={0} y={cy + 4}>
                  {t.role === 'baseline' ? 'base' : `#${t.sequence}`}
                </text>
                <line className="ax" x1={L} x2={W - R} y1={cy} y2={cy} />
                <line className="ref" x1={xv(0)} x2={xv(0)} y1={cy - 9} y2={cy + 9} />
                <circle cx={xv(t.primaryValue as number)} cy={cy} r={t.isCurrentLeader ? 6 : 4.5} className={ptClass(t)} />
                <text x={W - R} y={cy - 7} textAnchor="end" className="lbl">
                  {signed(t.primaryValue)} {t.verdict}
                </text>
              </g>
            )
          })}
        </svg>
      </figure>
    </div>
  )
}

function TrialMatrix({
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
          <i style={{ background: 'var(--text)' }} /> KEEP
        </span>
        <span>
          <i /> REVERT
        </span>
        <span>
          <i style={{ borderStyle: 'dashed' }} /> baseline
        </span>
        <span>
          <i style={{ borderColor: 'var(--signal)', borderStyle: 'dotted', borderWidth: 2 }} /> CRASH
        </span>
        <span>
          <i style={{ outline: '2px solid var(--signal-graphic)', outlineOffset: 1 }} /> current leader
        </span>
      </div>
      <ul className="pj-matrix" aria-label="Trial matrix">
        {trials.map((t) => (
          <li
            key={t.runId}
            className="pj-cell"
            data-v={t.verdict}
            data-leader={t.isCurrentLeader}
            data-failed={t.status !== 'succeeded'}
            title={`${t.role === 'baseline' ? 'Baseline' : `Trial ${t.sequence}`} · ${t.verdict} · Run ${t.status} · ${signed(t.primaryValue)}${t.isCurrentLeader ? ' · current leader' : ''}`}
          >
            {t.role === 'baseline' ? 'B' : t.sequence}
            {t.isCurrentLeader && <small>lead</small>}
          </li>
        ))}
      </ul>
      {scope && scope.omittedCandidateTrials > 0 && (
        <p className="muted small">
          Showing {scope.displayedCandidateTrials} of {scope.totalCandidateTrials} candidate trials; {scope.omittedCandidateTrials} omitted by the server.
        </p>
      )}
    </>
  )
}

export function ExperimentsBlock({ project }: { project: ProjectSnapshot }) {
  const sessions = project.sessions
  if (sessions.length === 0) return NA('this Project has no Research Session, so there is no Experiment ledger.')
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
            <h3 className="pj-sub">Experiments</h3>
            {exps.length === 0 ? (
              <p className="pj-na">No Experiment has been run in this Session: only the baseline exists.</p>
            ) : (
              <div className="tablewrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Hypothesis</th>
                      <th scope="col">Verdict</th>
                      <th scope="col" className="r">Leader</th>
                      <th scope="col" className="r">Candidate</th>
                      <th scope="col" className="r">Improvement</th>
                      <th scope="col">Run</th>
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
            <p className="muted small">
              {dm?.objective
                ? `Objective: ${dm.objective.direction} ${dm.objective.metric}; an Experiment must beat the leader by at least ${dm.objective.minimumImprovement} to be kept. `
                : ''}
              The Judge assigns verdicts. Values are the validation selection metric.
            </p>
            <h3 className="pj-sub">Trial matrix</h3>
            {trials.length === 0 ? NA('the Session has no decision matrix.') : <TrialMatrix trials={trials} scope={dm?.scope} />}
            {trials.length > 0 && <Trajectory trials={trials} metric={dm?.objective?.metric ?? 'primary metric'} />}
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
                <strong>{passes ? 'The selection adjustment passes.' : 'Headline numbers on this page are in-sample.'}</strong>{' '}
                {passes
                  ? 'The selected validation result survives the family-wise threshold. This is diagnostic evidence only and has no trading authority.'
                  : `They have not survived the multiple-testing adjustment${adj ? '' : ' (it is not available)'}, so treat every IC and verdict here as selected from the trials counted below, not as a confirmed effect.`}
              </p>
              {si.externalHoldoutRequired && <p>An external holdout is required before any production-grade claim.</p>}
            </div>
            <div className="cols cols--2-3">
            <dl className="stats">
              <div>
                <dt>Unique source trials</dt>
                <dd className="mono">{fam ? fam.uniqueSourceTrials : '—'}</dd>
              </div>
              <div>
                <dt>Failed trials</dt>
                <dd className="mono">{fam?.failedSourceTrials ?? '—'}</dd>
              </div>
              <div>
                <dt>Total executions</dt>
                <dd className="mono">{fam ? fam.totalExecutions : '—'}</dd>
              </div>
              <div>
                <dt>Adjustment passes</dt>
                <dd className="mono">{adj?.passes === true ? 'yes' : adj?.passes === false ? 'no' : '—'}</dd>
              </div>
            </dl>
            <dl className="pj-kv">
              <dt>Adjustment method</dt>
              <dd className="mono">
                {adj?.method ?? 'not available'}
                {adj && ` (${Math.round(adj.confidenceLevel * 100)}% confidence)`}
              </dd>
              {adj?.statistics && (
                <>
                  <dt>Selected mean IC</dt>
                  <dd className="mono">{signed(adj.statistics.observedMeanIc)}</dd>
                  <dt>HAC p, raw / family-wise</dt>
                  <dd className="mono">
                    {pValue(adj.statistics.rawHacPValue)} / {pValue(adj.statistics.familywiseAdjustedPValue)} over {adj.statistics.uniqueTrials} trials
                  </dd>
                </>
              )}
              {adj && !adj.statistics && adj.reason && (
                <>
                  <dt>Why unavailable</dt>
                  <dd>{adj.reason}</dd>
                </>
              )}
              <dt>Interpretation</dt>
              <dd>{adj?.interpretation ?? 'not available'}</dd>
              <dt>Trial count rule</dt>
              <dd className="mono">
                {fam?.trialCountAssumption ?? '—'}
                {fam && (fam.reproducible ? ' · reproducible ledger' : ' · ledger not reproducible')}
              </dd>
              <dt>External holdout required</dt>
              <dd>
                {si.externalHoldoutRequired === true ? 'Yes' : si.externalHoldoutRequired === false ? 'No' : 'Not stated'}
                {si.externalHoldoutReason && <span className="faint small mono"> · {si.externalHoldoutReason}</span>}
              </dd>
            </dl>
            </div>
            {si.warning && <p className="muted small">Server warning: {si.warning}</p>}
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
        <h3 className="pj-sub">Question</h3>
        {text ? <blockquote className="pj-quote">{text}</blockquote> : <p className="pj-na">Not available: no question text.</p>}
        {q?.origin && <p className="muted small">Origin: {q.origin}</p>}
        {req?.decisionContext && (
          <>
            <h3 className="pj-sub">Decision it supports</h3>
            <p>{req.decisionContext}</p>
          </>
        )}
        <Bullets title="Hypotheses" items={req?.hypotheses} />
      </div>
      <div>
        <h3 className="pj-sub">Claim and horizon</h3>
        {claim || horizon ? (
          <dl className="pj-kv">
            {claim?.claim && (
              <>
                <dt>Claim</dt>
                <dd className="mono">{claim.claim}</dd>
              </>
            )}
            {claim?.outcome && (
              <>
                <dt>Outcome</dt>
                <dd className="mono">{claim.outcome}</dd>
              </>
            )}
            {claim && claim.knownStyle !== undefined && (
              <>
                <dt>Known style</dt>
                <dd className="mono">{claim.knownStyle ?? 'none'}</dd>
              </>
            )}
            {claim?.selectionAuthority && (
              <>
                <dt>Selection authority</dt>
                <dd className="mono">{claim.selectionAuthority}</dd>
              </>
            )}
            {claim?.tradingAuthority && (
              <>
                <dt>Trading authority</dt>
                <dd className="mono">{claim.tradingAuthority}</dd>
              </>
            )}
            {horizon?.primaryForwardBars !== undefined && (
              <>
                <dt>Primary horizon</dt>
                <dd className="mono">{horizon.primaryForwardBars} bars</dd>
              </>
            )}
            {horizon?.diagnosticForwardBars && (
              <>
                <dt>Context horizons</dt>
                <dd className="mono">{horizon.diagnosticForwardBars.join(', ')} bars</dd>
              </>
            )}
            {horizon?.source?.horizon && (
              <>
                <dt>Caller wording</dt>
                <dd>{horizon.source.horizon}</dd>
              </>
            )}
            {horizon?.targetSemantics && (
              <>
                <dt>Target</dt>
                <dd className="mono">{horizon.targetSemantics}</dd>
              </>
            )}
          </dl>
        ) : (
          NA('no Factor Run has recorded a claim or horizon yet.')
        )}
        <Bullets title="Constraints" items={req?.constraints} />
        <Bullets title="Deliverables" items={req?.deliverables} />
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
      <DocList title="Session Reports" rows={sessionReports} empty="Not available: no Session Report has been published." />
      <DocList title="Run Reports" rows={project.runReports ?? []} empty="Not available: no Run Report has been published." />
      <DocList title="Reviews" rows={project.reviews ?? []} empty="Not available: no independent Review exists." />
      <DocList title="Dossiers" rows={project.dossiers ?? []} empty="Not available: no Dossier has been published." />
      <h3 className="pj-sub">External holdout</h3>
      {holdout ? (
        <p>
          Recorded, status: <span className="mono">{holdout.status ?? holdout.state ?? 'present'}</span>. Holdout numbers are not drawn until the Holdout Assessment is verified.
        </p>
      ) : (
        <p className="pj-na">
          Not available: no external holdout has been run for this Project.
          {required && ' One is required before a production-grade claim.'}
        </p>
      )}
      <h3 className="pj-sub">Research agenda</h3>
      {agenda?.status === 'available' && agenda.moves && agenda.moves.length > 0 ? (
        <>
          {agenda.diagnosis?.explanation && <p className="muted small">{agenda.diagnosis.explanation}</p>}
          <ol className="pj-list">
            {agenda.moves.map((m) => (
              <li key={m.id}>
                <strong>{m.title}.</strong> {m.hypothesis} <span className="faint small">{m.rationale}</span>
              </li>
            ))}
          </ol>
          {agenda.moveRole && <p className="muted small">Role: {agenda.moveRole}. Moves are diagnostic guidance, never an instruction to run.</p>}
        </>
      ) : (
        <p className="pj-na">Not available: {agenda?.reason ?? 'the Agent Work Brief has no research agenda.'}</p>
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
            {review.label}
          </span>{' '}
          {review.detail}
        </p>
      )}
      {action?.description ? (
        <>
          <p>{action.description}</p>
          {action.display && (
            <pre className="cmd mono" translate="no">
              {action.display}
            </pre>
          )}
        </>
      ) : (
        !review?.label && <p className="pj-na">Not available: the Agent Work Brief recommends no action.</p>
      )}
      {brief.reasons && brief.reasons.some((r) => r.message !== review?.detail) && (
        <ul className="pj-list">
          {brief.reasons
            .filter((r) => r.message !== review?.detail)
            .map((r, i) => (
              <li key={r.code ?? i}>{r.message}</li>
            ))}
        </ul>
      )}
      <p className="muted small">
        {brief.focus?.studyName && <>Study {brief.focus.studyName}. </>}
        {brief.focus?.laneName && <>Lane {brief.focus.laneName}. </>}
        {brief.focus?.scientificStage && <>Stage {brief.focus.scientificStage}. </>}
        {brief.authority && (
          <>
            Selection uses the {brief.authority.selectionSplit} split; the test split is {brief.authority.testEntersSelection ? 'part of' : 'never part of'} selection.
            Trading authority: {brief.authority.tradingAuthority}.
          </>
        )}
      </p>
    </>
  )
}
