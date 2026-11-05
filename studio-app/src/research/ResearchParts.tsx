import { uiTemplate, uiText } from '../i18n'
import { Glyph } from '../design/icons'
import { VerdictBand, type Reason } from '../components/VerdictBand'
import type { Direction, LedgerRow, ResearchHypothesis } from './researchApi'
import { bandOf, fixed, money, rowLabel, rowStateOf, rowThreshold, rowValue, statusOf } from './words'

export function StateWord({ glyph, word, signal }: { glyph: Parameters<typeof Glyph>[0]['kind']; word: string; signal: boolean }) {
  return <span className="state"><Glyph kind={glyph} signal={signal} /><span className={signal ? 'sig' : undefined}>{word}</span></span>
}

export function Status({ status }: { status: string }) {
  return <StateWord {...statusOf(status)} />
}

/** The hypothesis as written: `## Claim / Mechanism / Falsification` sections lead, the full text folds under them. */
export function Claim({ h }: { h: ResearchHypothesis }) {
  const sections = h.body.split(/^## /m).slice(1).map((part) => {
    const [head, ...rest] = part.split('\n')
    return { head: head.trim(), text: rest.join('\n').trim() }
  })
  return (
    <div className="vstack">
      <p className="rs-claim" translate="no">{h.title}</p>
      {sections.length > 0 && (
        <dl className="rs-kv">
          {sections.map((s) => [<dt key={`${s.head}-t`} translate="no">{s.head}</dt>, <dd key={`${s.head}-d`} translate="no">{s.text}</dd>])}
        </dl>
      )}
      <details>
        <summary>{uiText("Full hypothesis text")}</summary>
        <pre className="rs-pre" translate="no">{h.body}</pre>
      </details>
    </div>
  )
}

/** What was frozen before the trials: evaluator and data hashes per experiment, and the plan's rule when there is one. */
export function Criteria({ h }: { h: ResearchHypothesis }) {
  if (h.experiments.length === 0) return <p className="muted small">{uiText("No experiment yet: nothing is frozen until the first scaffold.")}</p>
  return (
    <dl className="rs-kv">
      {h.experiments.map((e) => [
        <dt key={`${e.id}-t`} className="mono" translate="no">{e.id}</dt>,
        <dd key={`${e.id}-d`}>
          <span className="mono small" translate="no">{uiText("evaluator")} {e.evaluatorHash?.slice(0, 12) ?? '—'} · {uiText("data")} {e.dataHash?.slice(0, 12) ?? '—'}</span>
          <br />
          {e.plan ? <span className="small" translate="no">{e.plan.rule.kind} v{e.plan.rule.version} · {e.plan.claim} · {e.plan.rationale}</span> : <span className="small muted">{uiText("Unfrozen plan (legacy): thresholds came from the command line and are recorded with the skeptic report.")}</span>}
        </dd>,
      ])}
    </dl>
  )
}

