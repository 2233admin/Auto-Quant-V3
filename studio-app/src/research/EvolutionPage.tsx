import { uiTemplate, uiText } from '../i18n'
import { useState } from 'react'
import { Section, SectionNav } from '../design/layout'
import { Icon } from '../design/icons'
import { Notice } from '../Notice'
import { HeroTiles } from '../pages/hero'
import { routeHref } from '../route'
import { useResearchJson } from './researchApi'
import { programUrl, runUrl, type EvolutionRun, type ProgramResponse, type RunKey } from './evolutionApi'
import { LineageTree } from './LineageTree'
import { ProgramInspector } from './ProgramInspector'
import { MetaNotes, ProgramsTable, PromptTree, Throughput } from './EvolutionParts'
import { SeriesChart } from './SeriesChart'
import { fixed, money } from './words'

const NAV = [['ev-progress', 'Progress'], ['ev-lineage', 'Lineage'], ['ev-inspector', 'Program inspector'], ['ev-prompts', 'Prompt evolution'], ['ev-meta', 'Meta-analysis'], ['ev-throughput', 'Throughput'], ['ev-programs', 'Programs']] as const

function tiles(r: EvolutionRun) {
  const s = r.stats!
  return [
    { label: uiText("Programs"), value: String(s.programs), note: uiTemplate("{0} valid", [s.correct]) },
    { label: uiText("Success rate"), value: s.programs ? `${(s.successRate * 100).toFixed(0)}%` : '—', note: uiText("valid programs") },
    { label: uiText("Best in-sample score"), value: fixed(s.best), note: uiTemplate("generation {0}", [s.bestGeneration ?? '—']) },
    { label: uiText("Generations"), value: String(s.maxGeneration ?? '—'), note: uiTemplate("{0} since the last improvement", [s.sinceImprovement ?? '—']) },
    { label: uiText("Spend"), value: `${s.costKnown ? '' : '≥ '}${money(s.costUsd)}`, note: uiTemplate("prompt evolution {0}", [money(s.promptCostUsd)]) },
    { label: uiText("Throughput"), value: fixed(r.throughput?.perHour, 1), note: uiText("programs per hour") },
  ]
}

function Progress({ r }: { r: EvolutionRun }) {
  const g = r.generations ?? []
  const gen = uiText("generation")
  return (
    <div className="cols">
      <SeriesChart title={uiText("Score by generation")} short={uiText("Running best, the generation's best and its mean valid score.")} desc={uiText("In-sample (selection) scores only; validation and lockbox figures never enter these charts.")} xLabel={gen} series={[
        { label: uiText("Running best"), kind: 'step', points: g.map((x) => [x.generation, x.record]) },
        { label: uiText("Generation best"), kind: 'dots', points: g.map((x) => [x.generation, x.best]) },
        { label: uiText("Generation mean"), kind: 'dash', points: g.map((x) => [x.generation, x.mean]) },
      ]} format={(v) => v.toFixed(3)} />
      <SeriesChart title={uiText("Success rate by generation")} short={uiText("Share of the generation's programs the evaluator accepted.")} desc={uiText("A failed program is still a trial and still counts.")} xLabel={gen} zero series={[{ label: uiText("Success rate"), kind: 'bars', points: g.map((x) => [x.generation, x.successRate]) }]} format={(v) => `${(v * 100).toFixed(0)}%`} />
      <SeriesChart title={uiText("Cumulative spend")} short={uiText("Model spend recorded on programs, added up by generation.")} desc={uiText("Per-program spend from program metadata; the run total in the tiles uses the research layer's cost rule.")} xLabel={gen} zero series={[{ label: uiText("Cumulative spend"), kind: 'line', points: g.map((x) => [x.generation, x.cumulativeCost]) }, { label: uiText("Generation spend"), kind: 'bars', points: g.map((x) => [x.generation, x.cost]) }]} format={(v) => `$${v.toFixed(2)}`} />
      <SeriesChart title={uiText("Programs per generation")} short={uiText("Programs evaluated and accepted in each generation.")} desc={uiText("Island copies are left out, as in the trial count.")} xLabel={gen} zero series={[{ label: uiText("Programs"), kind: 'bars', points: g.map((x) => [x.generation, x.programs]) }, { label: uiText("Valid"), kind: 'line', points: g.map((x) => [x.generation, x.correct]) }]} format={(v) => v.toFixed(0)} />
    </div>
  )
}

