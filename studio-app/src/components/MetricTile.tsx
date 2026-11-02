import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../design/icons'
import './components.css'

/** What a tile says about its number. Always spelled out in words and a shape, never colour alone. */
export type Tone = 'neutral' | 'caution' | 'weak'
const TONE: Record<Exclude<Tone, 'neutral'>, { glyph: GlyphKind; word: string; signal: boolean }> = {
  caution: { glyph: 'inconclusive', word: 'Caution', signal: false },
  weak: { glyph: 'error', word: 'Weak', signal: true },
}

/**
 * One published number: label, mono value, optional note, optional delta text (already formatted by the caller)
 * and an optional definition shown on hover, focus and as a plain-text title. No statistics are computed here.
 */
export function MetricTile({
  label,
  value,
  note,
  delta,
  definition,
  tone = 'neutral',
  toneReason,
}: {
  label: string
  value: string
  note?: ReactNode
  delta?: string
  definition?: string
  tone?: Tone
  toneReason?: string
}) {
  const t = tone === 'neutral' ? null : TONE[tone]
  return (
    <div className="mt" title={definition}>
      <dt className="mt-label">
        {label}
        {definition && (
          <span className="mt-def" tabIndex={0} role="note" aria-label={`${label}: ${definition}`}>
            ?<span className="mt-tip" aria-hidden>{definition}</span>
          </span>
        )}
      </dt>
      <dd className="mt-value mono">{value}</dd>
      {delta && <span className="mt-delta mono small">{delta}</span>}
      {t && (
        <span className="mt-tone small">
          <Glyph kind={t.glyph} signal={t.signal} />
          <span className={t.signal ? 'sig' : undefined}>{t.word}</span>
          {toneReason ? <span className="faint"> · {toneReason}</span> : null}
        </span>
      )}
      {note && <span className="faint small mt-note">{note}</span>}
    </div>
  )
}
