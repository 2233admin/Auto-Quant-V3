/** One page and its state, exactly as the URL says. Plain functions, no imports. */
export type Route =
  | { view: 'data-intake' }
  | { view: 'assistant' }
  | { view: 'projects' }
  | { view: 'project'; id: string }
  | { view: 'event-study'; id: string }
  | { view: 'run'; id: string; run: string }
  | { view: 'compare'; id: string; a?: string; b?: string; projectB?: string }
  | { view: 'factor'; id: string; study?: string; run?: string }
  | { view: 'portfolio'; id: string }
  | { view: 'strategy'; id: string }
  | { view: 'factors' }
  | { view: 'runs' }
  | { view: 'strategies' }
  | { view: 'attention' }
  | { view: 'settings' }
  | { view: 'tuning'; id?: string }
  | { view: 'research'; id?: string; h?: string; e?: string; p?: string }
  | { view: 'knowledge' }
  | { view: 'bookrisk'; id: string }
  | { view: 'bookstress'; id: string }
  | { view: 'allocation'; id: string }
  | { view: 'rl'; id: string }

const EVENT_STUDY_PATH = /^\/projects\/([^/]+)\/event-study\/?$/

/** Views addressed by name alone, and views that also need a Project `id`. */
const BARE_VIEWS = ['data-intake', 'assistant', 'factors', 'runs', 'strategies', 'attention', 'settings', 'knowledge'] as const
const ID_VIEWS = ['project', 'portfolio', 'strategy', 'bookrisk', 'bookstress', 'allocation', 'rl'] as const
type BareView = (typeof BARE_VIEWS)[number]
type IdView = (typeof ID_VIEWS)[number]
const isBare = (view: string | null): view is BareView => (BARE_VIEWS as readonly string[]).includes(view ?? '')
const isIdView = (view: string | null): view is IdView => (ID_VIEWS as readonly string[]).includes(view ?? '')

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
  const view = p.get('view')
  if (isBare(view)) return { view }
  if (isIdView(view) && id) return { view, id }
  if (view === 'tuning') return id ? { view: 'tuning', id } : { view: 'tuning' }
  if (view === 'research') return { view: 'research', ...(id ? { id } : {}), ...Object.fromEntries((['h', 'e', 'p'] as const).flatMap((k) => (p.get(k) ? [[k, p.get(k)!]] : []))) }
  const projectParam = p.get('project')
  if (p.get('view') === 'run' && projectParam && id) return { view: 'run', id: projectParam, run: id }
  if (p.get('view') === 'compare' && projectParam) {
    const a = p.get('a')
    const b = p.get('b')
    return { view: 'compare', id: projectParam, ...(a ? { a } : {}), ...(b ? { b } : {}), ...(p.get('projectB') ? { projectB: p.get('projectB')! } : {}) }
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
  if (route.view === 'portfolio' || route.view === 'strategy') return `/?${new URLSearchParams({ view: route.view, id: route.id })}`
  if (route.view === 'research') return `/?${new URLSearchParams({ view: 'research', ...(route.id ? { id: route.id } : {}), ...Object.fromEntries((['h', 'e', 'p'] as const).flatMap((k) => (route[k] ? [[k, route[k]!]] : []))) })}`
  if (route.view === 'factors' || route.view === 'runs' || route.view === 'strategies' || route.view === 'attention' || route.view === 'settings' || route.view === 'knowledge') return `/?${new URLSearchParams({ view: route.view })}`
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
    if (route.projectB) params.set('projectB', route.projectB)
    return `/?${params}`
  }
  if (route.view === 'event-study') return `/projects/${encodeURIComponent(route.id)}/event-study`
  return '/'
}

/** The Project a route belongs to, if any. */
export function routeProjectId(route: Route): string | null {
  if (route.view === 'data-intake') return null
  return route.view === 'assistant' || route.view === 'projects' || route.view === 'factors' || route.view === 'runs' || route.view === 'strategies' || route.view === 'tuning' || route.view === 'research' || route.view === 'knowledge' || route.view === 'attention' || route.view === 'settings' ? null : route.id
}
