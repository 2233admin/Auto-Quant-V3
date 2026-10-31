import { Info } from '../../components/Info'
import { useId } from 'react'
import { niceTicks } from '../factorMath'
import { finite, fn, sn, up } from '../portfolio/pfmt'
import type { Baseline, ContextualBaseline, Freq, Trial, TrainingRow } from './rlTypes'

const W = 980
const label = (t: { fold: string; seed: number }) => `${t.fold.replace('fold-', 'F')} · s${t.seed}`
export const baselineLabel = (v: string | undefined) => (v ?? '').replace('fixed:', '').replace('best-training-expert', 'training expert').replace('contextual-ridge', 'contextual ridge').replaceAll('_', ' ')

/* Five action sleeves get five fills that differ by texture as well as tone, so no chart relies on colour alone. */
function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <pattern id={`${uid}-ph`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--bg)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--text)" strokeWidth="2.4" />
      </pattern>
      <pattern id={`${uid}-pd`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--bg)" />
        <circle cx="3" cy="3" r="1.5" fill="var(--text)" />
      </pattern>
      <pattern id={`${uid}-px`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width="6" height="6" fill="var(--signal-graphic)" opacity=".28" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--signal-graphic)" strokeWidth="2.4" />
      </pattern>
    </defs>
  )
}
const fillOf = (i: number, uid: string) => [`var(--text)`, `var(--muted)`, `url(#${uid}-ph)`, `url(#${uid}-px)`, `url(#${uid}-pd)`][i % 5]

export function ActionSwatch({ index }: { index: number }) {
  const uid = useId()
  return (
    <svg width="16" height="12" aria-hidden="true" className="rl-sw">
      <Defs uid={uid} />
      <rect x=".5" y=".5" width="15" height="11" fill={fillOf(index, uid)} stroke="var(--text)" strokeWidth="1" />
    </svg>
  )
}

/* ---------------------------------------------------------------- RL against the validation-selected baseline */

export function TrialChart({ trials, baselines, folds, split }: { trials: Trial[]; baselines: Baseline[]; folds: string[]; split: 'validation' | 'test' }) {
  const id = useId()
  const H = 280
  const m = { l: 56, r: 16, t: 24, b: 56 }
  const sharpe = (t: Trial) => t[split]?.netSharpe
  const adv = (t: Trial) => (split === 'test' ? t.testAdvantage : t.validationAdvantage)
  const selected = baselines.filter((b) => b.selectedOnValidation)
  const vals = [...trials.map(sharpe), ...selected.map((b) => b[split]?.netSharpe)].filter(finite)
  if (!vals.length) return <p className="pf-na">not available: no trial publishes a {split} net Sharpe</p>
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 5)
  const lo = Math.min(ticks[0], ...vals)
  const hi = Math.max(ticks[ticks.length - 1], ...vals)
  const y = (v: number) => m.t + ((hi - v) / (hi - lo || 1)) * (H - m.t - m.b)
  const step = (W - m.l - m.r) / Math.max(1, trials.length)
  const x = (i: number) => m.l + step * (i + 0.5)
  return (
    <figure className="chart rl-chart">
      <figcaption>
        <h3 id={`${id}-t`} className="sr-only">Net Sharpe of every fold and seed against the selected baseline</h3>
        <p className="sr-only" id={`${id}-d`}>
          Each mark is one RL trial ({split}); the dashed bar is the baseline the fixed Judge chose for that fold on validation. A filled circle means RL is at or above that baseline, an open square means it trails.
        </p>
        <p className="muted small">
          Every declared fold and seed ({split}); a filled circle means RL is at or above the baseline, an open square means it trails.
          <Info label="About this chart">
            <p>Each mark is one RL trial ({split}); the dashed bar is the baseline the fixed Judge chose for that fold on validation.</p>
          </Info>
        </p>
      </figcaption>
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{fn(v, 1)}</text>
          </g>
        ))}
        <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">net Sharpe</text>
        {folds.map((f) => {
          const idx = trials.map((t, i) => [t, i] as const).filter(([t]) => t.fold === f).map(([, i]) => i)
          const b = selected.find((r) => r.fold === f)
          const v = b?.[split]?.netSharpe
          if (!idx.length || !finite(v)) return null
          return (
            <g key={f}>
              <line x1={x(idx[0]) - step * 0.4} x2={x(idx[idx.length - 1]) + step * 0.4} y1={y(v)} y2={y(v)} stroke="var(--signal-graphic)" strokeWidth="2.4" strokeDasharray="7 4" />
              <text x={x(idx[0]) - step * 0.4} y={y(v) - 6} className="ax">{baselineLabel(b?.name)} {fn(v, 1)}</text>
              <title>{f} · {baselineLabel(b?.name)} · {fn(v, 2)}</title>
            </g>
          )
        })}
        {trials.map((t, i) => {
          const v = sharpe(t)
          if (!finite(v)) return null
          const up_ = finite(adv(t)) && (adv(t) as number) >= 0
          return (
            <g key={`${t.fold}${t.seed}`}>
              {up_ ? <circle cx={x(i)} cy={y(v)} r="6" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" /> : <rect x={x(i) - 5.5} y={y(v) - 5.5} width="11" height="11" fill="var(--bg)" stroke="var(--text)" strokeWidth="2" />}
              <text x={x(i)} y={y(v) - 12} textAnchor="middle" className="val">{fn(v, 1)}</text>
              <text x={x(i)} y={H - m.b + 18} textAnchor="middle" className="ax">{label(t)}</text>
              <text x={x(i)} y={H - m.b + 32} textAnchor="middle" className="ax faint">{finite(adv(t)) ? `${sn(adv(t), 1)} vs base` : 'n/a'}</text>
              <title>{label(t)} · Sharpe {fn(v, 2)} · advantage {sn(adv(t), 2)}</title>
            </g>
          )
        })}
      </svg>
      <p className="chart-note muted small">
        <svg width="14" height="12" aria-hidden="true"><circle cx="7" cy="6" r="5" fill="var(--text)" /></svg> RL at or above the selected baseline{' '}
        <svg width="14" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" fill="var(--bg)" stroke="var(--text)" strokeWidth="1.6" /></svg> RL trails it{' '}
        <svg width="22" height="12" aria-hidden="true"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--signal-graphic)" strokeWidth="2.4" strokeDasharray="7 4" /></svg> validation-selected baseline.{' '}
        {split === 'validation' ? 'Selection split.' : 'Test, visible audit only.'}
      </p>
    </figure>
  )
}

