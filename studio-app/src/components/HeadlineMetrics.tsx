import type { RankSummary } from '../api'
import { num } from '../format'
import { MetricTile } from './MetricTile'

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
        return (
          <div className="hm-split" key={name}>
            <h3 className="hm-title">{name} · {role} · {horizon}-bar horizon</h3>
            <dl className="hm-grid">
              <MetricTile label="Mean rank IC" value={num(s.meanRankIc, 4)} definition={defs?.measure} />
              <MetricTile label="Mean Pearson IC" value={num(s.meanPearsonIc, 4)} />
              <MetricTile label="Rank IC std" value={num(s.rankIcStandardDeviation, 3)} note="per-bar spread" />
              <MetricTile label="Rank IC IR" value={num(s.rankIcir, 3)} />
              <MetricTile label="Pearson IC IR" value={num(s.pearsonIcir, 3)} />
              <MetricTile label="Hit rate" value={num(s.rankHitRate, 3)} note="share of bars with rank IC above 0" />
              <MetricTile label="HAC t" value={num(s.hacTStatistic, 2)} definition={defs?.inference} />
              <MetricTile label="HAC p" value={num(s.hacNormalPValue, 3)} note="two-sided, normal approximation" definition={defs?.inference} />
              <MetricTile
                label="Observations"
                value={int(s.observations)}
                note={`minimum ${int(s.minimumObservations)}`}
                tone={weak ? 'weak' : 'neutral'}
                toneReason={weak ? 'below the minimum' : undefined}
              />
            </dl>
          </div>
        )
      })}
    </div>
  )
}
