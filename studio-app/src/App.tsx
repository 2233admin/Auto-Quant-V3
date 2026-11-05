import { uiText, useLanguage } from './i18n'
import { useEffect, useState } from 'react'
import { ActionsProvider } from './actions/ActionsContext'
import { useTheme } from './design/theme'
import { useWidth } from './design/useWidth'
import { Notice } from './Notice'
import { FactorLibrary } from './library/FactorLibrary'
import { DataIntake } from './pages/intake/DataIntake'
import { AttentionPage } from './pages/Attention'
import { SettingsPage } from './pages/Settings'
import { AssistantPage, AssistantDrawer } from './pages/Assistant'
import { EventStudyPage } from './pages/EventStudy'
import { FactorPage } from './pages/Factor'
import { IdeaWorkbench } from './pages/IdeaWorkbench'
import { ProjectPage, useProject } from './pages/Project'
import { ComparePage } from './pages/compare/ComparePage'
import { StrategyPage } from './pages/strategy/Strategy'
import { BookRiskPage } from './pages/lanes/BookRisk'
import { BookStressPage } from './pages/lanes/BookStress'
import { AllocationPage } from './pages/allocation/Allocation'
import { RlPage } from './pages/rl/Rl'
import { RunPage } from './pages/run/RunPage'
import { routeHref, routeProjectId } from './route'
import { isLibraryRoute, LIBRARY_TITLE, LibraryPage } from './library/Library'
import { ResearchPage } from './research/ResearchPage'
import { EvolutionPage } from './research/EvolutionPage'
import { Palette } from './shell/Palette'
import { Rail, TabBar } from './shell/Rail'
import { assistantContextFor, HostedAssistantNote, isHosted } from './shell/Hosted'
import { TopBar, type Crumb } from './shell/TopBar'
import { useRouter } from './useRouter'
import { useShellData } from './useShellData'
import { Loading } from './components/States'
import { WorkbenchGallery } from './components/workbench/Gallery'
import { FloatingShell } from './components/workbench'
export default function App() {
  useLanguage()
  const { route, go } = useRouter()
  const data = useShellData()
  const [theme, setTheme] = useTheme()
  const [palette, setPalette] = useState(false)
  const [askAssistant, setAskAssistant] = useState(false)
  const [ref, width] = useWidth<HTMLDivElement>()
  const compact = width > 0 && width < 1024
  const projectId = routeProjectId(route)
  const project = useProject(projectId ?? '', projectId ? data.updated : null)
  const hosted = isHosted(data.workspace)
  // Until the workspace summary arrives the host is unknown: offer no Assistant entry rather than flash one.
  const assistantContext = assistantContextFor(route, hosted || !data.workspace)

  useEffect(() => setAskAssistant(false), [route.view, projectId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const known = data.workspace?.projects.find((p) => p.id === projectId)
  const projectCrumb = (id: string) => ({ label: known?.name ?? id, data: true })
  const crumbs: Crumb[] =
    route.view === 'data-intake'
      ? [{ label: uiText('Import data') }]
      : route.view === 'assistant'
      ? [{ label: uiText("Assistant") }]
      : route.view === 'project'
      ? [{ label: uiText("Factors"), href: routeHref({ view: 'projects' }) }, projectCrumb(route.id)]
      : route.view === 'event-study'
        ? [
            { label: uiText("Factors"), href: routeHref({ view: 'projects' }) },
            { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
            { label: uiText("Price event study") },
          ]
        : route.view === 'run' || route.view === 'compare'
          ? [
              { label: uiText("Factors"), href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'run' ? 'Run' : 'Compare Runs' },
            ]
        : route.view === 'allocation' || route.view === 'rl'
          ? [
              { label: uiText("Factors"), href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'rl' ? 'Governed RL policy' : 'Strategic allocation' },
            ]
        : route.view === 'bookrisk' || route.view === 'bookstress'
          ? [
              { label: uiText("Factors"), href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'bookrisk' ? 'Book Risk' : 'Reported-book path stress' },
            ]
        : route.view === 'portfolio' || route.view === 'strategy'
          ? [
              { label: uiText("Strategies"), href: routeHref({ view: 'strategies' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: uiText("Portfolio") },
            ]
        : route.view === 'factor'
          ? [
              { label: uiText("Factors"), href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: uiText("Factor evidence") },
            ]
          : route.view === 'research' && route.id
            ? [{ label: LIBRARY_TITLE.research, href: routeHref({ view: 'research' }) }, { label: data.workspace?.projects.find((p) => p.id === route.id)?.name ?? route.id, data: true, ...(route.e ? { href: routeHref({ view: 'research', id: route.id, h: route.h }) } : {}) }, ...(route.e ? [{ label: `${route.h}/${route.e}`, data: true }] : [])]
          : isLibraryRoute(route)
            ? route.view === 'tuning' && route.id
              ? [{ label: LIBRARY_TITLE.tuning, href: routeHref({ view: 'tuning' }) }, { label: (data.workspace?.projects.find((p) => p.id === route.id)?.name ?? route.id), data: true }]
              : [{ label: LIBRARY_TITLE[route.view] }]
            : route.view === 'attention'
              ? [{ label: uiText("Attention") }]
              : route.view === 'settings'
                ? [{ label: uiText("Settings") }]
                : [{ label: uiText("Factors") }]
  const routeTitles: Record<string, string> = { assistant: 'Assistant', projects: 'Factors', factors: 'Factor library', strategies: 'Strategy library', runs: 'Run history', tuning: 'Tuning tasks', research: 'Research directions', knowledge: 'Knowledge library', attention: 'Attention', settings: 'Settings', 'event-study': 'Price event study', factor: 'Factor evidence', portfolio: 'Portfolio', bookrisk: 'Book Risk', bookstress: 'Reported-book path stress', allocation: 'Strategic allocation', rl: 'Governed RL policy', run: 'Run', compare: 'Compare Runs', project: 'Project' }
  routeTitles['strategy'] = 'Strategy workbench'
  routeTitles['portfolio'] = 'Strategy workbench'
  routeTitles['data-intake'] = 'Import data'
  document.title = [uiText(routeTitles[route.view] ?? 'AutoQuant Studio'), ...(projectId ? [known?.name ?? projectId] : []), 'AutoQuant Studio'].join(' · ')

  let page
  if (new URLSearchParams(window.location.search).get('view') === 'kit') {
    page = <WorkbenchGallery />
  } else if (route.view === 'data-intake') {
    page = <DataIntake workspace={data.workspace} />
  } else if (route.view === 'assistant' && !data.workspace) {
    page = <div className="pg"><Loading label={uiText("Loading…")} minHeight={240} /></div>
  } else if (route.view === 'assistant' && hosted) {
    page = <HostedAssistantNote />
  } else if (route.view === 'assistant') {
    page = <AssistantPage workspace={data.workspace} go={go} />
  } else if (route.view === 'research' && route.id && route.h && route.e) {
    page = <EvolutionPage key={`${route.id}/${route.h}/${route.e}`} run={{ id: route.id, h: route.h, e: route.e }} p={route.p} name={data.workspace?.projects.find((p) => p.id === route.id)?.name ?? route.id} tick={data.updated} go={go} />
  } else if (route.view === 'research' && route.id) {
    page = <ResearchPage key={route.id} id={route.id} h={route.h} name={data.workspace?.projects.find((p) => p.id === route.id)?.name ?? route.id} tick={data.updated} go={go} />
  } else if (isLibraryRoute(route)) {
    page = <LibraryPage route={route} workspace={data.workspace} go={go} tick={data.updated} />
  } else if (route.view === 'attention') {
    page = <AttentionPage workspace={data.workspace} />
  } else if (route.view === 'settings') {
    page = <SettingsPage workspace={data.workspace} />
  } else if (route.view === 'projects') {
    page = data.workspace ? (
      <FactorLibrary workspace={data.workspace} go={go} />
    ) : (
      <div className="pg">{data.error ? <Notice kind="error" label={uiText("Error")} title={uiText("Could not load the Workspace.")} subtitle={data.error} /> : <Loading label={uiText("Loading…")} minHeight={240} />}</div>
    )
  } else if (project.state === 'ready') {
    page =
      route.view === 'event-study' ? (
        <EventStudyPage project={project.project} />
      ) : route.view === 'run' ? (
        <RunPage project={project.project} runId={route.run} go={go} />
      ) : route.view === 'compare' ? (
        <ComparePage project={project.project} a={route.a} b={route.b} projectB={route.projectB} go={go} />
      ) : route.view === 'portfolio' || route.view === 'strategy' ? (
        <StrategyPage key={project.project.id} project={project.project} go={go} />
      ) : route.view === 'bookrisk' ? (
        <BookRiskPage project={project.project} />
      ) : route.view === 'bookstress' ? (
        <BookStressPage project={project.project} />
      ) : route.view === 'allocation' ? (
        <AllocationPage project={project.project} />
      ) : route.view === 'rl' ? (
        <RlPage project={project.project} />
      ) : route.view === 'factor' ? (
        new URLSearchParams(window.location.search).get('idea') === '1' || project.project.runs.length === 0
          ? <IdeaWorkbench key={project.project.id} project={project.project} />
          : <FactorPage project={project.project} study={route.study} run={route.run} go={go} />
      ) : (
        <ProjectPage project={project.project} />
      )
  } else if (project.state === 'error') {
    page = (
      <div className="pg">
        <Notice kind="error" label={uiText("Error")} title={uiText("Could not load this Project")} subtitle={project.message} />
        <p>
          <a href={routeHref({ view: 'projects' })}>{uiText("Back to Factors")}</a>
        </p>
      </div>
    )
  } else {
    page = (
      <div className="pg">
        <Loading label={uiText("Loading…")} minHeight={240} />
      </div>
    )
  }

  return (
    <ActionsProvider workspace={data.workspace} routeKey={JSON.stringify(route)} go={go} refresh={data.refresh}>
    <div ref={ref}>
      <a className="skip" href="#content">{uiText("Skip to content")}</a>
      <FloatingShell sidebar={<Rail route={route} data={data} narrow={compact} onSearch={() => setPalette(true)} />}>
          <TopBar crumbs={crumbs} data={data} theme={theme} onTheme={setTheme} onSearch={() => setPalette(true)} />
          <main id="content" className="page" tabIndex={-1}>
            {page}
          </main>
      </FloatingShell>
      <TabBar route={route} data={data} />
      {assistantContext && <button className="abtn assistant-ask" type="button" onClick={() => setAskAssistant(true)}>{uiText("Ask Assistant")}</button>}
      {askAssistant && assistantContext && <AssistantDrawer key={JSON.stringify(assistantContext)} workspace={data.workspace} context={assistantContext} onClose={() => setAskAssistant(false)} />}
      <Palette open={palette} onClose={() => setPalette(false)} projects={data.workspace?.projects ?? []} go={go} />
    </div>
    </ActionsProvider>
  )
}
