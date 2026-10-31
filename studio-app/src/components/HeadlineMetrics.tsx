import type { RankSummary } from '../api'
import { num } from '../format'
import { CompactTile, CompactTileGrid } from './CompactTile'

export type HeadlineSplit = {
  /** e.g. "Validation" */
  name: string
  role: string
  summary: RankSummary
}

/** Definitions read from the Run's own protocol (`protocol.semantics`); a tile gets a tooltip only when the field exists. */
export type Definitions = { inference?: string; measure?: string }

const int = (v: number) => v.toLocaleString('en-US')

/**
 * Every published rank-IC summary figure for each split handed in. The caller decides which splits may be drawn
 * (validation always; test only when the Run's testAudit exists), so the visibility rule lives with the page.
 */
export function HeadlineMetrics({ splits, horizon, defs }: { splits: HeadlineSplit[]; horizon: number; defs?: Definitions }) {
  return (
    <div className="hm">
      {splits.map(({ name, role, summary: s }) => {
        const weak = s.sufficient === false
        const measure = defs?.measure ? <p>{defs.measure}</p> : undefined
        const inference = defs?.inference ? <p>{defs.inference}</p> : undefined
        return (
          <div className="hm-split" key={name}>
            <h3 className="hm-title">{name} · {role} · {horizon}-bar horizon</h3>
            <CompactTileGrid label={`${name} headline figures`}>
              <CompactTile label="Mean rank IC" value={num(s.meanRankIc, 4)} info={measure} />
              <CompactTile label="Mean Pearson IC" value={num(s.meanPearsonIc, 4)} />
              <CompactTile label="Rank IC std" value={num(s.rankIcStandardDeviation, 3)} note="per-bar" />
              <CompactTile label="Rank IC IR" value={num(s.rankIcir, 3)} />
              <CompactTile label="Pearson IC IR" value={num(s.pearsonIcir, 3)} />
              <CompactTile label="Hit rate" value={num(s.rankHitRate, 3)} info={<p>Share of bars with rank IC above 0.</p>} />
              <CompactTile label="HAC t" value={num(s.hacTStatistic, 2)} info={inference} />
              <CompactTile label="HAC p" value={num(s.hacNormalPValue, 3)} note="two-sided" info={inference} />
              <CompactTile
                label="Observations"
                value={int(s.observations)}
                note={`min ${int(s.minimumObservations)}`}
                tone={weak ? 'weak' : 'neutral'}
                toneReason={weak ? 'below min' : undefined}
              />
            </CompactTileGrid>
          </div>
        )
      })}
    </div>
  )
}
