import { uiTemplate, uiText } from '../i18n'
import type { FactorDiagnostics } from '../api'
import { Empty } from '../components/States'
import { Info } from '../components/Info'
import { pct } from '../format'

const int = (v: number) => v.toLocaleString('en-US')
const day = (iso: string) => iso.slice(0, 10)

/**
 * How much input data each asset had and how much of it the factor scored. Every number is a value the Run published
 * (`inputAvailability.byAsset`, or the older per-asset `coverage`); nothing is computed here. A Run that published
 * neither says so, and no coverage is implied.
 */
export function CoverageTable({ study }: { study: FactorDiagnostics }) {
  const availability = study.inputAvailability
  const rows = availability.available ? availability.byAsset ?? [] : []
  if (rows.length > 0) {
    return (
      <div className="stack">
        {typeof availability.observedRows === 'number' && typeof availability.possibleRows === 'number' && (
          <p className="small muted">
            {uiTemplate("{0} of {1} possible asset-bar rows are observed ({2}); {3} of {4} bars have every asset.", [int(availability.observedRows), int(availability.possibleRows), pct(availability.observationCoverage), int(availability.completeTimestamps ?? 0), int(availability.timestamps ?? 0)])}
          </p>
        )}
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Asset")}</th>
                <th scope="col" className="r">{uiText("Bars")}</th>
                <th scope="col">{uiText("First bar")}</th>
                <th scope="col">{uiText("Last bar")}</th>
                <th scope="col" className="r">{uiText("Input coverage")} <Info label={uiText("About input coverage")}><p>{uiText("The share of the panel's bars at which this asset has a price. A missing bar is left empty, never filled.")}</p></Info></th>
                <th scope="col" className="r">{uiText("Factor coverage")} <Info label={uiText("About factor coverage")}><p>{uiText("The share of this asset's bars at which the candidate produced a finite factor value.")}</p></Info></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.asset}>
                  <th scope="row" className="mono">{r.asset}</th>
                  <td className="r mono">{int(r.observations)}</td>
                  <td className="mono">{day(r.start)}</td>
                  <td className="mono">{day(r.end)}</td>
                  <td className="r mono">{pct(r.inputCoverage)}</td>
                  <td className="r mono">{pct(r.factorCoverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  const legacy = study.coverage ?? []
  if (legacy.length > 0) {
    return (
      <div className="stack">
        <p className="small muted">{uiText("This Run published factor coverage only; it did not publish input coverage per asset.")}</p>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Asset")}</th>
                <th scope="col" className="r">{uiText("Factor coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {legacy.map((r) => (
                <tr key={r.asset}>
                  <th scope="row" className="mono">{r.asset}</th>
                  <td className="r mono">{pct(r.coverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  return <Empty title={uiText("Coverage not published")}><p>{uiText("This Run did not publish per-asset input or factor coverage, so none is shown.")}</p></Empty>
}
