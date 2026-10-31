import type { ReactNode } from 'react'
import { CompactTile, CompactTileGrid } from '../CompactTile'
import './workbench.css'

export type MetricGroup = { heading: string; label?: string; tiles: Parameters<typeof CompactTile>[0][] }

/**
 * Metric groups (heading + CompactTileGrid). Tile labels wrap to two lines, never truncate. `hiddenNote` is the slot for
 * the "test split hidden" note and renders under the groups.
 */
export function MetricGrid({ groups, hiddenNote }: { groups: MetricGroup[]; hiddenNote?: ReactNode }) {
  return (
    <div className="wb-metrics">
      {groups.map((g) => (
        <div key={g.heading} className="wb-metric-group">
          <h3 className="wb-metric-h">{g.heading}</h3>
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
