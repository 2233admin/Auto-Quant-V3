import { uiTemplate, uiText } from '../i18n'
import { useState } from 'react'
import { DataTable, type Col } from '../library/DataTable'
import { useResearchJson } from './researchApi'
import { metaUrl, promptUrl, type EvoProgram, type MetaResponse, type PromptResponse, type PromptVersion, type RunKey, type Stage } from './evolutionApi'
import { fixed, money } from './words'

function depths(prompts: PromptVersion[]): Map<string, number> {
  const byId = new Map(prompts.map((p) => [p.id, p]))
  const depth = new Map<string, number>()
  const of = (p: PromptVersion, seen = new Set<string>()): number => {
    if (depth.has(p.id)) return depth.get(p.id)!
    const parent = p.parent_id ? byId.get(p.parent_id) : undefined
    const d = parent && !seen.has(p.id) ? of(parent, new Set([...seen, p.id])) + 1 : 0
    depth.set(p.id, d)
    return d
  }
  prompts.forEach((p) => of(p))
  return depth
}

/** The system-prompt versions the run evolved, as a tree by parent, with their fitness and program counts. */
export function PromptTree({ run, prompts, tick }: { run: RunKey; prompts: PromptVersion[]; tick: Date | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const text = useResearchJson<PromptResponse>(open ? promptUrl(run, open) : null, tick)
  if (prompts.length === 0) return <p className="muted small">{uiText("This run did not evolve its system prompt.")}</p>
  const depth = depths(prompts)
  const order = [...prompts].sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0))
  return (
    <div className="cols">
      <div className="tablewrap">
        <table className="tbl">
          <thead><tr><th scope="col">{uiText("Prompt version")}</th><th scope="col" className="r">{uiText("Programs")}</th><th scope="col" className="r">{uiText("Valid")}</th><th scope="col" className="r">{uiText("Fitness")}</th></tr></thead>
          <tbody>
            {order.map((p) => (
              <tr key={p.id} className={p.id === open ? 'is-picked' : undefined}>
                <th scope="row" style={{ paddingLeft: `${(depth.get(p.id) ?? 0) * 14 + 4}px` }}><button type="button" className="wb-link mono" onClick={() => setOpen(p.id)} translate="no">{p.name ?? p.id.slice(0, 8)}</button></th>
                <td className="r mono">{p.program_count ?? '—'}</td>
                <td className="r mono">{p.correct_program_count ?? '—'}</td>
                <td className="r mono">{fixed(p.fitness)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>{open === null ? <p className="muted small">{uiText("Select a prompt version to read it.")}</p> : text.state === 'ready' ? <pre className="rs-pre" translate="no">{text.data.prompt?.text ?? ''}</pre> : <p className="muted small">{uiText("Loading…")}</p>}</div>
    </div>
  )
}

/** The run's meta-analysis notes, written every N programs, newest first. */
export function MetaNotes({ run, files, tick }: { run: RunKey; files: number[]; tick: Date | null }) {
  const [open, setOpen] = useState<number | null>(files.length ? files[files.length - 1] : null)
  const note = useResearchJson<MetaResponse>(open === null ? null : metaUrl(run, open), tick)
  if (files.length === 0) return <p className="muted small">{uiText("No meta-analysis note was written.")}</p>
  return (
    <div className="vstack">
      <div className="library-filter" role="group" aria-label={uiText("Meta-analysis notes")}>
        {[...files].reverse().map((n) => <button key={n} type="button" aria-pressed={n === open} onClick={() => setOpen(n)}>{uiTemplate("after {0} programs", [n])}</button>)}
      </div>
      {note.state === 'ready' ? <pre className="rs-pre" translate="no">{note.data.meta?.text ?? ''}</pre> : <p className="muted small">{uiText("Loading…")}</p>}
    </div>
  )
}

/** Stage durations of the run's evaluation pipeline and its completion rate. */
export function Throughput({ stages, perHour, wallHours }: { stages: Stage[]; perHour: number | null; wallHours: number | null }) {
  return (
    <div className="vstack">
      <p className="small">{uiTemplate("{0} programs per hour over {1} hours of wall time.", [fixed(perHour, 1), fixed(wallHours, 2)])}</p>
      {stages.length > 0 && (
        <div className="tablewrap">
          <table className="tbl">
            <thead><tr><th scope="col">{uiText("Stage")}</th><th scope="col" className="r">{uiText("Median seconds")}</th><th scope="col" className="r">{uiText("95th percentile")}</th><th scope="col" className="r">{uiText("Longest")}</th><th scope="col" className="r">{uiText("Programs")}</th></tr></thead>
            <tbody>{stages.map((s) => <tr key={s.stage}><th scope="row" translate="no">{s.stage}</th><td className="r mono">{s.p50.toFixed(1)}</td><td className="r mono">{s.p95.toFixed(1)}</td><td className="r mono">{s.max.toFixed(1)}</td><td className="r mono">{s.n}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** The programs up to the scrubber's generation (the 40 best unless all are asked for); a row opens it in the inspector. */
const LIMIT = 40

export function ProgramsTable({ rows, href, go, selected }: { rows: EvoProgram[]; href: (p: EvoProgram) => string; go: (href: string) => void; selected: string | null }) {
  const [all, setAll] = useState(false)
  const cols: Col<EvoProgram>[] = [
    { id: 'name', label: uiText("Program"), rowHeader: true, sort: (p) => p.patchName ?? p.id, render: (p) => <a href={href(p)} className="mono" translate="no">{p.patchName ?? p.id.slice(0, 8)}</a> },
    { id: 'gen', label: uiText("Generation"), align: 'r', sort: (p) => p.generation, render: (p) => p.generation },
    { id: 'score', label: uiText("In-sample score"), align: 'r', sort: (p) => p.score, render: (p) => (p.score === null ? uiText("failed") : fixed(p.score)) },
    { id: 'patch', label: uiText("Patch"), sort: (p) => p.patchType, render: (p) => <span className="mono small" translate="no">{p.patchType ?? '—'}</span> },
    { id: 'model', label: uiText("Model"), render: (p) => <span className="mono small" translate="no">{p.model ?? '—'}</span> },
    { id: 'kids', label: uiText("Offspring"), align: 'r', sort: (p) => p.children, render: (p) => p.children },
    { id: 'cost', label: uiText("Cost"), align: 'r', sort: (p) => p.cost, render: (p) => money(p.cost) },
  ]
  const shown = all || rows.length <= LIMIT ? rows : [...rows].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)).slice(0, LIMIT)
  return (
    <>
      <DataTable rows={shown} cols={cols} rowKey={(p) => p.id} href={href} go={go} initial={{ id: 'score', dir: -1 }} caption={uiText("Programs of this run")} selected={(p) => p.id === selected} />
      {rows.length > LIMIT && <button type="button" className="wb-link small" onClick={() => setAll(!all)}>{all ? uiTemplate("Show the {0} best only", [LIMIT]) : uiTemplate("Show all {0} programs", [rows.length])}</button>}
    </>
  )
}
