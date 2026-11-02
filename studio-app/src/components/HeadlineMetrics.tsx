import { uiTemplate, uiText, uiValue } from '../i18n'
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
            <h3 className="hm-title">{uiText(name)} · {uiValue(role)} · {horizon}{uiText("-bar horizon")}</h3>
            <CompactTileGrid label={uiTemplate("{0} headline figures", [name])}>
              <CompactTile label={uiText("Mean rank IC")} value={num(s.meanRankIc, 4)} info={measure} metric="meanRankIc" />
              <CompactTile label={uiText("Mean Pearson IC")} value={num(s.meanPearsonIc, 4)} metric="meanPearsonIc" />
              <CompactTile label={uiText("Rank IC std")} value={num(s.rankIcStandardDeviation, 3)} note={uiText("per-bar")} metric="rankIcStd" />
              <CompactTile label={uiText("Rank IC IR")} value={num(s.rankIcir, 3)} metric="rankIcir" />
              <CompactTile label={uiText("Pearson IC IR")} value={num(s.pearsonIcir, 3)} metric="pearsonIcir" />
              <CompactTile label={uiText("Hit rate")} value={num(s.rankHitRate, 3)} metric="rankHitRate" />
              <CompactTile label={uiText("HAC t")} value={num(s.hacTStatistic, 2)} info={inference} metric="hacT" />
              <CompactTile label={uiText("HAC p")} value={num(s.hacNormalPValue, 3)} note={uiText("two-sided")} info={inference} metric="hacP" />
              <CompactTile
                label={uiText("Observations")}
                value={int(s.observations)}
                note={uiTemplate("min {0}", [int(s.minimumObservations)])}
                tone={weak ? 'weak' : 'neutral'}
                toneReason={weak ? 'below min' : undefined}
                metric="observations"
              />
            </CompactTileGrid>
          </div>
        )
      })}
    </div>
  )
}
