import { uiText, uiValue } from '../../i18n'
import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../../design/icons'
import { Info } from '../../components/Info'
import { routeHref } from '../../route'
import { finite, up } from '../portfolio/pfmt'
import type { ArtifactRef } from './laneTypes'
import './lanes.css'
import { Empty } from '../../components/States'

/** Page title block shared by both lane pages. */
export function LaneHead({ title, projectId, projectName, lines }: { title: string; projectId: string; projectName: string; lines: ReactNode[] }) {
  return (
    <header className="pg-head">
      <h1>{title}</h1>
      <p className="muted small">{uiText("Project ")}<a href={routeHref({ view: 'project', id: projectId })}>{projectName}</a> · {uiValue(lines[0])}
        {lines.length > 1 && (
          <Info label={uiText("About this page")}>
            {lines.slice(1).map((line, i) => (
              <p key={i}>{uiValue(line)}</p>
            ))}
          </Info>
        )}
      </p>
    </header>
  )
}

/** The one empty state for a Project that never ran the lane. */
export function LaneEmpty({ title, projectId, projectName, what }: { title: string; projectId: string; projectName: string; what: string }) {
  return (
    <div className="pg">
      <LaneHead title={title} projectId={projectId} projectName={projectName} lines={['Research diagnostics; no trading authority.']} />
      <Empty title={uiText("No evidence in this Project")}>
        <p>{uiText("This Project has no ")}{uiText(what)}{uiText(" Run, so there is nothing to draw. Nothing is estimated in its place.")}</p>
        <p className="small">
          <a href={routeHref({ view: 'project', id: projectId })}>{uiText("Back to the Project")}</a>
        </p>
      </Empty>
    </div>
  )
}

export type Reason = { tone: 'bad' | 'info'; text: ReactNode; field: string }

/**
 * Summary band head. These two lanes publish no pass/fail enum, so the word is the server's own status where it has
 * one, and otherwise the plain fact that the evidence is descriptive. Nothing is graded here.
 */
export function StatusBand({
  id,
  kicker,
  word,
  glyph,
  signal = false,
  lead,
  reasons,
}: {
  id: string
  kicker: string
  word: string
  glyph: GlyphKind
  signal?: boolean
  lead: ReactNode
  reasons: Reason[]
}) {
  return (
    <section className={`verdict verdict--${signal ? 'fail' : 'inconclusive'}`} aria-labelledby={id}>
      <div className="verdict-main">
        <p className="verdict-kicker">{kicker}</p>
        <h2 id={id} className="verdict-word">
          <Glyph kind={glyph} signal={signal} />
          <span>{uiValue(word)}</span>
        </h2>
        <p className="muted small">
          <Info label={uiText("About this status")}>
            <p>{lead}</p>
          </Info>
        </p>
      </div>
      <ul className="verdict-reasons">
        {reasons.map((r, i) => (
          <li key={i}>
            <Glyph kind={r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
            <span>
              {uiValue(r.text)}
              <Info label={uiText("Field behind this line")}>
                <p className="mono verdict-field">{r.field}</p>
              </Info>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Na({ why }: { why: string }) {
  return <span className="pf-na">{uiText("not available: ")}{why}</span>
}

export function NaBox({ why }: { why: string }) {
  return (
    <Empty title={uiText("Not available")}>
      <p>{uiText("not available: ")}{why}</p>
    </Empty>
  )
}

export type ShareRow = { name: string; share: number | null | undefined; mark?: number | null | undefined; text: string }

/**
 * Published fractions as horizontal bars. Bar length is the value divided by the largest value shown (scale only);
 * the number is always printed beside the bar, and an optional tick marks a second published fraction.
 */
export function ShareBars({ rows, label, markLabel, fillLabel }: { rows: ShareRow[]; label: string; markLabel?: string; fillLabel: string }) {
  const top = Math.max(...rows.flatMap((r) => [r.share, r.mark]).filter(finite), 0) || 1
  const pct = (v: number | null | undefined) => (finite(v) ? `${Math.min(100, Math.max(0, (v / top) * 100))}%` : '0%')
  return (
    <>
      <p className="lane-key">
        <span><i className="k-fill" aria-hidden />{fillLabel}</span>
        {markLabel && <span><i className="k-mark" aria-hidden />{markLabel}</span>}
      </p>
      <ul className="lane-bars" aria-label={label}>
        {rows.map((r) => (
          <li key={r.name}>
            <span className="nm">{r.name}</span>
            <span className="tr" aria-hidden>
              <span className="fl" style={{ width: pct(r.share) }} />
              {finite(r.mark) && <span className="mk" style={{ left: pct(r.mark) }} />}
            </span>
            <span className="vl">{uiValue(r.text)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export type DivRow = { name: string; value: number | null | undefined; text: string }

/** Signed values as two-sided bars around a zero line. Losses are hatched and keep their minus sign in the text. */
export function DivergingBars({ rows, label }: { rows: DivRow[]; label: string }) {
  const top = Math.max(...rows.map((r) => (finite(r.value) ? Math.abs(r.value) : 0)), 0) || 1
  return (
    <ul className="lane-bars lane-div" aria-label={label}>
      {rows.map((r) => {
        const w = finite(r.value) ? `${(Math.abs(r.value) / top) * 50}%` : '0%'
        return (
          <li key={r.name}>
            <span className="nm">{r.name}</span>
            <span className="tr" aria-hidden>
              <span className="zero" />
              <span className={`fl ${finite(r.value) && r.value < 0 ? 'neg' : 'pos'}`} style={{ width: w }} />
            </span>
            <span className="vl">{uiValue(r.text)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function ArtifactList({ artifacts }: { artifacts: Record<string, ArtifactRef> | undefined }) {
  const rows = Object.entries(artifacts ?? {})
  if (!rows.length) return <Na why="the payload lists no artifacts" />
  return (
    <div className="tablewrap lane-narrow">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">{uiText("Artifact")}</th>
            <th scope="col">{uiText("Path in the Run")}</th>
            <th scope="col">{uiText("What it holds")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, a]) => (
            <tr key={key}>
              <td className="mono">{key}</td>
              <td className="mono">{a.path ?? '—'}</td>
              <td>{a.description ?? (a.immutable ? 'Immutable Run artifact' : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Weight map as one sentence-safe table: asset, weight, plus the cash row. */
export function WeightsTable({ weights, cash, currency }: { weights: Record<string, number> | undefined; cash: number | null | undefined; currency?: string }) {
  const rows = Object.entries(weights ?? {})
  if (!rows.length) return <Na why="the payload lists no weights" />
  return (
    <div className="tablewrap lane-narrow">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">{uiText("Holding")}</th>
            <th scope="col" className="r">{uiText("Reported weight")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([asset, w]) => (
            <tr key={asset}>
              <td className="mono">{asset}</td>
              <td className="r">{up(w, 1)}</td>
            </tr>
          ))}
          <tr>
            <td>{uiText("Cash")}{currency ? ` (${currency})` : ''}</td>
            <td className="r">{up(cash, 1)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
