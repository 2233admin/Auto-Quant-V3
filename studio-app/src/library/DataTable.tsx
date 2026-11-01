import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { EndOfList } from '../components/States'
import { useSlidingHighlight } from '../components/motion/useSlidingHighlight'
import '../components/motion/motion.css'

export type Col<T> = {
  id: string
  label: string
  /** Sort value; null sorts last in either direction. Without it the column is not sortable. */
  sort?: (row: T) => string | number | null
  render: (row: T) => ReactNode
  align?: 'r'
  /** First cell: rendered as the row header (the link that opens the row). */
  rowHeader?: boolean
  title?: string
}

export type SortState = { id: string; dir: 1 | -1 }

/**
 * One flat table. Click a header button to sort (aria-sort); click anywhere on a row, or Enter on its link, to open it.
 * Sorting only orders published values.
 */
export function DataTable<T>({
  rows,
  cols,
  rowKey,
  href,
  go,
  initial,
  caption,
  selected,
  slideHover = false,
}: {
  rows: T[]
  cols: Col<T>[]
  rowKey: (row: T) => string
  href?: (row: T) => string
  go?: (href: string) => void
  initial?: SortState
  caption: string
  selected?: (row: T) => boolean
  /** Hover wash that glides between rows instead of jumping. Off by default. */
  slideHover?: boolean
}) {
  const [sort, setSort] = useState<SortState | null>(initial ?? null)
  const wrap = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useSlidingHighlight(wrap, { items: 'tbody tr', hover: slideHover })
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const table = el.querySelector('table')
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [rows, cols])
  const sorted = useMemo(() => {
    const col = sort ? cols.find((c) => c.id === sort.id) : undefined
    if (!sort || !col?.sort) return rows
    const get = col.sort
    return [...rows].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      const d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y
      return d * sort.dir
    })
  }, [rows, cols, sort])

  const toggle = (id: string) => setSort((s) => (s?.id === id ? { id, dir: s.dir === 1 ? -1 : 1 } : { id, dir: -1 }))
  const open = (e: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!href || !go || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    if ((e.target as Element).closest('a, button, input, select, label')) return
    go(href(row))
  }

  return (
    <>
      {overflow && <p className="faint small lib-scrollhint" aria-hidden="true">Scroll sideways for more columns →</p>}
      <div className={`tablewrap lib-scroll${slideHover ? ' mo-hl mo-hl--overlay' : ''}`} ref={wrap} tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
      <table className="tbl lib-tbl">
        <caption className="sr">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.id} scope="col" className={c.align} title={c.title} aria-sort={sort?.id === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : c.sort ? 'none' : undefined}>
                {c.sort ? (
                  <button type="button" className="lib-sort" onClick={() => toggle(c.id)}>
                    {c.label}
                    <span aria-hidden="true">{sort?.id === c.id ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className={`${href ? 'is-open' : ''}${selected?.(row) ? ' is-picked' : ''}`} onClick={(e) => open(e, row)}>
              {cols.map((c) =>
                c.rowHeader ? (
                  <th key={c.id} scope="row" className={c.align}>{c.render(row)}</th>
                ) : (
                  <td key={c.id} className={c.align === 'r' ? 'r num' : undefined}>{c.render(row)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <EndOfList label={`End of list · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`} />
    </>
  )
}
