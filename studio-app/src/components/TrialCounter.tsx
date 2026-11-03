import { uiTemplate, uiText, uiValue } from '../i18n'
import type { ProjectSnapshot, SelectionIntegrity } from '../api'
import { Glyph } from '../design/icons'
import { plural } from '../format'
import { Info } from './Info'
import './components.css'

/** The first Session ledger that carries a research family; the family is Project-wide, so any Session reads the same. */
export function pickIntegrity(project: ProjectSnapshot): SelectionIntegrity | undefined {
  const all = project.sessions.map((s) => s.selectionIntegrity).filter((s): s is SelectionIntegrity => !!s)
  return all.find((s) => s.selectionMetric === 'validation_mean_ic' && s.researchFamily) ?? all.find((s) => s.researchFamily) ?? all[0]
}

/**
 * One slim line: the in-sample warning plus the adjustment verdict, with the trial count, method and holdout
 * wording behind the "?" button. Quotes `researchFamily.totalExecutions`, `.uniqueSourceTrials` and
 * `selectionAdjustment.{status,passes,statistics}`.
 */
export function TrialCounter({ project }: { project: ProjectSnapshot }) {
  const si = pickIntegrity(project)
  const fam = si?.researchFamily
  const adj = si?.selectionAdjustment
  if (!si || !fam) {
    return (
      <div className="trial" role="note">
        <Glyph kind="inconclusive" />
        <span>{uiText("No trial ledger: numbers are in-sample and unadjusted.")}</span>
        <Info label={uiText("About the missing trial ledger")} align="end">
          <p>{uiText("No Session records the trials of this Project, so the numbers on this page are in-sample and unadjusted.")}</p>
        </Info>
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
  const short = passes
    ? 'Adjustment passes; diagnostic evidence only.'
    : adj?.passes === false
      ? 'In-sample until the selection adjustment passes; it currently fails.'
      : 'In-sample until the selection adjustment passes; none is available.'
  return (
    <div className={`trial${passes ? ' is-pass' : ''}`} role="note">
      <Glyph kind={passes ? 'supported' : 'inconclusive'} />
      <span>{uiValue(short)}</span>
      <Info label={uiText("About the trial count and adjustment")} align="end">
        <p>
          {plural(fam.totalExecutions, 'trial')}{uiText(" counted in this research family (")}{fam.uniqueSourceTrials}{uiText(" unique ")}{fam.uniqueSourceTrials === 1 ? uiText("source") : uiText("sources")}).
        </p>
        {!!fam.inheritedSourceTrials && <p>{uiTemplate("Plus {0} source trials inherited from Factor Project {1}; the adjustment counts {2}.", [fam.inheritedSourceTrials, fam.inheritance?.sourceProjectId ?? '—', fam.effectiveSourceTrials ?? '—'])}</p>}
        <p>{uiValue(status)}</p>
        <p>
          {passes
            ? uiText("The adjustment is diagnostic evidence only and carries no trading authority.")
            : uiText("Numbers on this page are in-sample: they were selected from these trials and have not passed the adjustment.")}
          {si.externalHoldoutRequired ? uiText(" An external holdout is still required before a production-grade claim.") : ''}
        </p>
      </Info>
    </div>
  )
}
