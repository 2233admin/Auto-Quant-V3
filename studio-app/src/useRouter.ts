import { useCallback, useEffect, useRef, useState } from 'react'
import { parseRoute, type Route } from './route'

export type Router = {
  route: Route
  go: (href: string, options?: { replace?: boolean }) => void
}

/** Query-string routing with pushState: in-app links, Back and Forward stay on this page. */
export function useRouter(): Router {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.search, window.location.pathname))
  const read = useRef(window.location.pathname + window.location.search)
  const go = useCallback((href: string, { replace = false } = {}) => {
    const url = new URL(href, window.location.href)
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    read.current = url.pathname + url.search
    setRoute(parseRoute(url.search, url.pathname))
    if (!replace) window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onPop = () => {
      const here = window.location.pathname + window.location.search
      if (here === read.current) return
      read.current = here
      setRoute(parseRoute(window.location.search, window.location.pathname))
    }
    // Plain left clicks on links to the app root navigate in place; /legacy and new tabs stay native.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return
      if (anchor.getAttribute('href')?.startsWith('#')) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin || !(url.pathname === '/' || url.pathname.startsWith('/projects/'))) return
      event.preventDefault()
      go(url.href)
    }
    window.addEventListener('popstate', onPop)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
  }, [go])

  return { route, go }
}
