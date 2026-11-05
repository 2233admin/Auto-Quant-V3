import { uiTemplate, uiText } from '../i18n'
import { Section, SectionNav } from '../design/layout'
import { Icon } from '../design/icons'
import { DataTable, type Col } from '../library/DataTable'
import { Notice } from '../Notice'
import { Loading } from '../components/States'
import { HeroLine, HeroTiles } from '../pages/hero'
import { routeHref } from '../route'
import { researchUrl, useResearchJson, type Direction, type ProjectResearch, type ResearchHypothesis } from './researchApi'
import { Claim, Criteria, Events, Experiments, Ledger, Lockbox, Status, Verdict } from './ResearchParts'
import { TrialFrontier } from './TrialFrontier'
import { fixed, lockboxWord, money } from './words'
import './research.css'

const NAV = [
  ['rs-hyp', 'Hypotheses'], ['rs-trials', 'Trials and noise frontier'], ['rs-claim', 'Claim and criteria'], ['rs-ledger', 'Check ledger'],
  ['rs-verdict', 'Verdict'], ['rs-exp', 'Experiments'], ['rs-events', 'Results ledger'],
] as const

// Commands stay verbatim in every language.
const SYNC_EXTRA = 'uv sync --extra shinka'
const SYNC_ENGINE = 'uv sync --extra shinka --extra shinka-engine'
const ADD_HYPOTHESIS = 'aq shinka hypothesis add <project> --title TEXT --file BODY.md'

export function DemoNotice({ demo }: { demo: string | null }) {
  if (!demo) return null
  return <Notice kind="info" label={uiText("Demo")} title={uiText("Synthetic demo data: no research was run and no number here is a real result.")}><div className="notice-sub" translate="no">{demo}</div></Notice>
}

function tiles(d: Direction) {
  const lockbox = d.lockbox ? (d.lockbox.opened ? 'opened' : 'sealed') : 'none'
  return [
    { label: uiText("Hypotheses"), value: String(d.hypotheses.length), note: uiTemplate("{0} with a verdict", [d.hypotheses.filter((h) => h.verdict).length]) },
    { label: uiText("Trials counted"), value: String(d.trials), note: uiTemplate("{0} probes", [d.probes]) },
    { label: uiText("Failed programs"), value: String(d.frontier.failed), note: uiText("counted as trials") },
    { label: uiText("Best in-sample score"), value: fixed(d.frontier.best), note: uiText("selection metric") },
    { label: uiText("Noise line"), value: fixed(d.frontier.bar), note: uiTemplate("best of {0} noise trials", [d.trials]) },
    { label: uiText("Spend"), value: `${d.unknown_cost_runs ? '≥ ' : ''}${money(d.spend_usd)}`, note: d.budget_usd === null ? uiText("no budget") : uiTemplate("of {0}", [money(d.budget_usd)]) },
  ].concat([{ label: uiText("Lockbox"), value: lockboxWord(lockbox), note: d.lockbox ? uiTemplate("{0} of {1} rows in development", [d.lockbox.n_dev, d.lockbox.n_total]) : uiText("no data split yet") }])
}

function hypothesisCols(d: Direction): Col<ResearchHypothesis>[] {
  return [
    { id: 'id', label: uiText("Hypothesis"), rowHeader: true, sort: (h) => h.id, render: (h) => <span className="mono" translate="no">{h.id}</span> },
    { id: 'title', label: uiText("Statement"), render: (h) => <span className="lib-hyp" translate="no">{h.title}</span> },
    { id: 'status', label: uiText("State"), sort: (h) => h.status, render: (h) => <Status status={h.status} /> },
    { id: 'exp', label: uiText("Experiments"), align: 'r', sort: (h) => h.experiments.length, render: (h) => h.experiments.length },
    { id: 'best', label: uiText("Best in-sample"), align: 'r', sort: (h) => d.frontier.byHypothesis[h.id] ?? null, render: (h) => fixed(d.frontier.byHypothesis[h.id]) },
    { id: 'created', label: uiText("Created"), sort: (h) => h.created, render: (h) => <span className="mono small">{h.created.slice(0, 10)}</span> },
  ]
}

