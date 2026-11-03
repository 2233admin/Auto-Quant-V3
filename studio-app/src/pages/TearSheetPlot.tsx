/** Neutral, signed axes and line patterns; drawing only, never computes research metrics. */
export function TearSheetPlot({ width, height, series, labels, bars = false, percent = false }: {
  width: number; height: number; series: { name: string; values: (number | null)[] }[]
  labels: string[]; bars?: boolean; percent?: boolean
}) {
  const left = 58, top = 12, w = Math.max(1, width - left - 18), h = Math.max(1, height - 48)
  const numbers = series.flatMap(s => s.values.filter((v): v is number => v !== null))
  const low = Math.min(0, ...numbers), high = Math.max(0.000001, ...numbers)
  const x = (i: number) => left + (i + 0.5) * w / Math.max(1, labels.length)
  const y = (v: number) => top + h * (high - v) / (high - low)
  const format = (v: number) => percent ? `${(v * 100).toFixed(2)}%` : v.toFixed(3)
  return <svg width={width} height={height} role="img" aria-label={series.map(s => s.name).join(', ')}>
    {[low, (high + low) / 2, high].map((v, i) => <g key={i}>
      <line x1={left} x2={left + w} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
      <text x={left - 6} y={y(v) + 4} textAnchor="end" fill="var(--muted)" fontSize={11}>{format(v)}</text>
    </g>)}
    {series.map((s, j) => <g key={s.name} stroke="var(--text)" fill="var(--text)" opacity={0.4 + 0.6 * (j + 1) / series.length}>
      {bars ? s.values.map((v, i) => v === null ? null : <g key={i}>
        <rect x={x(i) - w / labels.length * 0.22} y={Math.min(y(0), y(v))} width={w / labels.length * 0.44} height={Math.max(1, Math.abs(y(v) - y(0)))} />
        <title>{`${labels[i]}: ${format(v)}`}</title>
      </g>) : <path fill="none" strokeWidth={1.6} strokeDasharray={j === 0 ? undefined : `${j + 2} ${j + 1}`} d={s.values.map((v, i, values) => v === null ? '' : `${i === 0 || values[i - 1] === null ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')} />}
    </g>)}
    {labels.map((label, i) => bars || i === 0 || i === labels.length - 1 ? <text key={i} x={x(i)} y={top + h + 20} textAnchor={bars ? 'middle' : i === 0 ? 'start' : 'end'} fill="var(--muted)" fontSize={11}>{label}</text> : null)}
  </svg>
}
