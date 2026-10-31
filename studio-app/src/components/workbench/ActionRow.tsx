import { useId, type ReactNode } from 'react'
import '../../actions/actions.css'
import './workbench.css'

/** A button is either enabled, or disabled WITH a reason: `disabled: true` without `disabledReason` does not compile. */
export type ActionButton = {
  label: ReactNode
  onClick?: () => void
  title?: string
} & ({ disabled?: false; disabledReason?: undefined } | { disabled: true; disabledReason: string })

/**
 * One `primary` button (a single object, so a second one cannot be passed), quiet `secondary` buttons and a trailing `chip`.
 * The first disabled button's reason shows as one truncated line under the row (full text in the tooltip).
 * Disabled buttons stay focusable (aria-disabled) so keyboard users reach the reason.
 */
export function ActionRow({ primary, secondary = [], chip }: { primary: ActionButton; secondary?: ActionButton[]; chip?: ReactNode }) {
  const reasonId = useId()
  const reason = [primary, ...secondary].find((b) => b.disabled)?.disabledReason
  const button = (b: ActionButton, cls: string, key?: number) => (
    <button
      key={key}
      type="button"
      className={`abtn ${cls}`}
      aria-disabled={b.disabled || undefined}
      aria-describedby={b.disabled ? reasonId : undefined}
      title={b.disabled ? b.disabledReason : b.title}
      onClick={b.disabled ? undefined : b.onClick}
    >
      {b.label}
    </button>
  )
  return (
    <div className="wb-actions">
      <div className="wb-actions-row">
        {button(primary, 'abtn--primary')}
        {secondary.map((b, i) => button(b, 'abtn--quiet', i))}
        {chip && <span className="wb-actions-chip">{chip}</span>}
      </div>
      {reason && (
        <p id={reasonId} className="wb-actions-reason" title={reason}>
          {reason}
        </p>
      )}
    </div>
  )
}