function Body({ r, run, p, tick, go }: { r: EvolutionRun; run: RunKey; p?: string; tick: Date | null; go: (href: string) => void }) {
  const programs = r.programs ?? []
  const max = r.stats?.maxGeneration ?? 0
  const [upTo, setUpTo] = useState(max)
  const selected = p ?? r.bestPath?.at(-1) ?? null
  const detail = useResearchJson<ProgramResponse>(selected ? programUrl(run, selected) : null, tick)
  const href = (id: string) => routeHref({ view: 'research', id: run.id, h: run.h, e: run.e, p: id })
  const select = (id: string) => go(href(id))
  return (
    <>
      <HeroTiles items={tiles(r)} label={uiText("Run numbers")} />
      <Section title={uiText("Progress over generations")} id="ev-progress" icon={<Icon name="analysis" />} micro="PROGRESS"><Progress r={r} /></Section>
      <Section title={uiText("Lineage")} id="ev-lineage" icon={<Icon name="versions" />} micro="LINEAGE">
        <label className="rs-scrub small">
          <span>{uiTemplate("Generation {0} of {1}", [upTo, max])}</span>
          <input type="range" min={0} max={max} value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} aria-label={uiText("Generation scrubber")} />
        </label>
        <LineageTree programs={programs} bestPath={r.bestPath ?? []} upTo={upTo} selected={selected} onSelect={select} />
      </Section>
      <Section title={uiText("Program inspector")} id="ev-inspector" icon={<Icon name="doc" />} micro="INSPECTOR">
        {detail.state === 'ready' ? <ProgramInspector data={detail.data} onSelect={select} /> : <p className="muted small">{detail.state === 'error' ? detail.message : uiText("Loading…")}</p>}
      </Section>
      <Section title={uiText("Prompt evolution")} id="ev-prompts" icon={<Icon name="params" />} micro="PROMPTS" fold defaultOpen={(r.prompts?.length ?? 0) > 0}><PromptTree run={run} prompts={r.prompts ?? []} tick={tick} /></Section>
      <Section title={uiText("Meta-analysis")} id="ev-meta" icon={<Icon name="folder" />} micro="META" fold><MetaNotes run={run} files={r.metaFiles ?? []} tick={tick} /></Section>
      <Section title={uiText("Throughput")} id="ev-throughput" icon={<Icon name="runs" />} micro="THROUGHPUT" fold><Throughput stages={r.throughput?.stages ?? []} perHour={r.throughput?.perHour ?? null} wallHours={r.throughput?.wallHours ?? null} /></Section>
      <Section title={uiText("Programs")} id="ev-programs" icon={<Icon name="runs" />} micro="PROGRAMS" caption={uiTemplate("Up to generation {0}.", [upTo])}>
        <ProgramsTable rows={programs.filter((x) => x.generation <= upTo)} href={(x) => href(x.id)} go={go} selected={selected} />
      </Section>
    </>
  )
}

/** One experiment's evolution run: progress, lineage with a generation scrubber, a program inspector, prompts, notes. */
export function EvolutionPage({ run, p, name, tick, go }: { run: RunKey; p?: string; name: string; tick: Date | null; go: (href: string) => void }) {
  const load = useResearchJson<EvolutionRun>(runUrl(run), tick)
  const head = (
    <header className="pg-head">
      <h1 translate="no">{name} · {run.h}/{run.e}</h1>
      <p className="small"><a href={routeHref({ view: 'research', id: run.id, h: run.h })}>{uiText("Back to the research direction")}</a></p>
    </header>
  )
  if (load.state !== 'ready') return <div className="pg rs-page">{head}<p className="muted">{load.state === 'error' ? load.message : uiText("Loading…")}</p></div>
  const r = load.data
  return (
    <div className="pg rs-page">
      {head}
      {r.demo && <Notice kind="info" label={uiText("Demo")} title={uiText("Synthetic demo data: no research was run and no number here is a real result.")} />}
      {r.state === 'ready' ? (
        <>
          <SectionNav items={NAV.map(([key, label]) => ({ id: key, label: uiText(label) }))} />
          <Body key={`${run.h}/${run.e}`} r={r} run={run} p={p} tick={tick} go={go} />
        </>
      ) : <Notice kind="info" label={uiText("Info")} title={r.state === 'unavailable' ? uiText("The research layer is not installed in this Studio.") : uiText("This experiment has no evolution run yet.")} />}
    </div>
  )
}
