import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../design/icons'
import { CompactTile, CompactTileGrid } from '../components/CompactTile'
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

export type HeroTile = { label: string; value: string; note?: ReactNode }

/** Columns that fill the last row exactly (6 -> 3, 12 -> 4, 10 -> 5), else 4. */
function columnsFor(n: number): number {
  for (let c = 5; c >= 2; c--) if (n >= c && n % c === 0) return c
  return 4
}

/** The core numbers as compact one-row tiles. Values arrive formatted; nothing is computed here. */
export function HeroTiles({ items, label }: { items: HeroTile[]; label: string }) {
  const shown = items.slice(0, 12)
  return (
    <div className="hero-tiles" style={{ ['--hc' as string]: columnsFor(shown.length), ['--hc2' as string]: shown.length % 3 === 0 ? 3 : shown.length % 2 === 0 ? 2 : 1 }}>
      <CompactTileGrid label={label}>
        {shown.map((t) => (
          <CompactTile key={t.label} label={t.label} value={t.value} note={t.note} />
        ))}
      </CompactTileGrid>
    </div>
  )
}
