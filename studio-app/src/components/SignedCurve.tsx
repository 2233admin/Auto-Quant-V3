import { useId } from 'react'

export type CurvePoint = [x: number, y: number]

/**
 * A net / long-short curve drawn against its starting level: the part above `baseY` in the positive sign colour, the part
 * below in the negative one, with a faint area between the curve and the baseline (owner decision 2026-11-04, batch 2).
 * Colours are the `sign-positive` / `sign-negative` roles, so the Settings convention switch applies. Benchmark and other
 * series are drawn by the caller in neutral grey. Points are pixel coordinates; `baseY` is the pixel row of the start level.
 */
export function SignedCurve({ pts, baseY, x0, x1, top, bottom, width = 1.9, casing = false, area = true }: {
  pts: CurvePoint[]; baseY: number; x0: number; x1: number; top: number; bottom: number; width?: number; casing?: boolean; area?: boolean
}) {
  const id = useId()
  if (pts.length < 2) return null
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const fill = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${baseY.toFixed(1)} L${pts[0][0].toFixed(1)} ${baseY.toFixed(1)} Z`
  const above = Math.max(0, Math.min(bottom, baseY) - top)
  const below = Math.max(0, bottom - Math.max(top, baseY))
  return (
    <g className="signed-curve" data-testid="signed-curve">
      <defs>
        <clipPath id={`${id}-up`}><rect x={x0} y={top} width={x1 - x0} height={above} /></clipPath>
        <clipPath id={`${id}-dn`}><rect x={x0} y={Math.max(top, baseY)} width={x1 - x0} height={below} /></clipPath>
      </defs>
      {casing && <path d={line} fill="none" stroke="var(--bg)" strokeWidth={width + 2.2} strokeLinejoin="round" />}
      {([['up', 'var(--sign-positive)'], ['dn', 'var(--sign-negative)']] as const).map(([side, colour]) => (
        <g key={side} clipPath={`url(#${id}-${side})`}>
          {area && <path className="fx-fade" d={fill} fill={colour} opacity=".1" stroke="none" />}
          <path className="fx-draw" pathLength={1} d={line} fill="none" stroke={colour} strokeWidth={width} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  )
}

/** Sign of a period result: the end value against the start level. */
export function curveSign(values: number[], start: number): 'positive' | 'negative' | 'neutral' {
  const end = values[values.length - 1]
  return typeof end !== 'number' || !Number.isFinite(end) || end === start ? 'neutral' : end > start ? 'positive' : 'negative'
}
