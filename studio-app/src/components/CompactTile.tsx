import { uiTemplate, uiText, uiValue } from '../i18n'
import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../design/icons'
import { Info } from './Info'
import { MetricInfo } from './MetricInfo'
import type { MetricId } from '../metrics/catalogue'
import { AnimatedValue } from './motion/AnimatedValue'
import type { Tone } from './MetricTile'
import './compactTile.css'

const TONE: Record<Exclude<Tone, 'neutral'>, { glyph: GlyphKind; word: string; signal: boolean }> = {
  caution: { glyph: 'inconclusive', get word() { return uiText("Caution") }, signal: false },
  weak: { glyph: 'error', get word() { return uiText("Weak") }, signal: true },
}

/**
 * One published number on one row (about 34px): label left, mono value right-aligned. Tone is shown by glyph and word,
 * never colour alone. `note` and `delta` are short and sit beside the value; `metric` opens the catalogue definition (with
 * `info` as page context), otherwise `info` alone opens a popover.
 * No statistics are computed here.
 */
export function CompactTile({
  label,
  value,
  note,
  delta,
  tone = 'neutral',
  toneReason,
  info,
  metric,
}: {
  label: string
  value: string
  note?: ReactNode
  delta?: string
  tone?: Tone
  toneReason?: string
  info?: ReactNode
  /** Catalogue id: the "?" then opens the shared definition, with `info` as this page's context. */
  metric?: MetricId
}) {
  const t = tone === 'neutral' ? null : TONE[tone]
  return (
    <div className="ct">
      <dt className="ct-label">
        <span className="ct-label-text">{uiValue(label)}</span>
        {metric ? <MetricInfo id={metric} label={label} extra={info} /> : info && <Info label={uiTemplate("{0}: definition", [label])}>{info}</Info>}
      </dt>
      <dd className="ct-right">
        {t && (
          <span className="ct-tone">
            <Glyph kind={t.glyph} signal={t.signal} />
            <span className={t.signal ? 'sig' : undefined}>{uiValue(t.word)}</span>
            {toneReason ? <span className="faint"> {uiValue(toneReason)}</span> : null}
          </span>
        )}
        {note && <span className="ct-note faint">{uiValue(note)}</span>}
        {delta && <span className="ct-delta mono">{delta}</span>}
        <AnimatedValue className="ct-value mono" value={value} />
      </dd>
    </div>
  )
}

/** Auto-fit grid of CompactTile rows (min 200px) separated by 1px dividers. Renders a `dl`. */
export function CompactTileGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <dl className="ctg" aria-label={label}>
      {children}
    </dl>
  )
}
