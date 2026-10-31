import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { hashWithJob, sectionOfHash } from '../actions/jobHash'

/** Distance from the viewport top at which a heading counts as "current": top bar (52) + section nav (~40) + air. */
const SPY_LINE = 52 + 44 + 24

/**
 * One section of a page: heading, optional one-line caption, body. With `fold` the body sits behind a native
 * details/summary disclosure (keyboard and screen-reader support for free); `defaultOpen` sets its first state.
 * The heading id is the anchor the section nav and the URL hash point at.
 */
export function Section({
  title,
  id,
  caption,
  fold,
  defaultOpen,
  className,
  children,
}: {
  title: string
  id: string
  caption?: ReactNode
  fold?: boolean
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const cls = `sec${fold ? ' sec--fold' : ''}${className ? ` ${className}` : ''}`
  if (!fold) {
    return (
      <section className={cls} aria-labelledby={id}>
        <h2 id={id}>{title}</h2>
        {caption && <p className="sec-cap">{caption}</p>}
        {children}
      </section>
    )
  }
  return (
    <section className={cls} aria-labelledby={id}>
      <details open={defaultOpen}>
        <summary>
          <h2 id={id}>{title}</h2>
          {caption && <span className="sec-cap">{caption}</span>}
        </summary>
        <div className="sec-body">{children}</div>
      </details>
    </section>
  )
}

export type NavItem = { id: string; label: string }

/** Opens the disclosure that holds `id`, if any, and scrolls to it. */
function reveal(id: string) {
  const el = document.getElementById(id)
  if (!el) return false
  const details = el.closest('details')
  if (details) details.open = true
  el.scrollIntoView({ block: 'start' })
  return true
}

/**
 * Sticky in-page navigation with scroll-spy. Items point at existing heading ids. A link to a folded section opens
 * it; a `#id` in the URL does the same on load, so a folded section can be shared by link. Open state is not
 * stored anywhere else.
 */
export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const key = items.map((i) => i.id).join('|')

  useEffect(() => {
    const hash = decodeURIComponent(sectionOfHash())
    if (hash && items.some((i) => i.id === hash)) requestAnimationFrame(() => reveal(hash))
    // Only on first mount of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let best = items[0]?.id ?? ''
      let bestTop = -Infinity
      for (const item of items) {
        const top = document.getElementById(item.id)?.getBoundingClientRect().top
        if (top === undefined || top > SPY_LINE) continue
        if (top > bestTop) {
          bestTop = top
          best = item.id
        }
      }
      setActive(best)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    if (reveal(id)) {
      window.history.replaceState(null, '', hashWithJob(id))
      setActive(id)
    }
  }

  return (
    <nav className="secnav" aria-label="On this page">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={item.id === active ? 'location' : undefined} onClick={(e) => go(e, item.id)}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