/* ---------------------------------------------------------------- training reward by episode */

const DASH = ['', '7 3', '2 3', '10 3 2 3', '', '7 3']
export function TrainingChart({ rows, trials, episodes, contextual }: { rows: TrainingRow[]; trials: Trial[]; episodes: number; contextual: ContextualBaseline[] }) {
  const id = useId()
  const H = 300
  const m = { l: 60, r: 120, t: 20, b: 36 }
  const vals = rows.map((r) => r.totalReward).filter(finite)
  if (!vals.length) return <p className="pf-na">not available: the Run publishes no training history</p>
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 5)
  const lo = Math.min(ticks[0], ...vals)
  const hi = Math.max(ticks[ticks.length - 1], ...vals)
  const y = (v: number) => m.t + ((hi - v) / (hi - lo || 1)) * (H - m.t - m.b)
  const x = (e: number) => m.l + ((e - 1) / Math.max(1, episodes - 1)) * (W - m.l - m.r)
  return (
    <figure className="chart rl-chart">
      <figcaption>
        <h3 id={`${id}-t`}>Training reward by episode</h3>
        <p className="muted small" id={`${id}-d`}>Exact fixed-budget history for all {trials.length} trials. Descriptive only: it is not a promotion metric and no seed is picked.</p>
      </figcaption>
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{fn(v, 2)}</text>
          </g>
        ))}
        {Array.from({ length: episodes }, (_, i) => i + 1).map((e) => (
          <text key={e} x={x(e)} y={H - m.b + 16} textAnchor="middle" className="ax">E{e}</text>
        ))}
        {(() => {
          // End labels: keep at least 12px apart so neighbouring lines stay readable (placement only).
          const ends = trials.map((t, i) => {
            const pts = rows.filter((r) => r.fold === t.fold && r.seed === t.seed && finite(r.totalReward)).sort((a, b) => a.episode - b.episode)
            const last = pts[pts.length - 1]
            return { i, y: last ? y(last.totalReward as number) : 0 }
          }).sort((a, b) => a.y - b.y)
          for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12
          const place = new Map(ends.map((e) => [e.i, e.y]))
          return trials.map((t, i) => {
            const pts = rows.filter((r) => r.fold === t.fold && r.seed === t.seed && finite(r.totalReward)).sort((a, b) => a.episode - b.episode)
            if (!pts.length) return null
            const d = pts.map((r, k) => `${k ? 'L' : 'M'}${x(r.episode).toFixed(1)} ${y(r.totalReward as number).toFixed(1)}`).join(' ')
            const last = pts[pts.length - 1]
            return (
              <g key={`${t.fold}${t.seed}`}>
                <path d={d} fill="none" stroke="var(--text)" strokeWidth="1.8" strokeDasharray={DASH[i % DASH.length]} opacity={i < 3 ? 1 : 0.75} />
                <text x={x(last.episode) + 6} y={(place.get(i) ?? 0) + 4} className="ax">{label(t)}</text>
                <title>{label(t)} · final reward {fn(last.totalReward, 3)}</title>
              </g>
            )
          })
        })()}
      </svg>
      {contextual.length > 0 && (
        <div className="rl-cards" aria-label="Contextual baseline training contract">
          {contextual.map((c) => {
            const last = c.history?.[c.history.length - 1]
            return c.available ? (
              <article className="rl-card" key={c.fold}>
                <h4 className="h-small">{c.fold} · simple-policy challenger</h4>
                <dl className="kv">
                  <div className="kv-row"><dt>Method</dt><dd>{c.method} · {c.labelScope} · anchor {c.anchorAction}</dd></div>
                  <div className="kv-row"><dt>Iterations</dt><dd>{c.iterations ?? '—'}</dd></div>
                  <div className="kv-row"><dt>Train net Sharpe (final)</dt><dd>{fn(last?.improvedTrainingNetSharpe, 2)}</dd></div>
                  <div className="kv-row"><dt>Behavior best-action hit</dt><dd>{up(last?.behaviorOracleHitRate, 1)}</dd></div>
                  <div className="kv-row"><dt>Action labels</dt><dd>{last?.sharedPretradeActionEvaluations?.toLocaleString('en-US') ?? '—'}</dd></div>
                </dl>
              </article>
            ) : (
              <article className="rl-card" key={c.fold}>
                <h4 className="h-small">{c.fold} · contextual comparator</h4>
                <p className="pf-na">not available: this Run predates same-pretrade train-only fitting (legacy fixed-path labels).</p>
              </article>
            )
          })}
        </div>
      )}
    </figure>
  )
}

