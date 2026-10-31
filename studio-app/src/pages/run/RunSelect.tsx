import type { RunRow } from '../../api'
import { num, when } from '../../format'

/** Labels carry the headline number so the choice is informed; the value is the immutable Run id. */
export function runLabel(run: RunRow): string {
  return `${when(run.startedAt)} · ${run.subject.name} · ${run.primaryMetric} ${num(run.primaryValue, 4)} · ${run.status}`
}

export function RunSelect({ label, runs, value, onChange, allowEmpty }: { label: string; runs: RunRow[]; value: string | undefined; onChange: (id: string) => void; allowEmpty?: boolean }) {
  const ordered = [...runs].sort((x, y) => y.startedAt.localeCompare(x.startedAt))
  return (
    <label className="runsel">
      <span className="runsel-label">{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {(allowEmpty || !value) && <option value="">Choose a Run…</option>}
        {ordered.map((run) => (
          <option key={run.id} value={run.id}>
            {runLabel(run)}
          </option>
        ))}
      </select>
    </label>
  )
}
