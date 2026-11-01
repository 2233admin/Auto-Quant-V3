import './floating.css'

export function TitleCard({ title, subtitle, backHref, type }: { title: string; subtitle: string; backHref: string; type: string }) {
  return <header className="wb-title-card" data-measure="title">
    <a className="wb-title-back" href={backHref} aria-label="Back to Ideas">←</a>
    <div className="wb-title-copy"><h1>{title}</h1><p title={subtitle}>{subtitle}</p></div>
    <span className="wb-title-type">{type}</span>
  </header>
}
