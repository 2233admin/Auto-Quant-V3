import type { ReactNode } from 'react'
import { CompactTile, CompactTileGrid } from '../CompactTile'
import { Info } from '../Info'
import './workbench.css'

/** A group with a label longer than this gets wider columns, so the label wraps at words and never one letter per line. */
const LONG_LABEL = 16

/** `info` adds a "?" next to the heading (accessible name `infoLabel`, default "About <heading>"). */
export type MetricGroup = { heading: string; label?: string; info?: ReactNode; infoLabel?: string; tiles: Parameters<typeof CompactTile>[0][] }

/**
 * Metric groups (heading + CompactTileGrid). Tile labels wrap to two lines, never truncate. `hiddenNote` is the slot for
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
          </CompactTileGrid>
        </div>
      ))}
      {hiddenNote && <p className="wb-metric-note faint small">{hiddenNote}</p>}
    </div>
  )
}
