/** One page and its state, exactly as the URL says. Plain functions, no imports. */
export type Route =
  | { view: 'data-intake' }
  | { view: 'assistant' }
  | { view: 'projects' }
  | { view: 'project'; id: string }
  | { view: 'event-study'; id: string }
  | { view: 'run'; id: string; run: string }
  | { view: 'compare'; id: string; a?: string; b?: string }
  | { view: 'factor'; id: string; study?: string; run?: string }
  | { view: 'portfolio'; id: string }
  | { view: 'factors' }
  | { view: 'runs' }
  | { view: 'strategies' }
  | { view: 'attention' }
  | { view: 'settings' }
  | { view: 'tuning'; id?: string }
  | { view: 'bookrisk'; id: string }
  | { view: 'bookstress'; id: string }
  | { view: 'allocation'; id: string }
  | { view: 'rl'; id: string }

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
  if (p.get('view') === 'data-intake') return { view: 'data-intake' }
  if (p.get('view') === 'assistant') return { view: 'assistant' }
  if (p.get('view') === 'project' && id) return { view: 'project', id }
  if (p.get('view') === 'portfolio' && id) return { view: 'portfolio', id }
  if (p.get('view') === 'factors') return { view: 'factors' }
  if (p.get('view') === 'runs') return { view: 'runs' }
  if (p.get('view') === 'strategies') return { view: 'strategies' }
  if (p.get('view') === 'attention') return { view: 'attention' }
  if (p.get('view') === 'settings') return { view: 'settings' }
  if (p.get('view') === 'tuning') return id ? { view: 'tuning', id } : { view: 'tuning' }
  if (p.get('view') === 'bookrisk' && id) return { view: 'bookrisk', id }
  if (p.get('view') === 'bookstress' && id) return { view: 'bookstress', id }
  if (p.get('view') === 'allocation' && id) return { view: 'allocation', id }
  if (p.get('view') === 'rl' && id) return { view: 'rl', id }
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
  return { view: 'factors' }
}

export function routeHref(route: Route): string {
  if (route.view === 'data-intake') return '/?view=data-intake'
  if (route.view === 'assistant') return '/?view=assistant'
  if (route.view === 'project') return `/?${new URLSearchParams({ view: 'project', id: route.id })}`
  if (route.view === 'portfolio') return `/?${new URLSearchParams({ view: 'portfolio', id: route.id })}`
  if (route.view === 'factors' || route.view === 'runs' || route.view === 'strategies' || route.view === 'attention' || route.view === 'settings') return `/?${new URLSearchParams({ view: route.view })}`
  if (route.view === 'tuning') return `/?${new URLSearchParams(route.id ? { view: 'tuning', id: route.id } : { view: 'tuning' })}`
  if (route.view === 'bookrisk' || route.view === 'bookstress') return `/?${new URLSearchParams({ view: route.view, id: route.id })}`
  if (route.view === 'allocation' || route.view === 'rl') return `/?${new URLSearchParams({ view: route.view, id: route.id })}`
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
  if (route.view === 'data-intake') return null
  return route.view === 'assistant' || route.view === 'projects' || route.view === 'factors' || route.view === 'runs' || route.view === 'strategies' || route.view === 'tuning' || route.view === 'attention' || route.view === 'settings' ? null : route.id
}
