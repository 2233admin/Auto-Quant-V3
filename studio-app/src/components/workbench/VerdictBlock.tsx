import { uiText, uiValue } from '../../i18n'
import { useId, useState, type ReactNode } from 'react'
import { Icon } from '../../design/icons'
import { Brackets, Contour } from '../../design/marks'
import { CountUp } from '../../motion/CountUp'
import { formattedSignRole } from '../../design/signConvention'
import { Collapse } from '../motion/Collapse'
import { MetricInfo, type MetricId } from '../MetricInfo'
import type { VerdictReason, VerdictTone } from './VerdictBar'
import './workbench.css'

export type VerdictStat = { label: string; micro: string; value: string; hint?: string; signed?: boolean; metric?: MetricId }

/**
 * The focal verdict block of a result page (direction H): chamfered ground, corner brackets, a left bar that grows, one scan
 * pass, a white tile with the state pictogram, the word and its clause, the focal number (sign-coloured, counts up once) and
 * the neighbouring numbers. "More" opens the reasons exactly as VerdictBar does. State is the word and the pictogram, never colour.
 */
export function VerdictBlock({ tone, word, clause, detail, reasons = [], focal, stats }: { tone: VerdictTone; word: string; clause: ReactNode; detail?: ReactNode; reasons?: VerdictReason[]; focal?: VerdictStat; stats: VerdictStat[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="verdict-block" data-tone={tone}>
      <div className="verd ch" role="status">
        <Contour width={1100} height={128} seed={7} opacity={0.045} className="verd-topo" />
        <Brackets />
        <i className="scan" aria-hidden="true" />
        <span className="vi" aria-hidden="true"><Icon name={tone === 'ok' ? 'check' : 'warn'} /></span>
        <div className="vt">
          <span className="mk" translate="no">Verdict</span>
          <h2>{uiValue(word)}</h2>
          <p title={typeof clause === 'string' ? clause : undefined}>{clause}</p>
          <button type="button" className="wb-link verd-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>{open ? uiText("Less") : uiText("More")}</button>
        </div>
        <dl className="vn" aria-label={focal?.hint}>
          {focal && (
            <div className="big" data-sign-area="verdict-headline" title={focal.hint}>
              <dt><span className="mk" translate="no">{focal.micro}</span>{uiValue(focal.label)}{focal.metric && <> <MetricInfo id={focal.metric} label={uiValue(focal.label)} extra={focal.hint} align="end" /></>}</dt>
              <dd className="type-value-focal" data-sign={focal.signed ? formattedSignRole(focal.value) : undefined}><CountUp value={focal.value} /></dd>
            </div>
          )}
          {stats.map((s) => (
            <div key={s.label} title={s.hint}>
              <dt><span className="mk" translate="no">{s.micro}</span>{uiValue(s.label)}{s.metric && <> <MetricInfo id={s.metric} label={uiValue(s.label)} extra={s.hint} align="end" /></>}</dt>
              <dd className="type-value-lg"><CountUp value={s.value} /></dd>
            </div>
          ))}
        </dl>
      </div>
      <Collapse open={open} id={id} className="wb-verdict-more">
        <p>{detail ?? clause}</p>
        {reasons.length > 0 && (
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>
                <span className="reason-dot" aria-hidden="true" />
                <span>
                  {uiValue(r.text)}
                  {r.field && <span className="faint small mono"> {r.field}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Collapse>
    </div>
  )
}
