import type { RunRow } from '../../api'
import { num, when } from '../../format'

/** Labels carry the headline number so the choice is informed; the value is the immutable Run id. */
export function runLabel(run: RunRow): string {
  return `${when(run.startedAt)} · ${run.subject.name} · ${run.primaryMetric} ${num(run.primaryValue, 4)} · ${run.status}`
}

/** `compact`: timestamp and status only. The headline number then sits in the page's stat chips, not in the option text. */
export function RunSelect({ label, runs, value, onChange, allowEmpty, bar, compact }: { label: string; runs: RunRow[]; value: string | undefined; onChange: (id: string) => void; allowEmpty?: boolean; bar?: boolean; compact?: boolean }) {
  const ordered = [...runs].sort((x, y) => y.startedAt.localeCompare(x.startedAt))
  return (
    <label className={bar ? 'runsel runsel--bar' : 'runsel'}>
      <span className={bar ? 'sr-only' : 'runsel-label'}>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {(allowEmpty || !value) && <option value="">Choose a Run…</option>}
        {value && !ordered.some((run) => run.id === value) && <option value={value}>Not a Run of this Project</option>}
        {ordered.map((run) => (
          <option key={run.id} value={run.id}>
            {compact ? `${when(run.startedAt)} UTC · ${run.status}` : runLabel(run)}
          </option>
        ))}
      </select>
    </label>
  )
}
