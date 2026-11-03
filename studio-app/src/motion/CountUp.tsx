import { useEffect, useRef, useState } from 'react'
import { motionPlays } from './motion'

const DURATION = 600

/** "+5.30%" / "-3.62" / "31.14" / "54 bars": prefix, first number, suffix. Null when there is nothing to count. */
function split(text: string) {
  const m = /^([^\d]*?)(\d[\d,]*)(?:\.(\d+))?(.*)$/s.exec(text)
  if (!m) return null
  const int = m[2].replace(/,/g, '')
  const dec = m[3]?.length ?? 0
  const n = Number(`${int}${dec ? `.${m[3]}` : ''}`)
  return Number.isFinite(n) ? { pre: m[1], n, dec, group: m[2].includes(','), suf: m[4] } : null
}

function format(p: NonNullable<ReturnType<typeof split>>, n: number) {
  const [i, f] = n.toFixed(p.dec).split('.')
  const body = p.group ? i.replace(/\B(?=(\d{3})+$)/g, ',') : i
  return `${p.pre}${f === undefined ? body : `${body}.${f}`}${p.suf}`
}

/**
 * A focal number that counts up from zero once when it first paints and ends exactly on `value` (the string Core
 * formatted; Studio never recomputes a statistic). Under Motion off (or system + reduced motion) it renders the final
 * text at once. While counting, the moving digits are hidden from assistive technology and the final text is read.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const [frame, setFrame] = useState<string | null>(null)
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (done.current === value) return
    done.current = value
    const target = split(value)
    if (!target || target.n === 0 || !motionPlays()) { setFrame(null); return }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      if (t >= 1 || !motionPlays()) { setFrame(null); return }
      setFrame(format(target, target.n * (1 - (1 - t) ** 3)))
      raf = requestAnimationFrame(step)
    }
    setFrame(format(target, 0))
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  if (frame === null) return <span className={className}>{value}</span>
  return (
    <span className={className}>
      <span aria-hidden="true">{frame}</span>
      <span className="fx-sr">{value}</span>
    </span>
  )
}
