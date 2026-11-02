import { uiValue } from '../../i18n'
import { useId, type ReactNode } from 'react'
import '../../actions/actions.css'
import './workbench.css'

/** A button is either enabled, or disabled WITH a reason: `disabled: true` without `disabledReason` does not compile. */
export type ActionButton = {
  label: ReactNode
  /** Accessible name when `label` is an icon. The tooltip defaults to it. */
  ariaLabel?: string
  onClick?: () => void
  /** Renders a link (`<a>`) instead of a button. A link is never disabled. */
  href?: string
  title?: string
} & (
  | { disabled?: false; disabledReason?: undefined; showReason?: undefined; reasonTitle?: undefined }
  | {
      disabled: true
      disabledReason: string
      /** Show the reason as the one-line row under the buttons. Default: yes for the primary button (a real blocker), no for the others (quiet state; the reason stays in the tooltip and the accessible text). */
      showReason?: boolean
      /** Full text for the tooltip when the one-line `disabledReason` is a shortened form of it. */
      reasonTitle?: string
    }
)

/**
 * One `primary` button (a single object, so a second one cannot be passed), quiet `secondary` buttons and a trailing `chip`.
 * Every disabled button carries its reason as tooltip and accessible text. The reason of the first disabled button that
 * asks for it (`showReason`, on by default for `primary`) also shows as one truncated line under the row.
 * Disabled buttons stay focusable (aria-disabled) so keyboard users reach the reason.
 */
export function ActionRow({
  primary,
  secondary = [],
  chip,
  align = 'end',
}: {
  /** Optional: a result row that has no primary action (the Factor result card keeps its one primary in the editor card). */
  primary?: ActionButton
  secondary?: ActionButton[]
  chip?: ReactNode
  /** `start` left-aligns the buttons (a row under a selector); default `end` sits them at the right of a pane header. */
  align?: 'start' | 'end'
}) {
  const reasonId = useId()
  const shown = [primary, ...secondary].find((b) => b && b.disabled && (b.showReason ?? b === primary))
  const reason = shown?.disabled ? shown.disabledReason : undefined
  const button = (b: ActionButton, cls: string, key?: number) =>
    b.href && !b.disabled ? (
      <a key={key} className={`abtn ${cls}`} href={b.href} aria-label={b.ariaLabel} title={b.title ?? b.ariaLabel}>
        {uiValue(b.label)}
      </a>
    ) : (
    <button
      key={key}
      type="button"
      className={`abtn ${cls}`}
      aria-label={b.ariaLabel}
      aria-disabled={b.disabled || undefined}
      aria-describedby={b === shown ? reasonId : undefined}
      title={b.disabled ? `${b.ariaLabel ? `${b.ariaLabel}: ` : ''}${b.reasonTitle ?? b.disabledReason}` : b.title ?? b.ariaLabel}
      onClick={b.disabled ? undefined : b.onClick}
    >
      {uiValue(b.label)}
      {b.disabled && b !== shown && !b.ariaLabel && <span className="sr-only"> ({b.disabledReason})</span>}
    </button>
    )
  return (
    <div className={`wb-actions${align === 'start' ? ' wb-actions--start' : ''}`}>
      <div className="wb-actions-row">
        {primary && button(primary, 'abtn--primary')}
        {secondary.map((b, i) => button(b, 'abtn--quiet', i))}
        {chip && <span className="wb-actions-chip">{chip}</span>}
      </div>
      {reason && (
        <p id={reasonId} className="wb-actions-reason" title={shown?.disabled ? shown.reasonTitle ?? reason : reason}>
          {uiValue(reason)}
        </p>
      )}
    </div>
  )
}
