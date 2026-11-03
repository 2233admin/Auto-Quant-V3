import { uiText, uiValue } from '../../i18n'
import { Icon } from '../../design/icons'
import { PageMark } from '../../design/marks'
import './floating.css'

export function TitleCard({ title, subtitle, backHref, type, backLabel, micro }: { title: string; subtitle: string; backHref: string; type: string; backLabel?: string; micro?: string }) {
  return <header className="wb-title-card" data-measure="title">
    <a className="wb-title-back" href={backHref} aria-label={backLabel ?? uiText("Back to Factors")}><Icon name="back" /></a>
    <div className="wb-title-copy"><h1 translate="no">{title}</h1><p title={subtitle} translate="no">{subtitle}</p></div>
    {micro && <PageMark kind="ruler" micro={micro} />}
    <span className="wb-title-type">{uiValue(type)}</span>
  </header>
}
