import { uiText, uiValue } from '../../i18n'
import './floating.css'

export function TitleCard({ title, subtitle, backHref, type }: { title: string; subtitle: string; backHref: string; type: string }) {
  return <header className="wb-title-card" data-measure="title">
    <a className="wb-title-back" href={backHref} aria-label={uiText("Back to Factors")}>←</a>
    <div className="wb-title-copy"><h1 translate="no">{title}</h1><p title={subtitle} translate="no">{subtitle}</p></div>
    <span className="wb-title-type">{uiValue(type)}</span>
  </header>
}
