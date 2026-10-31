import { Glyph, type GlyphKind } from '../design/icons'
import type { Job, StageState } from './types'

/** Stage states as the job payload reports them, in the words the page shows. Never inferred from time or output. */
const LOOK: Record<StageState, { glyph: GlyphKind; word: string; cls: string }> = {
  done: { glyph: 'confirmed', word: 'done', cls: 'is-done' },
  running: { glyph: 'running', word: 'current', cls: 'is-current' },
  failed: { glyph: 'error', word: 'failed', cls: 'is-failed' },
  skipped: { glyph: 'dropped', word: 'blocked', cls: 'is-blocked' },
  pending: { glyph: 'proposed', word: 'waiting', cls: 'is-pending' },
}

/**
 * The compact horizontal stage pipeline: data checked, split frozen, candidate run, selection, test audit.
 * Each step carries its state as a shape and a word, so colour is never the only signal. For a
 * whole-action job Studio only knows the action as a whole, and says so rather than faking progress.
 */
export function StagePipeline({ job }: { job: Pick<Job, 'stages' | 'stageMode' | 'status'> }) {
  const whole = job.stageMode === 'whole-action'
  return (
    <div className="stages">
      <ol className="stages-list" aria-label="Planned stages">
        {job.stages.map((stage, index) => {
          const look = LOOK[stage.state] ?? LOOK.pending
          return (
            <li key={stage.id} className={`stage ${look.cls}`}>
              <span className="stage-n" aria-hidden="true">{index + 1}</span>
              <span className="stage-label">{stage.label}</span>
              <span className="stage-state">
                <Glyph kind={look.glyph} />
                {look.word}
              </span>
            </li>
          )
        })}
      </ol>
      {whole && (
        <p className="small muted stages-note">
          Studio reports this command as a whole, not stage by stage. The stages show the planned path, not measured progress.
        </p>
      )}
    </div>
  )
}