function Body({ id, d, h, go }: { id: string; d: Direction; h: ResearchHypothesis; go: (href: string) => void }) {
  const clears = d.frontier.clears
  const hrefOf = (row: ResearchHypothesis) => routeHref({ view: 'research', id, h: row.id })
  return (
    <>
      <div className="hero-stack">
        <HeroLine tone={clears ? 'ok' : 'warn'} word={clears === null ? uiText("No trial yet") : clears ? uiText("Above the noise line") : uiText("Inside the noise")}>
          {uiTemplate("best in-sample {0} against {1} expected from {2} noise trials", [fixed(d.frontier.best), fixed(d.frontier.bar), d.trials])}
        </HeroLine>
        <HeroTiles items={tiles(d)} label={uiText("Direction numbers")} />
      </div>
      <Section title={uiText("Hypotheses")} id="rs-hyp" icon={<Icon name="doc" />} micro="HYPOTHESES" caption={uiText("Select a row to read its claim, ledger and verdict.")}>
        <DataTable rows={d.hypotheses} cols={hypothesisCols(d)} rowKey={(row) => row.id} href={hrefOf} go={go} caption={uiText("Hypotheses of this direction")} selected={(row) => row.id === h.id} />
      </Section>
      <Section title={uiText("Trials and noise frontier")} id="rs-trials" icon={<Icon name="tuning" />} micro="NOISE FRONTIER">
        {d.trial_points.length ? <TrialFrontier points={d.trial_points} frontier={d.frontier} selected={h.id} /> : <p className="muted">{uiText("No evaluated program yet.")}</p>}
      </Section>
      <div className="cols cols--3-2">
        <Section title={uiTemplate("Claim · {0}", [h.id])} id="rs-claim" icon={<Icon name="doc" />} micro="CLAIM">
          <Claim h={h} />
          <h3 className="pj-sub">{uiText("Frozen before the trials")}</h3>
          <Criteria h={h} />
        </Section>
        <Section title={uiText("Verdict")} id="rs-verdict" icon={<Icon name="check" />} micro="VERDICT">
          <div className="vstack">
            <Verdict h={h} d={d} />
            <h3 className="pj-sub">{uiText("Lockbox")}</h3>
            <Lockbox h={h} d={d} />
          </div>
        </Section>
      </div>
      <Section title={uiTemplate("Check ledger · {0}", [h.id])} id="rs-ledger" icon={<Icon name="analysis" />} micro="LEDGER" caption={uiText("Computed on the server. Validation figures appear only after a verdict; a missing PBO is not computed, never a pass.")}>
        <Ledger rows={h.ledger} />
      </Section>
      <Section title={uiText("Experiments")} id="rs-exp" icon={<Icon name="runs" />} micro="EXPERIMENTS">
        <Experiments h={h} />
      </Section>
      <Section title={uiText("Results ledger")} id="rs-events" icon={<Icon name="versions" />} micro="RESULTS.TSV" fold caption={uiTemplate("{0} recent events; agent rounds {1}.", [d.events.length, d.rounds.state])}>
        <Events d={d} selected={h.id} />
      </Section>
    </>
  )
}

function Unavailable({ data }: { data: ProjectResearch }) {
  if (data.state === 'none') return <Notice kind="info" label={uiText("Info")} title={uiText("This Project has no research direction.")} subtitle={uiTemplate("Attach one with: aq shinka init <workspace> --project {0} --direction TEXT", [data.projectId])} />
  return <Notice kind="error" label={uiText("Error")} title={uiText("The research layer is not installed in this Studio.")} subtitle={data.reason === 'shinka-engine-missing' ? SYNC_ENGINE : SYNC_EXTRA} />
}

/** A Project's Shinka research direction: hypotheses, trials against the noise frontier, claim, ledger and verdict. */
export function ResearchPage({ id, h, name, tick, go }: { id: string; h?: string; name: string; tick: Date | null; go: (href: string) => void }) {
  const load = useResearchJson<ProjectResearch>(researchUrl(id), tick)
  if (load.state === 'loading') return <div className="pg"><Loading label={uiText("Loading…")} minHeight={240} /></div>
  if (load.state === 'error') return <div className="pg"><Notice kind="error" label={uiText("Error")} title={uiText("Could not load this research direction.")} subtitle={load.message} /></div>
  const data = load.data
  const d = data.research
  const current = d?.hypotheses.find((x) => x.id === h) ?? d?.hypotheses[0]
  return (
    <div className="pg rs-page">
      <header className="pg-head">
        <h1 translate="no">{name}</h1>
        <p className="muted small" translate="no">{d?.direction ?? id}</p>
        <p className="small"><a href={routeHref({ view: 'project', id })}>{uiText("Open the Project page")}</a></p>
      </header>
      <DemoNotice demo={data.demo} />
      {d && current ? (
        <>
          <SectionNav items={NAV.map(([key, label]) => ({ id: key, label: uiText(label) }))} />
          <Body id={id} d={d} h={current} go={go} />
        </>
      ) : d ? <Notice kind="info" label={uiText("Info")} title={uiText("No hypothesis yet.")} subtitle={ADD_HYPOTHESIS} /> : <Unavailable data={data} />}
    </div>
  )
}