/** The check ledger exactly as the server built it: state, value, threshold and role. */
export function Ledger({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="tablewrap">
      <table className="tbl rs-ledger">
        <thead><tr><th scope="col">{uiText("Check")}</th><th scope="col" className="r">{uiText("Result")}</th><th scope="col" className="r">{uiText("Threshold")}</th><th scope="col">{uiText("State")}</th><th scope="col">{uiText("Role")}</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-role={row.role}>
              <th scope="row">{rowLabel(row)}</th>
              <td className="r num mono">{rowValue(row)}{row.reference != null ? ` / ${fixed(row.reference, 2)}` : ''}</td>
              <td className="r mono faint">{rowThreshold(row)}</td>
              <td><StateWord {...rowStateOf(row.state)} /></td>
              <td className="small muted">{row.role === 'gate' ? uiText("Gate") : uiText("Context")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function reasons(h: ResearchHypothesis): Reason[] {
  const out: Reason[] = [{ tone: 'info', text: h.verdict?.reason ?? '', field: 'verdict.reason' }]
  if (h.ledger.some((r) => r.id === 'pbo' && r.state === 'not-computed')) out.push({ tone: 'info', text: uiText("PBO was not computed for this experiment; it is not counted as a pass."), field: 'evidence.pbo' })
  if (h.confirmation) out.push({ tone: h.confirmation.passed === false ? 'bad' : 'info', text: h.confirmation.passed === false ? uiText("The one-shot lockbox did not confirm it.") : uiText("The one-shot lockbox confirmed it."), field: 'confirmation.passed' })
  return out
}

/** The verdict band once a verdict exists; before one, the hypothesis's own best against the noise line now. */
export function Verdict({ h, d }: { h: ResearchHypothesis; d: Direction }) {
  if (!h.verdict) {
    const mine = d.frontier.byHypothesis[h.id]
    return (
      <div className="vstack">
        <p><Status status={h.status} /> · <span className="muted">{uiText("No verdict yet: validation evidence stays withheld.")}</span></p>
        <dl className="rs-kv">
          <dt>{uiText("Best in-sample score")}</dt><dd className="mono">{fixed(mine)}</dd>
          <dt>{uiText("Expected best of N noise trials")}</dt><dd className="mono">{fixed(d.frontier.bar)}</dd>
        </dl>
      </div>
    )
  }
  const label = h.confirmation ? h.status : h.verdict.label
  return (
    <VerdictBand
      id={`rs-verdict-${h.id}`}
      kicker={h.confirmation ? uiText("Verdict · lockbox opened once") : uiText("Verdict · validation segment · development evidence")}
      verdict={bandOf(label)}
      word={statusOf(label).word}
      detail={uiTemplate("Recorded {0} UTC from experiment {1}.", [h.verdict.created.slice(0, 16).replace('T', ' '), String(h.verdict.evidence.experiment ?? '—')])}
      reasons={reasons(h)}
    />
  )
}

/** The lockbox figures, present only after `confirm` (server-side rule). */
export function Lockbox({ h, d }: { h: ResearchHypothesis; d: Direction }) {
  const lb = d.lockbox
  if (!lb) return <p className="muted small">{uiText("No lockbox: the direction has no data split yet.")}</p>
  const c = h.confirmation
  return (
    <dl className="rs-kv">
      <dt>{uiText("State")}</dt><dd>{lb.opened ? uiText("Opened once") : uiText("Sealed")}</dd>
      <dt>{uiText("Rows")}</dt><dd className="mono">{lb.n_dev} / {lb.n_total}</dd>
      {lb.start && [<dt key="s">{uiText("Lockbox from")}</dt>, <dd key="sv" className="mono">{lb.start}</dd>]}
      {c && [
        <dt key="a">{uiText("Lockbox Sharpe")}</dt>, <dd key="av" className="mono">{fixed(c.lockbox_sharpe as number, 2)} / {fixed(c.lockbox_buy_hold_sharpe as number, 2)}</dd>,
        <dt key="b">{uiText("Deflated Sharpe ratio")}</dt>, <dd key="bv" className="mono">{fixed(c.dsr as number)}</dd>,
        <dt key="c">{uiText("Positive sub-periods")}</dt>, <dd key="cv" className="mono">{fixed(c.lockbox_positive_fraction as number, 2)}</dd>,
      ]}
    </dl>
  )
}

export function Experiments({ h }: { h: ResearchHypothesis }) {
  if (h.experiments.length === 0) return <p className="muted small">{uiText("No experiment yet.")}</p>
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead><tr><th scope="col">{uiText("Experiment")}</th><th scope="col" className="r">{uiText("Evaluated")}</th><th scope="col" className="r">{uiText("Probes")}</th><th scope="col" className="r">{uiText("Best in-sample")}</th><th scope="col" className="r">{uiText("Spend")}</th><th scope="col">{uiText("Trials span (UTC)")}</th></tr></thead>
        <tbody>
          {h.experiments.map((e) => (
            <tr key={e.id}>
              <th scope="row" className="mono" translate="no">{e.id}</th>
              <td className="r mono">{e.n_evaluated}</td>
              <td className="r mono">{e.n_probed}</td>
              <td className="r mono">{fixed(e.best_is_score)}</td>
              <td className="r mono">{e.spend_known ? money(e.spend_usd) : `≥ ${money(e.spend_usd)}`}</td>
              <td className="mono small">{e.first_trial ? `${e.first_trial.slice(0, 16).replace('T', ' ')} → ${(e.last_trial ?? '').slice(0, 16).replace('T', ' ')}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The results ledger (`results.tsv`), newest first; skeptic and verdict notes of unjudged hypotheses arrive withheld. */
export function Events({ d, selected }: { d: Direction; selected: string }) {
  if (d.events.length === 0) return <p className="muted">{uiText("No events yet.")}</p>
  return (
    <ol className="timeline rs-events">
      {d.events.map((e, i) => (
        <li key={`${e.time}-${i}`} data-mine={e.hypothesis === selected || undefined}>
          <span className="mono faint small">{e.time.slice(0, 16).replace('T', ' ')}</span>
          <span className="kind" translate="no">{e.event}</span>
          <span className="trunc" translate="no">{e.withheld ? <span className="muted">{uiText("Withheld until this hypothesis has a verdict.")}</span> : e.note}</span>
          <span className="mono small" translate="no">{[e.hypothesis, e.experiment].filter(Boolean).join('/')}</span>
        </li>
      ))}
    </ol>
  )
}
