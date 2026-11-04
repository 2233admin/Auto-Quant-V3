import { uiTemplate, uiText, uiValue } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getJson, type ProjectResponse, type ProjectSnapshot, type RunRow, type StudyRow } from '../api'
import { Glyph } from '../design/icons'
import { Section, SectionNav } from '../design/layout'
import { num, plural, when } from '../format'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { verification } from '../shell/Rail'
import { RunAnalysisButton } from '../actions/RunAnalysisButton'
import { RunList } from './run/RunList'
import { Info } from '../components/Info'
import { HeroLine, HeroTiles, type HeroTile } from './hero'
import {
  EvidenceDocsBlock,
  ExperimentsBlock,
  focusSessionIndex,
  NextMoveBlock,
  projectHeadline,
  QuestionBlock,
  questionLine,
  SelectionBlock,
  sessionMeta,
  TrialHero,
} from './project/ProjectResearch'

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; project: ProjectSnapshot }

/**
 * One Project's verified snapshot. The page keeps the last data while a refresh is in flight.
 * The shell's first workspace response is only a baseline: it must not re-request a Project the
 * page is already loading, so only later ticks refresh. Repeat requests revalidate with the
 * server's ETag, so an unchanged Project costs a 304.
 */
export function useProject(id: string, tick: Date | null): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const controller = useRef<AbortController | null>(null)
  const lastTick = useRef<Date | null>(tick)

  const fetchProject = useCallback((projectId: string) => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(projectId)}`, next.signal)
      .then((body) => {
        const project = body.projects[0]
        setLoad(project ? { state: 'ready', project } : { state: 'error', message: `Unknown Project: ${projectId}` })
      })
      .catch((reason: unknown) => {
        if (next.signal.aborted) return
        const message = reason instanceof ApiError || reason instanceof Error ? reason.message : String(reason)
        setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'error', message }))
      })
  }, [])

  useEffect(() => {
    setLoad({ state: 'loading' })
    if (!id) return
    lastTick.current = tick
    fetchProject(id)
    return () => controller.current?.abort()
    // tick is read only to seed the baseline for this Project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchProject])

  useEffect(() => {
    if (!id || tick === lastTick.current) return
    const first = lastTick.current === null
    lastTick.current = tick
    if (!first) fetchProject(id)
  }, [id, tick, fetchProject])

  return load
}

const STATUS_GLYPH: Record<string, 'supported' | 'error' | 'running' | 'empty'> = {
  succeeded: 'supported',
  failed: 'error',
  running: 'running',
}

function latestRunByStudy(runs: RunRow[]): Map<string, RunRow> {
  const latest = new Map<string, RunRow>()
  for (const run of runs) {
    const seen = latest.get(run.studyId)
    if (!seen || run.startedAt > seen.startedAt) latest.set(run.studyId, run)
  }
  return latest
}

const OTHER_LANES: { key: keyof ProjectSnapshot; name: string }[] = [
  { key: 'portfolioExplorer', name: 'Portfolio decision explorer' },
  { key: 'rlExplorer', name: 'Governed RL policy' },
  { key: 'bookRiskExplorer', name: 'Book risk' },
  { key: 'eventStudyExplorer', name: 'Price event study' },
  { key: 'bookPathStressExplorer', name: 'Reported-book path stress' },
  { key: 'allocationExplorer', name: 'Strategic allocation' },
]

export function ProjectPage({ project }: { project: ProjectSnapshot }) {
  const look = verification(project.valid)
  const counts = project.counts
  const n = (key: string) => (typeof counts[key] === 'number' ? (counts[key] as number) : 0)
  const latest = latestRunByStudy(project.runs)
  const validation = project.factorExplorer?.summary?.validation
  const headline = projectHeadline(project)
  const focus = focusSessionIndex(project)
  const dm = focus >= 0 ? project.sessions[focus].decisionMatrix : null
  const candidates = (dm?.trials ?? []).filter((t) => t.role !== 'baseline')
  const leader = (dm?.trials ?? []).find((t) => t.isCurrentLeader)
  const tiles: HeroTile[] = [
    { label: uiText("Candidate trials"), value: String(candidates.length), note: uiTemplate("{0} kept", [candidates.filter((t) => t.verdict === 'KEEP').length]) },
    { label: uiTemplate("Leader {0}", [dm?.objective?.metric ?? uiText('metric')]), value: leader ? num(leader.primaryValue, 4) : '—', note: leader ? (leader.role === 'baseline' ? uiText('baseline leads') : uiTemplate('trial {0}', [leader.sequence])) : undefined },
    { label: uiText("Mean rank IC"), value: validation ? num(validation.meanRankIc, 4) : '—', note: uiText("validation split") },
    { label: uiText("HAC normal p"), value: validation ? num(validation.hacNormalPValue, 3) : '—', note: validation ? `ICIR ${num(validation.rankIcir, 3)}` : undefined },
    {
      label: uiText("Observations"),
      value: validation ? String(validation.observations) : '—',
      note: validation && !validation.sufficient ? 'below minimum' : undefined,
    },
    { label: uiText("Runs"), value: String(project.runs.length), note: `${plural(project.studies.length, 'Study', 'Studies')} · ${plural(n('sessions'), 'Session')}` },
  ]
  const studiesTable = (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Study")}</th>
                <th scope="col">{uiText("Subject")}</th>
                <th scope="col">{uiText("Primary metric")}</th>
                <th scope="col">{uiText("Latest Run")}</th>
                <th scope="col" className="r">{uiText("Primary value")}</th>
              </tr>
            </thead>
            <tbody>
              {project.studies.map((study: StudyRow) => {
                const run = latest.get(study.id)
                return (
                  <tr key={study.id}>
                    <th scope="row">
                      {study.name}
                      <span className="faint small mono" translate="no">{study.id}</span>
                    </th>
                    <td>{uiText(study.subjectKind)}</td>
                    <td className="mono">{study.primaryMetric} ({uiText(study.direction)})</td>
                    <td>
                      {run ? (
                        <span className="state">
                          <Glyph kind={STATUS_GLYPH[run.status] ?? 'empty'} signal={run.status === 'failed'} />
                          <span>{uiValue(run.status)}</span>
                          <span className="faint mono small">{when(run.startedAt)}</span>
                        </span>
                      ) : (
                        <span className="faint">{uiText("No Run yet")}</span>
                      )}
                    </td>
                    <td className="r num mono">{run ? num(run.primaryValue, 4) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
  )
  const hasTrials = focus >= 0 && (dm?.trials ?? []).length > 0

  return (
    <div className="pg">
      <header className="pg-head">
        <h1 translate="no">{project.name}</h1>
        <p className="muted small">
          <span className="state">
            <Glyph kind={look.glyph} signal={look.signal} />
            <span className={look.signal ? 'sig' : undefined}>{uiValue(look.word)}</span>
          </span>
          {' · '}
          {plural(project.studies.length, 'Study', 'Studies')} · {plural(project.runs.length, 'Run')} · {plural(n('sessions'), 'Session')} ·{' '}
          {plural(n('reports'), 'Report')}
        </p>
      </header>

      <SectionNav
        items={[
          { id: 'sec-next', label: uiText("Next move") },
          { id: 'sec-question', label: uiText("Question") },
          { id: 'sec-studies', label: uiText("Studies") },
          { id: 'sec-selection', label: uiText("Selection-adjusted") },
          { id: 'sec-experiments', label: uiText("Experiments") },
          { id: 'sec-runs', label: uiText("Runs") },
          { id: 'sec-sessions', label: uiText("Sessions") },
          { id: 'sec-docs', label: uiText("Reports") },
          { id: 'sec-lanes', label: uiText("Other lanes") },
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone={headline.tone}
          word={headline.word}
          why={
            headline.why.length > 0 ? (
              <Info label={uiText("Why this headline")}>
                <p>{headline.why.join(' · ')}</p>
                <p className="faint mono">{uiText("agentWorkBrief.review, sessions[].experiments[].verdict")}</p>
              </Info>
            ) : undefined
          }
        >
          {uiValue(headline.text)}
        </HeroLine>

        {project.diagnostics.length > 0 && (
          <Notice kind="error" label={uiText("Error")} title={uiText("Project diagnostics.")} subtitle={project.diagnostics.map((d) => d.message ?? '').join('; ')} />
        )}

        <section aria-labelledby="sec-trials">
          <h2 id="sec-trials" className="sr-only">
            {hasTrials ? uiText("Trials") : uiText("Studies")}
          </h2>
          {hasTrials ? <TrialHero project={project} /> : studiesTable}
        </section>

        <HeroTiles items={tiles} label={uiText("Core numbers")} />
      </div>

      <Section title={uiText("Next move")} id="sec-next">
        <div className="pj-next">
          <div>
            <NextMoveBlock project={project} />
          </div>
          <div className="pj-next-act">
            <RunAnalysisButton project={project} />
            {project.factorExplorer && (
              <p className="small">
                <a href={routeHref({ view: 'factor', id: project.id, study: project.factorExplorer.run.studyId })}>{uiText("Open Factor evidence")}</a>
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title={uiText("Question and claim")} id="sec-question" fold className="sec--oneline" caption={questionLine(project)}>
        <QuestionBlock project={project} />
      </Section>

      <Section title={uiText("Studies")} id="sec-studies">
        {hasTrials ? studiesTable : <p className="muted small">{uiText("The Studies table is shown at the top of this page, because no trial trajectory exists yet.")}</p>}
        <p className="muted small">{uiText("Primary values are the selection-split metric.")}<Info label={uiText("About primary values")}>
            <p>{uiText("Primary values are the Study's selection-split metric. Test and holdout numbers are not drawn here.")}</p>
          </Info>
        </p>
      </Section>

      <Section title={uiText("Selection-adjusted evidence")} id="sec-selection">
        <SelectionBlock project={project} />
      </Section>

      <Section title={uiText("Experiments and trials")} id="sec-experiments">
        <ExperimentsBlock project={project} />
      </Section>

      <Section title={uiText("Runs")} id="sec-runs">
        <RunList project={project} />
      </Section>

      <div className="cols">
          <Section title={uiText("Sessions")} id="sec-sessions">
            {project.sessions.length === 0 ? (
              <p className="muted">{uiText("No Research Sessions yet.")}</p>
            ) : (
              <ul className="plain">
                {project.sessions.map((s, index) => {
                  const m = sessionMeta(s)
                  return (
                    <li key={m.id ?? index} className="mono small" translate="no">
                      {m.id ?? 'session'} · {m.studyId ?? 'no Study recorded'} · {m.status ?? 'no status recorded'}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
          <Section title={uiText("Recent activity")} id="sec-timeline">
            {project.timeline.length === 0 ? (
              <p className="muted">{uiText("No Runs, Sessions or Reports yet.")}</p>
            ) : (
              <ol className="timeline">
                {project.timeline.slice(0, 12).map((row) => (
                  <li key={`${row.kind}/${row.id}`}>
                    <span className="mono faint small">{when(row.at)}</span>
                    <span className="kind">{uiText(row.kind)}</span>
                    <span className="trunc" translate="no">{row.title}</span>
                    <span className="mono small">{row.value === null ? uiText(row.status) : `${uiText(row.status)} · ${num(row.value, 3)}`}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
      </div>

      <Section title={uiText("Reports, Reviews, Dossiers and holdout")} id="sec-docs" fold caption={uiText("Session and Run Reports, Reviews, Dossiers and the external holdout.")}>
        <EvidenceDocsBlock project={project} />
      </Section>

      <Section title={uiText("Other lanes")} id="sec-lanes" fold caption={uiText("Native lane pages for this Project.")}>
        <p className="muted small">{uiText("Every lane below has a native page here.")}<Info label={uiText("About the lanes")}>
            <p>{uiText("Lanes with evidence in this Project open their native page. A lane the Studio does not draw natively would open the legacy Studio instead.")}</p>
          </Info>
        </p>
        <ul className="plain">
          {OTHER_LANES.map((lane) => (
            <li key={lane.key} className="lane">
              <span>{lane.name}</span>
              {lane.key === 'eventStudyExplorer' && project.eventStudyExplorer ? (
                <a href={routeHref({ view: 'event-study', id: project.id })}>{uiText("Open event study")}</a>
              ) : lane.key === 'portfolioExplorer' && project.portfolioExplorer ? (
                <a href={routeHref({ view: 'portfolio', id: project.id })}>{uiText("Open Portfolio")}</a>
              ) : lane.key === 'bookRiskExplorer' && project.bookRiskExplorer ? (
                <a href={routeHref({ view: 'bookrisk', id: project.id })}>{uiText("Open Book Risk")}</a>
              ) : lane.key === 'bookPathStressExplorer' && project.bookPathStressExplorer ? (
                <a href={routeHref({ view: 'bookstress', id: project.id })}>{uiText("Open path stress")}</a>
              ) : lane.key === 'allocationExplorer' && project.allocationExplorer ? (
                <a href={routeHref({ view: 'allocation', id: project.id })}>{uiText("Open strategic allocation")}</a>
              ) : lane.key === 'rlExplorer' && project.rlExplorer ? (
                <a href={routeHref({ view: 'rl', id: project.id })}>{uiText("Open governed RL policy")}</a>
              ) : project[lane.key] ? (
                <a href="/legacy">{uiText("Open in legacy Studio")}</a>
              ) : (
                <span className="faint">{uiText("No evidence in this Project")}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
