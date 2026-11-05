import { uiTemplate, uiText } from '../i18n'
import { useMemo } from 'react'
import { useFitWidth } from '../design/useFitWidth'
import type { EvoProgram } from './evolutionApi'

const H = 420
const M = { l: 40, r: 16, t: 12, b: 30 }

/** Rows by depth-first leaf order: a leaf takes the next row, a parent sits at the mean of its children. */
function layout(programs: EvoProgram[]) {
  const byId = new Map(programs.map((p) => [p.id, p]))
  const kids = new Map<string, EvoProgram[]>()
  const roots: EvoProgram[] = []
  for (const p of programs) {
    if (p.parent && byId.has(p.parent)) kids.set(p.parent, [...(kids.get(p.parent) ?? []), p])
    else roots.push(p)
  }
  const row = new Map<string, number>()
  let next = 0
  const visit = (p: EvoProgram, seen: Set<string>): number => {
    if (seen.has(p.id)) return row.get(p.id) ?? next
    seen.add(p.id)
    const children = kids.get(p.id) ?? []
    const rows = children.map((c) => visit(c, seen))
    const r = rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : next++
    row.set(p.id, r)
    return r
  }
  const seen = new Set<string>()
  for (const r of roots) visit(r, seen)
  return { row, rows: Math.max(1, next), maxGen: Math.max(1, ...programs.map((p) => p.generation)) }
}

/**
 * The program lineage: generation left to right, each edge from parent to child, the best program's ancestry drawn
 * heavy with filled nodes, failed programs as crosses. Programs after the scrubber's generation are not drawn.
 * Selecting a node opens it in the inspector; the programs table below offers the same choice by keyboard.
 */
export function LineageTree({ programs, bestPath, upTo, selected, onSelect }: { programs: EvoProgram[]; bestPath: string[]; upTo: number; selected: string | null; onSelect: (id: string) => void }) {
  const [ref, W] = useFitWidth<HTMLDivElement>(480, 960)
  const { row, rows, maxGen } = useMemo(() => layout(programs), [programs])
  const best = useMemo(() => new Set(bestPath), [bestPath])
  const x = (g: number) => M.l + (g / maxGen) * (W - M.l - M.r)
  const y = (r: number) => M.t + (r / Math.max(1, rows - 1)) * (H - M.t - M.b)
  const shown = programs.filter((p) => p.generation <= upTo)
  const byId = new Map(programs.map((p) => [p.id, p]))
  const pos = (p: EvoProgram) => [x(p.generation), y(row.get(p.id) ?? 0)] as const
  return (
    <figure className="chart rs-lineage" ref={ref}>
      <figcaption className="muted small">{uiTemplate("{0} of {1} programs up to generation {2}; the heavy line is the best program's ancestry.", [shown.length, programs.length, upTo])}</figcaption>
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={uiText("Program lineage tree")}>
        {[0, Math.round(maxGen / 2), maxGen].map((g) => <text key={g} x={x(g)} y={H - 8} textAnchor="middle" className="ax">{g}</text>)}
        {shown.map((p) => {
          const parent = p.parent ? byId.get(p.parent) : undefined
          if (!parent) return null
          const [x1, y1] = pos(parent)
          const [x2, y2] = pos(p)
          const heavy = best.has(p.id) && best.has(parent.id)
          return <path key={`e-${p.id}`} d={`M${x1},${y1}C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke={heavy ? 'var(--text)' : 'var(--grid)'} strokeWidth={heavy ? 2.2 : 0.8} />
        })}
        {shown.map((p) => {
          const [cx, cy] = pos(p)
          const cls = ['rs-node', best.has(p.id) ? 'is-best' : '', p.id === selected ? 'is-on' : '', p.copy ? 'is-copy' : ''].filter(Boolean).join(' ')
          return (
            <g key={p.id} className={cls} onClick={() => onSelect(p.id)}>
              <title>{uiTemplate("{0} · generation {1} · score {2}", [p.patchName ?? p.id.slice(0, 8), p.generation, p.score === null ? '×' : p.score.toFixed(3)])}</title>
              {p.score === null ? <path d={`M${cx - 3},${cy - 3}l6,6m0,-6l-6,6`} stroke="var(--signal-graphic)" strokeWidth="1.2" /> : <rect x={cx - 2.5} y={cy - 2.5} width="5" height="5" />}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
