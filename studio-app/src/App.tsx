import { useEffect, useState } from 'react'
import { ActionsProvider } from './actions/ActionsContext'
import { useTheme } from './design/theme'
import { useWidth } from './design/useWidth'
import { Notice } from './Notice'
import { Projects } from './pages/Projects'
import { AttentionPage } from './pages/Attention'
import { SettingsPage } from './pages/Settings'
import { EventStudyPage } from './pages/EventStudy'
import { FactorPage } from './pages/Factor'
import { IdeaWorkbench } from './pages/IdeaWorkbench'
import { ProjectPage, useProject } from './pages/Project'
import { ComparePage } from './pages/compare/ComparePage'
import { PortfolioPage } from './pages/portfolio/Portfolio'
import { BookRiskPage } from './pages/lanes/BookRisk'
import { BookStressPage } from './pages/lanes/BookStress'
import { AllocationPage } from './pages/allocation/Allocation'
import { RlPage } from './pages/rl/Rl'
import { RunPage } from './pages/run/RunPage'
import { routeHref, routeProjectId } from './route'
import { isLibraryRoute, LIBRARY_TITLE, LibraryPage } from './library/Library'
import { Palette } from './shell/Palette'
import { Rail, TabBar } from './shell/Rail'
import { TopBar, Updated, type Crumb } from './shell/TopBar'
import { useRouter } from './useRouter'
import { useShellData } from './useShellData'
import { Loading } from './components/States'
import { WorkbenchGallery } from './components/workbench/Gallery'

export default function App() {
  const { route, go } = useRouter()
  const data = useShellData()
  const [theme, setTheme] = useTheme()
  const [palette, setPalette] = useState(false)
  const [ref, width] = useWidth<HTMLDivElement>()
  const compact = width > 0 && width < 1024
  const projectId = routeProjectId(route)
  const project = useProject(projectId ?? '', projectId ? data.updated : null)

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
    route.view === 'project'
      ? [{ label: 'Ideas', href: routeHref({ view: 'projects' }) }, projectCrumb(route.id)]
      : route.view === 'event-study'
        ? [
            { label: 'Ideas', href: routeHref({ view: 'projects' }) },
            { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
            { label: 'Price event study' },
          ]
        : route.view === 'run' || route.view === 'compare'
          ? [
              { label: 'Ideas', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'run' ? 'Run' : 'Compare Runs' },
            ]
        : route.view === 'allocation' || route.view === 'rl'
          ? [
              { label: 'Ideas', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'rl' ? 'Governed RL policy' : 'Strategic allocation' },
            ]
        : route.view === 'bookrisk' || route.view === 'bookstress'
          ? [
              { label: 'Ideas', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: route.view === 'bookrisk' ? 'Book Risk' : 'Reported-book path stress' },
            ]
        : route.view === 'portfolio'
          ? [
              { label: 'Ideas', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: 'Portfolio' },
            ]
        : route.view === 'factor'
          ? [
              { label: 'Ideas', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: 'Factor evidence' },
            ]
          : isLibraryRoute(route)
            ? route.view === 'tuning' && route.id
              ? [{ label: LIBRARY_TITLE.tuning, href: routeHref({ view: 'tuning' }) }, { label: (data.workspace?.projects.find((p) => p.id === route.id)?.name ?? route.id), data: true }]
              : [{ label: LIBRARY_TITLE[route.view] }]
            : route.view === 'attention'
              ? [{ label: 'Attention' }]
              : route.view === 'settings'
                ? [{ label: 'Settings' }]
                : [{ label: 'Ideas' }]
  document.title =
    route.view === 'projects'
      ? 'AutoQuant Studio'
      : route.view === 'attention' || route.view === 'settings'
        ? `${route.view === 'attention' ? 'Attention' : 'Settings'} · AutoQuant Studio`
      : isLibraryRoute(route)
        ? `${LIBRARY_TITLE[route.view]} · AutoQuant Studio`
      : `${route.view === 'event-study' ? 'Price event study · ' : route.view === 'factor' ? 'Factor evidence · ' : route.view === 'portfolio' ? 'Portfolio · ' : route.view === 'bookrisk' ? 'Book Risk · ' : route.view === 'bookstress' ? 'Reported-book path stress · ' :route.view === 'allocation' ? 'Strategic allocation · ' : route.view === 'rl' ? 'Governed RL policy · ' : route.view === 'run' ? 'Run · ' : route.view === 'compare' ? 'Compare Runs · ' : ''}${known?.name ?? route.id} · AutoQuant Studio`

  let page
  if (new URLSearchParams(window.location.search).get('view') === 'kit') {
    page = <WorkbenchGallery />
  } else if (isLibraryRoute(route)) {
    page = <LibraryPage route={route} workspace={data.workspace} go={go} />
  } else if (route.view === 'attention') {
    page = <AttentionPage workspace={data.workspace} />
  } else if (route.view === 'settings') {
    page = <SettingsPage workspace={data.workspace} />
  } else if (route.view === 'projects') {
    page = data.workspace ? (
      <Projects workspace={data.workspace} freshness={<Updated data={data} />} error={data.error} go={go} />
    ) : (
      <div className="pg">{data.error ? <Notice kind="error" label="Error" title="Could not load the Workspace." subtitle={data.error} /> : <Loading label="Loading Workspace…" minHeight={240} />}</div>
    )
  } else if (project.state === 'ready') {
    page =
      route.view === 'event-study' ? (
        <EventStudyPage project={project.project} />
      ) : route.view === 'run' ? (
        <RunPage project={project.project} runId={route.run} go={go} />
      ) : route.view === 'compare' ? (
        <ComparePage project={project.project} a={route.a} b={route.b} go={go} />
      ) : route.view === 'portfolio' ? (
        <PortfolioPage project={project.project} go={go} />
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
        <Notice kind="error" label="Error" title="Could not load this Project." subtitle={project.message} />
        <p>
          <a href={routeHref({ view: 'projects' })}>Back to Ideas</a>
        </p>
      </div>
    )
  } else {
    page = (
      <div className="pg">
        <Loading label="Loading Project…" minHeight={240} />
      </div>
    )
  }

  return (
    <ActionsProvider workspace={data.workspace} routeKey={JSON.stringify(route)} go={go} refresh={data.refresh}>
    <div ref={ref}>
      <a className="skip" href="#content">Skip to content</a>
      <div className="shell">
        <Rail route={route} data={data} narrow={compact} onSearch={() => setPalette(true)} />
        <div className="main">
          <TopBar crumbs={crumbs} data={data} theme={theme} onTheme={setTheme} onSearch={() => setPalette(true)} />
          <main id="content" className="page" tabIndex={-1}>
            {page}
          </main>
        </div>
      </div>
      <TabBar route={route} data={data} />
      <Palette open={palette} onClose={() => setPalette(false)} projects={data.workspace?.projects ?? []} go={go} />
    </div>
    </ActionsProvider>
  )
}
