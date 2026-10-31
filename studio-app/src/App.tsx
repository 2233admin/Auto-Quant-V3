import { useEffect, useState } from 'react'
import { useTheme } from './design/theme'
import { useWidth } from './design/useWidth'
import { Notice } from './Notice'
import { Projects } from './pages/Projects'
import { EventStudyPage } from './pages/EventStudy'
import { FactorPage } from './pages/Factor'
import { ProjectPage, useProject } from './pages/Project'
import { routeHref, routeProjectId } from './route'
import { Palette } from './shell/Palette'
import { Rail, TabBar } from './shell/Rail'
import { TopBar, Updated, type Crumb } from './shell/TopBar'
import { useRouter } from './useRouter'
import { useShellData } from './useShellData'

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
      ? [{ label: 'Projects', href: routeHref({ view: 'projects' }) }, projectCrumb(route.id)]
      : route.view === 'event-study'
        ? [
            { label: 'Projects', href: routeHref({ view: 'projects' }) },
            { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
            { label: 'Price event study' },
          ]
        : route.view === 'factor'
          ? [
              { label: 'Projects', href: routeHref({ view: 'projects' }) },
              { ...projectCrumb(route.id), href: routeHref({ view: 'project', id: route.id }) },
              { label: 'Factor evidence' },
            ]
          : [{ label: 'Projects' }]
  document.title =
    route.view === 'projects'
      ? 'AutoQuant Studio'
      : `${route.view === 'event-study' ? 'Price event study · ' : route.view === 'factor' ? 'Factor evidence · ' : ''}${known?.name ?? route.id} · AutoQuant Studio`

  let page
  if (route.view === 'projects') {
    page = data.workspace ? (
      <Projects workspace={data.workspace} freshness={<Updated data={data} />} error={data.error} />
    ) : (
      <div className="pg">{data.error ? <Notice kind="error" label="Error" title="Could not load the Workspace." subtitle={data.error} /> : <p className="muted">Loading…</p>}</div>
    )
  } else if (project.state === 'ready') {
    page =
      route.view === 'event-study' ? (
        <EventStudyPage project={project.project} />
      ) : route.view === 'factor' ? (
        <FactorPage project={project.project} study={route.study} />
      ) : (
        <ProjectPage project={project.project} />
      )
  } else if (project.state === 'error') {
    page = (
      <div className="pg">
        <Notice kind="error" label="Error" title="Could not load this Project." subtitle={project.message} />
        <p>
          <a href={routeHref({ view: 'projects' })}>Back to Projects</a>
        </p>
      </div>
    )
  } else {
    page = (
      <div className="pg">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
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
  )
}
