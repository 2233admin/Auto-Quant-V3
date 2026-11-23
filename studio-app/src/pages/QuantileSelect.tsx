import { uiTemplate, uiText } from '../i18n'
import { DEFAULT_QUANTILES, QUANTILE_CHOICES } from './ideaEditor'

/** The tear-sheet group count of a new idea. It is frozen with the Study; Core and the server check it. */
export function QuantileSelect({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <>
      <label className="afield">{uiText("Tear-sheet groups")}
        <select aria-label={uiText("Tear-sheet groups")} className="fe-input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {QUANTILE_CHOICES.map((count) => <option key={count} value={count}>{uiTemplate(count === DEFAULT_QUANTILES ? '{0} groups (default)' : '{0} groups', [count])}</option>)}
        </select>
      </label>
      <p className="small muted">{uiText("Frozen with the Study. Needs at least one prediction asset per group.")}</p>
    </>
  )
}
