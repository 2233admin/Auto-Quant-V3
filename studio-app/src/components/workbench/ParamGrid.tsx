import { Icon } from '../../design/icons'
import './floating.css'

export type LockedParam = { label: string; value: string }

/** Study authority in a compact two-column input rhythm; never editable here. */
export function ParamGrid({ params }: { params: LockedParam[] }) {
  return <div className="wb-param-grid" data-measure="params" aria-label="Study parameters">
    {params.map(p => <label className="wb-param" key={p.label} title={`${p.label}: ${p.value}. Locked by the Study.`}>
      <span>{p.label}</span><span className="wb-param-input"><input value={p.value} readOnly aria-label={p.label} /><Icon name="lock" /></span>
    </label>)}
  </div>
}
