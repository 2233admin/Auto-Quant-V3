import { uiTemplate, uiText, uiValue } from '../../i18n'
import { Icon } from '../../design/icons'
import './floating.css'

export type LockedParam = { label: string; value: string }

/** Study authority in a compact two-column input rhythm; never editable here. */
export function ParamGrid({ params }: { params: LockedParam[] }) {
  return <div className="wb-param-grid" data-measure="params" aria-label={uiText("Study parameters")}>
    {params.map(p => <label className="wb-param" key={p.label} title={uiTemplate("{0}: {1}. Locked by the Study.", [p.label, p.value])}>
      <span>{uiValue(p.label)}</span><span className="wb-param-input"><input value={p.value} readOnly aria-label={p.label} /><Icon name="lock" /></span>
    </label>)}
  </div>
}
