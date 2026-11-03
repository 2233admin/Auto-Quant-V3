import { useMemo, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export { Icon }

/* Direction H industrial marks. All are original, drawn as inline SVG or CSS; they carry no data and are decorative
   (aria-hidden) unless stated. Colours are tokens, so light and dark both work. */

/** Section header bar: dark grey bar, icon, Chinese title, uppercase micro-label at the right, hatch strip (CSS). */
export function SectionBar({ icon, children, micro, as: Tag = 'div', className = '', id }: { icon?: IconName; children: ReactNode; micro?: ReactNode; as?: 'div' | 'h2' | 'h3'; className?: string; id?: string }) {
  return (
    <Tag className={`sec-bar ${className}`.trim()} id={id}>
      {icon && <Icon name={icon} />}
      <span className="sec-bar-title">{children}</span>
      {micro && <span className="mk sec-bar-micro" aria-hidden="true">{micro}</span>}
    </Tag>
  )
}

/** Four corner brackets, 10px, for the focal verdict block. */
export function Brackets() {
  return <span className="brk" aria-hidden="true"><i /><i /><i /><i /></span>
}

/** Page-header mark: a barcode (library) or a segmented ruler (result), followed by the micro-label. */
export function PageMark({ kind, micro }: { kind: 'barcode' | 'ruler'; micro: string }) {
  const ticks = useMemo(() => Array.from({ length: 16 }, (_, i) => i), [])
  return (
    <span className="mkw" aria-hidden="true">
      <svg className="bar9" width="64" height="10" viewBox="0 0 64 10" fill="currentColor">
        {kind === 'ruler'
          ? ticks.map((i) => <rect key={i} x={i * 4} y={i % 4 === 0 ? 3 : 6} width="1" height={i % 4 === 0 ? 7 : 4} />)
          : ticks.map((i) => <rect key={i} x={i * 4 - (i % 3 === 1 ? 1 : 0)} y="2" width={i % 3 === 1 ? 2 : 1} height="8" />)}
      </svg>
      <span className="mk">{micro}</span>
    </span>
  )
}

/** Registration marks at chart corners: brackets top-left and bottom-right, crosshair + ring top-right, crosshair bottom-left. They brighten on hover (CSS). */
export function RegMarks() {
  const cross = (cx: number, cy: number) => <path d={`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`} />
  return (
    <>
      <svg className="regmark regmark-tl" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path className="reg" fill="none" d="M1 13V1h12" /></svg>
      <svg className="regmark regmark-br" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path className="reg" fill="none" d="M13 1v12H1" /></svg>
      <svg className="regmark regmark-tr" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><g className="reg" fill="none">{cross(7, 7)}<circle cx="7" cy="7" r="4.5" /></g></svg>
      <svg className="regmark regmark-bl" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><g className="reg" fill="none">{cross(7, 7)}</g></svg>
    </>
  )
}

/* ---- Topographic contour texture: procedural marching squares over a smooth synthetic height field ---- */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function contourPath(w: number, h: number, seed: number, cell = 12, levels = 11): string {
  const r = rng(seed)
  const peaks = Array.from({ length: 4 }, () => [r() * 0.8 * w + 0.1 * w, r() * 0.8 * h + 0.1 * h, (0.18 + r() * 0.14) * w] as const)
  const ph = Array.from({ length: 4 }, () => r() * 6.28)
  const f = (x: number, y: number) => {
    let v = 0
    for (const [a, b, rad] of peaks) v += Math.exp(-(((x - a) ** 2 + (y - b) ** 2) / (2 * rad * rad)))
    return v + 0.1 * Math.sin(x / (w * 0.11) + ph[0] + Math.sin(y / (h * 0.2) + ph[1])) + 0.08 * Math.sin(y / (h * 0.14) + ph[2] + x / (w * 0.3))
  }
  const nx = Math.floor(w / cell) + 1
  const ny = Math.floor(h / cell) + 1
  const F = Array.from({ length: ny }, (_, j) => Array.from({ length: nx }, (_, i) => f(i * cell, j * cell)))
  const flat = F.flat()
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  const out: string[] = []
  for (let k = 1; k <= levels; k++) {
    const t = lo + ((hi - lo) * k) / (levels + 1)
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = F[j][i], b = F[j][i + 1], c = F[j + 1][i + 1], e = F[j + 1][i]
        const x = i * cell, y = j * cell
        const pts: [number, number][] = []
        const ip = (p: number, q: number, x1: number, y1: number, x2: number, y2: number): [number, number] => {
          const u = (t - p) / (q - p)
          return [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u]
        }
        if (a < t !== b < t) pts.push(ip(a, b, x, y, x + cell, y))
        if (b < t !== c < t) pts.push(ip(b, c, x + cell, y, x + cell, y + cell))
        if (e < t !== c < t) pts.push(ip(e, c, x, y + cell, x + cell, y + cell))
        if (a < t !== e < t) pts.push(ip(a, e, x, y, x, y + cell))
        for (let m = 0; m + 1 < pts.length; m += 2) out.push(`M${pts[m][0].toFixed(1)} ${pts[m][1].toFixed(1)}L${pts[m + 1][0].toFixed(1)} ${pts[m + 1][1].toFixed(1)}`)
      }
    }
  }
  return out.join('')
}

/** A very faint (3-6 percent) contour layer behind its parent's content. Used in at most two places: the library's empty canvas and behind the verdict block. */
export function Contour({ width, height, seed, opacity = 0.05, className = '' }: { width: number; height: number; seed: number; opacity?: number; className?: string }) {
  const d = useMemo(() => contourPath(width, height, seed), [width, height, seed])
  return (
    <svg className={`topo ${className}`.trim()} style={{ opacity }} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--contour-ink)" strokeWidth="1" />
    </svg>
  )
}