/* ---------------------------------------------------------------- action allocation */

export function ActionBars({ rows, actions }: { rows: { key: string; name: string; freq: Freq | undefined }[]; actions: string[] }) {
  const uid = useId()
  const H = 330
  const m = { l: 56, r: 16, t: 20, b: 40 }
  const step = (W - m.l - m.r) / Math.max(1, rows.length)
  const bw = Math.min(110, step * 0.62)
  const ph = H - m.t - m.b
  return (
    <figure className="chart rl-chart">
      <figcaption>
        <h3 id={`${uid}-t`}>Action allocation by fold and seed</h3>
        <p className="muted small" id={`${uid}-desc`}>Share of decisions spent in each factor sleeve. Segments are told apart by texture and by the label inside; segments under 7% carry no label (see the table below).</p>
      </figcaption>
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t ${uid}-desc`}>
        <Defs uid={uid} />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={m.t + ph * (1 - v)} y2={m.t + ph * (1 - v)} stroke="var(--grid)" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={m.t + ph * (1 - v) + 4} textAnchor="end" className="ax">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {rows.map((r, i) => {
          let acc = 0
          const cx = m.l + step * i + step / 2
          return (
            <g key={r.key}>
              {actions.map((a, k) => {
                const v = r.freq?.[a]
                if (!finite(v) || v <= 0) return null
                const top = m.t + ph * (1 - acc - v)
                acc += v
                return (
                  <g key={a}>
                    <rect x={cx - bw / 2} y={top} width={bw} height={ph * v} fill={fillOf(k, uid)} stroke="var(--text)" strokeWidth="1" />
                    {v >= 0.07 && (
                      <g>
                        <rect x={cx - 24} y={top + (ph * v) / 2 - 9} width="48" height="18" fill="var(--bg)" opacity=".92" />
                        <text x={cx} y={top + (ph * v) / 2 + 4} textAnchor="middle" className="val">{up(v, 0)}</text>
                      </g>
                    )}
                    <title>{r.name} · {a} · {up(v, 1)}</title>
                  </g>
                )
              })}
              <text x={cx} y={H - m.b + 18} textAnchor="middle" className="ax">{r.name}</text>
            </g>
          )
        })}
      </svg>
      <span className="legend" role="group" aria-label="Action sleeves">
        {actions.map((a, k) => (
          <span className="legend-item" key={a}>
            <ActionSwatch index={k} />
            {a}
          </span>
        ))}
      </span>
    </figure>
  )
}
