/** One page and its state, exactly as the URL says. Plain functions, no imports. */
export type Route =
  | { view: 'projects' }
  | { view: 'project'; id: string }
  | { view: 'event-study'; id: string }
  | { view: 'factor'; id: string; study?: string }

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
  if (p.get('view') === 'factor' && id) {
    const study = p.get('study')
    return study ? { view: 'factor', id, study } : { view: 'factor', id }
  }
  return { view: 'projects' }
}

export function routeHref(route: Route): string {
  if (route.view === 'project') return `/?${new URLSearchParams({ view: 'project', id: route.id })}`
  if (route.view === 'factor') {
    const params = new URLSearchParams({ view: 'factor', id: route.id })
    if (route.study) params.set('study', route.study)
    return `/?${params}`
  }
  if (route.view === 'event-study') return `/projects/${encodeURIComponent(route.id)}/event-study`
  return '/'
}

/** The Project a route belongs to, if any. */
export function routeProjectId(route: Route): string | null {
  return route.view === 'projects' ? null : route.id
}
