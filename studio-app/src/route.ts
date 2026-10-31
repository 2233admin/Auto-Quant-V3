/** One page and its state, exactly as the URL says. Plain functions, no imports. */
export type Route = { view: 'projects' } | { view: 'project'; id: string }

export function parseRoute(search: string): Route {
  const p = new URLSearchParams(search)
  if (p.get('view') === 'project') {
    const id = p.get('id')
    if (id) return { view: 'project', id }
  }
  return { view: 'projects' }
}

export function routeHref(route: Route): string {
  if (route.view === 'project') return `/?${new URLSearchParams({ view: 'project', id: route.id })}`
  return '/'
}
