import type { ReactNode } from 'react'
import { CompactTile, CompactTileGrid } from '../CompactTile'
import { Info } from '../Info'
import './workbench.css'

/** A group with a label longer than this gets wider columns, so the label wraps at words and never one letter per line. */
const LONG_LABEL = 16

const pad = (n: number, cols: number) => (cols - (n % cols)) % cols

/** `info` adds a "?" next to the heading (accessible name `infoLabel`, default "About <heading>"). */
export type MetricGroup = { heading: string; label?: string; info?: ReactNode; infoLabel?: string; tiles: Parameters<typeof CompactTile>[0][] }

/**
 * Metric groups (heading + CompactTileGrid). Fixed columns: 3 from 1280px viewport width, 2 below, last row padded. Put
 * short hints ("two-sided", "min 20") in a tile's `info`, not in a `note` beside the value. Tile labels wrap, never truncate. `hiddenNote` is the slot for
 * the "test split hidden" note and renders under the groups.
 */
export function MetricGrid({ groups, hiddenNote }: { groups: MetricGroup[]; hiddenNote?: ReactNode }) {
  return (
    <div className="wb-metrics">
      {groups.map((g) => (
        <div key={g.heading} className={`wb-metric-group${g.tiles.some((t) => t.label.length > LONG_LABEL) ? ' has-long' : ''}`}>
          <h3 className="wb-metric-h">
            {g.heading}
            {g.info && (
              <>
                {' '}
                <Info label={g.infoLabel ?? `About ${g.heading}`}>{g.info}</Info>
              </>
            )}
          </h3>
          <CompactTileGrid label={g.label ?? g.heading}>
            {g.tiles.map((t) => (
              <CompactTile key={t.label} {...t} />
            ))}
            {/* Empty cells close the last row, so there is no orphan tile at 2 or 3 columns (CSS shows the set that fits). */}
            {Array.from({ length: pad(g.tiles.length, 3) }, (_, i) => (
              <div key={`p3-${i}`} className="ct ct-pad ct-pad3" aria-hidden="true" />
            ))}
            {Array.from({ length: pad(g.tiles.length, 2) }, (_, i) => (
              <div key={`p2-${i}`} className="ct ct-pad ct-pad2" aria-hidden="true" />
            ))}
          </CompactTileGrid>
        </div>
      ))}
      {hiddenNote && <p className="wb-metric-note faint small">{hiddenNote}</p>}
    </div>
  )
}
