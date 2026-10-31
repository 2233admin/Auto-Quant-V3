import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../design/icons'
import './hero.css'

export type HeroTone = 'bad' | 'ok' | 'warn'
const TONE_GLYPH: Record<HeroTone, GlyphKind> = { bad: 'error', ok: 'supported', warn: 'inconclusive' }

/**
 * The one-line, plain-language statement of where a page stands. The word and the glyph shape carry the state; the
 * border colour only repeats it. `why` is the optional full text and field names behind the line.
 */
export function HeroLine({ tone, word, children, why }: { tone: HeroTone; word: string; children?: ReactNode; why?: ReactNode }) {
  return (
    <p className="hero-line" data-tone={tone} role="status">
      <Glyph kind={TONE_GLYPH[tone]} signal={tone === 'bad'} />
      <span className="hero-text">
        <span className="hero-word">{word}</span>
        {children ? <>: {children}</> : null}
        {why}
      </span>
    </p>
  )
}

export type HeroTile = { label: string; value: ReactNode; note?: ReactNode }

/** One row of at most six core numbers. Values arrive formatted; nothing is computed here. */
export function HeroTiles({ items, label }: { items: HeroTile[]; label: string }) {
  const shown = items.slice(0, 6)
  return (
    <dl className="hero-tiles" data-n={shown.length} aria-label={label}>
      {shown.map((t) => (
        <div key={t.label}>
          <dt title={t.label}>{t.label}</dt>
          <dd>{t.value}</dd>
          {t.note && <span className="hero-note">{t.note}</span>}
        </div>
      ))}
    </dl>
  )
}
