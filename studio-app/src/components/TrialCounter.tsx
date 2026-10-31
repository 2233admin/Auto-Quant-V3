import type { ProjectSnapshot, SelectionIntegrity } from '../api'
import { Glyph } from '../design/icons'
import { plural } from '../format'
import './components.css'

/** The first Session ledger that carries a research family; the family is Project-wide, so any Session reads the same. */
export function pickIntegrity(project: ProjectSnapshot): SelectionIntegrity | undefined {
  const all = project.sessions.map((s) => s.selectionIntegrity).filter((s): s is SelectionIntegrity => !!s)
  return all.find((s) => s.selectionMetric === 'validation_mean_ic' && s.researchFamily) ?? all.find((s) => s.researchFamily) ?? all[0]
}

/**
 * "N trials counted in this research family (K unique sources)" with the adjustment status. Quotes
 * `researchFamily.totalExecutions`, `.uniqueSourceTrials` and `selectionAdjustment.{status,passes,statistics}`.
 */
export function TrialCounter({ project }: { project: ProjectSnapshot }) {
  const si = pickIntegrity(project)
  const fam = si?.researchFamily
  const adj = si?.selectionAdjustment
  if (!si || !fam) {
    return (
      <div className="trial" role="note">
        <p className="trial-head"><Glyph kind="inconclusive" /> No trial ledger</p>
        <p className="muted small">No Session records the trials of this Project, so the numbers below are in-sample and unadjusted.</p>
      </div>
    )
  }
  const passes = adj?.passes === true
  const adjusted = adj?.statistics ? `; adjusted p ${adj.statistics.familywiseAdjustedPValue.toFixed(3)}` : ''
  const method = adj?.method ?? 'method not named'
  const status =
    adj?.passes === true
      ? `Selection adjustment passes (${method}${adjusted}).`
      : adj?.passes === false
        ? `Selection adjustment fails (${method}${adjusted}).`
        : `Selection adjustment: ${adj?.status ?? 'not available'}${adj?.reason ? ` (${adj.reason})` : ''}.`
  return (
    <div className={`trial${passes ? ' is-pass' : ''}`} role="note">
      <p className="trial-head">
        <Glyph kind={passes ? 'supported' : 'inconclusive'} />
        {plural(fam.totalExecutions, 'trial')} counted in this research family ({fam.uniqueSourceTrials} unique {fam.uniqueSourceTrials === 1 ? 'source' : 'sources'})
      </p>
      <p className="small">{status}</p>
      <p className="small muted">
        {passes
          ? 'The adjustment is diagnostic evidence only and carries no trading authority.'
          : 'Numbers on this page are in-sample: they were selected from these trials and have not passed the adjustment.'}
        {si.externalHoldoutRequired ? ' An external holdout is still required before a production-grade claim.' : ''}
      </p>
    </div>
  )
}
