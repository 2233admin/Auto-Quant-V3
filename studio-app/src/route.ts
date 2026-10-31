/** One page and its state, exactly as the URL says. Plain functions, no imports. */
export type Route =
  | { view: 'projects' }
  | { view: 'project'; id: string }
  | { view: 'event-study'; id: string }
  | { view: 'run'; id: string; run: string }
  | { view: 'compare'; id: string; a?: string; b?: string }
  | { view: 'factor'; id: string; study?: string; run?: string }

const EVENT_STUDY_PATH = /^\/projects\/([^/]+)\/event-study\/?$/

export function parseRoute(search: string, pathname = '/'): Route {
  const study = EVENT_STUDY_PATH.exec(pathname)
  if (study) {
    try {
      return { view: 'event-study', id: decodeURIComponent(study[1]) }
    } catch {
      return { view: 'projects' }
    }
  }
  const p = new URLSearchParams(search)
  const id = p.get('id')
  if (p.get('view') === 'project' && id) return { view: 'project', id }
  const projectParam = p.get('project')
  if (p.get('view') === 'run' && projectParam && id) return { view: 'run', id: projectParam, run: id }
  if (p.get('view') === 'compare' && projectParam) {
    const a = p.get('a')
    const b = p.get('b')
    return { view: 'compare', id: projectParam, ...(a ? { a } : {}), ...(b ? { b } : {}) }
  }
  if (p.get('view') === 'factor' && id) {
    const study = p.get('study')
    const run = p.get('run')
    return { view: 'factor', id, ...(study ? { study } : {}), ...(run ? { run } : {}) }
  }
  return { view: 'projects' }
}

export function routeHref(route: Route): string {
  if (route.view === 'project') return `/?${new URLSearchParams({ view: 'project', id: route.id })}`
  if (route.view === 'factor') {
    const params = new URLSearchParams({ view: 'factor', id: route.id })
    if (route.study) params.set('study', route.study)
    if (route.run) params.set('run', route.run)
    return `/?${params}`
  }
  if (route.view === 'run') return `/?${new URLSearchParams({ view: 'run', project: route.id, id: route.run })}`
  if (route.view === 'compare') {
    const params = new URLSearchParams({ view: 'compare', project: route.id })
    if (route.a) params.set('a', route.a)
    if (route.b) params.set('b', route.b)
    return `/?${params}`
  }
  if (route.view === 'event-study') return `/projects/${encodeURIComponent(route.id)}/event-study`
  return '/'
}

/** The Project a route belongs to, if any. */
export function routeProjectId(route: Route): string | null {
  return route.view === 'projects' ? null : route.id
}
