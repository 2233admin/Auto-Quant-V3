import { useId, type ReactNode } from 'react'
import '../../actions/actions.css'
import './workbench.css'

/** A button is either enabled, or disabled WITH a reason: `disabled: true` without `disabledReason` does not compile. */
export type ActionButton = {
  label: ReactNode
  /** Accessible name when `label` is an icon. The tooltip defaults to it. */
  ariaLabel?: string
  onClick?: () => void
  title?: string
} & (
  | { disabled?: false; disabledReason?: undefined; showReason?: undefined }
  | {
      disabled: true
      disabledReason: string
      /** Show the reason as the one-line row under the buttons. Default: yes for the primary button (a real blocker), no for the others (quiet state; the reason stays in the tooltip and the accessible text). */
      showReason?: boolean
    }
)

/**
 * One `primary` button (a single object, so a second one cannot be passed), quiet `secondary` buttons and a trailing `chip`.
 * Every disabled button carries its reason as tooltip and accessible text. The reason of the first disabled button that
 * asks for it (`showReason`, on by default for `primary`) also shows as one truncated line under the row.
 * Disabled buttons stay focusable (aria-disabled) so keyboard users reach the reason.
 */
export function ActionRow({ primary, secondary = [], chip }: { primary: ActionButton; secondary?: ActionButton[]; chip?: ReactNode }) {
  const reasonId = useId()
  const shown = [primary, ...secondary].find((b) => b.disabled && (b.showReason ?? b === primary))
  const reason = shown?.disabled ? shown.disabledReason : undefined
  const button = (b: ActionButton, cls: string, key?: number) => (
    <button
      key={key}
      type="button"
      className={`abtn ${cls}`}
      aria-label={b.ariaLabel}
      aria-disabled={b.disabled || undefined}
      aria-describedby={b === shown ? reasonId : undefined}
      title={b.disabled ? `${b.ariaLabel ? `${b.ariaLabel}: ` : ''}${b.disabledReason}` : b.title ?? b.ariaLabel}
      onClick={b.disabled ? undefined : b.onClick}
    >
      {b.label}
      {b.disabled && b !== shown && !b.ariaLabel && <span className="sr-only"> ({b.disabledReason})</span>}
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
