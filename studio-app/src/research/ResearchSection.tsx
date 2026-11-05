import { uiTemplate, uiText } from '../i18n'
import type { ResearchSummary } from '../api'
import { Section } from '../design/layout'
import { routeHref } from '../route'
import { Status } from './ResearchParts'
import { lockboxWord } from './words'

/** The Project page's pointer to its research direction: count, latest verdict, lockbox, and the way in. */
export function ResearchSection({ id, research }: { id: string; research: ResearchSummary }) {
  const latest = research.latestVerdict
  return (
    <Section title={uiText("Research direction")} id="sec-research" caption={research.demo ? uiText("Synthetic demo data: no number here is a real result.") : undefined}>
      <p translate="no">{research.direction ?? '—'}</p>
      <p className="small">
        {uiTemplate("{0} hypotheses · lockbox {1}", [research.hypotheses ?? 0, lockboxWord(research.lockbox)])}
        {' · '}
        {latest ? <>{uiText("latest verdict")} <Status status={latest.label} /> <span className="mono" translate="no">{latest.hypothesis}</span></> : uiText("no verdict yet")}
      </p>
      <p className="small"><a href={routeHref({ view: 'research', id })}>{uiText("Open the research direction")}</a></p>
    </Section>
  )
}
