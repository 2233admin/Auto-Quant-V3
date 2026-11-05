import { uiTemplate, uiText } from '../i18n'
import type { EvoProgram, ProgramResponse } from './evolutionApi'
import { fixed, money, vocab } from './words'

/** A unified diff with added and removed lines marked by their own prefix and class, never colour alone. */
function Diff({ text }: { text: string }) {
  return (
    <pre className="rs-pre rs-diff" translate="no">
      {text.split('\n').map((line, i) => <span key={i} className={line.startsWith('+') && !line.startsWith('+++') ? 'is-add' : line.startsWith('-') && !line.startsWith('---') ? 'is-del' : line.startsWith('@@') ? 'is-hunk' : undefined}>{line}{'\n'}</span>)}
    </pre>
  )
}

function Offspring({ rows, parentScore, onSelect }: { rows: EvoProgram[]; parentScore: number | null; onSelect: (id: string) => void }) {
  if (rows.length === 0) return <p className="muted small">{uiText("No offspring: no later program used this one as its parent.")}</p>
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead><tr><th scope="col">{uiText("Program")}</th><th scope="col" className="r">{uiText("Generation")}</th><th scope="col" className="r">{uiText("In-sample score")}</th><th scope="col" className="r">{uiText("Change from parent")}</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <th scope="row"><button type="button" className="wb-link mono" onClick={() => onSelect(c.id)} translate="no">{c.patchName ?? c.id.slice(0, 8)}</button></th>
              <td className="r mono">{c.generation}</td>
              <td className="r mono">{c.score === null ? uiText("failed") : fixed(c.score)}</td>
              <td className="r mono">{c.score === null || parentScore === null ? '—' : `${c.score - parentScore >= 0 ? '+' : '−'}${Math.abs(c.score - parentScore).toFixed(3)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Facts({ r }: { r: Required<ProgramResponse>['program'] }) {
  return (
    <dl className="rs-kv">
      <dt>{uiText("In-sample score")}</dt><dd className="mono">{r.score === null ? uiText("failed") : fixed(r.score)}</dd>
      <dt>{uiText("Generation")}</dt><dd className="mono">{r.generation}{r.island !== null ? ` · ${uiTemplate("island {0}", [r.island])}` : ''}</dd>
      <dt>{uiText("Patch")}</dt><dd>{vocab(r.patchType)}{r.patchName ? <> · <span className="mono" translate="no">{r.patchName}</span></> : null}</dd>
      <dt>{uiText("Model")}</dt><dd className="mono" translate="no">{r.model ?? '—'}</dd>
      <dt>{uiText("Cost")}</dt><dd className="mono">{money(r.cost)}</dd>
      <dt>{uiText("Stage seconds")}</dt><dd className="mono">{Object.entries(r.timings).map(([k, v]) => `${vocab(k)} ${v.toFixed(1)}`).join(' · ') || '—'}</dd>
      <dt>{uiText("Public metrics")}</dt><dd className="mono small" translate="no">{Object.entries(r.publicMetrics).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(4) : String(v)}`).join(' · ') || '—'}</dd>
      <dt>{uiText("Private metrics")}</dt><dd>{r.privateMetrics === 'hidden' ? uiText("Recorded, never shown: held-out evidence stays with the skeptic.") : uiText("None recorded")}</dd>
    </dl>
  )
}

/** One program: facts, why it failed, its description and feedback, the diff from its parent, its source and offspring. */
export function ProgramInspector({ data, onSelect }: { data: ProgramResponse; onSelect: (id: string) => void }) {
  const r = data.program
  if (!r) return <p className="muted small">{uiText("Select a program in the lineage or the table.")}</p>
  return (
    <div className="vstack">
      <p className="rs-claim" translate="no">{r.patchName ?? r.id}</p>
      {r.failure && <p className="sig small" translate="no">{r.failure}</p>}
      <Facts r={r} />
      {data.parent && <p className="small">{uiText("Parent")} <button type="button" className="wb-link mono" onClick={() => onSelect(data.parent!.id)} translate="no">{data.parent.patchName ?? data.parent.id.slice(0, 8)}</button> · {fixed(data.parent.score)}</p>}
      {r.description && <p className="small" translate="no">{r.description}</p>}
      {r.feedback && <><h3 className="pj-sub">{uiText("Evaluator feedback")}</h3><pre className="rs-pre" translate="no">{r.feedback}</pre></>}
      <h3 className="pj-sub">{uiText("Change from parent")}</h3>
      {r.diff ? <Diff text={r.diff} /> : <p className="muted small">{uiText("No diff recorded (a seed program, or the source was not retained).")}</p>}
      <details><summary>{uiText("Full source")}</summary>{r.code ? <pre className="rs-pre" translate="no">{r.code}</pre> : <p className="muted small">{uiText("Source not retained for this run.")}</p>}</details>
      {(r.thought || r.stdout || r.stderr) && (
        <details><summary>{uiText("Model reasoning and logs (tails)")}</summary>
          {[r.thought, r.stdout, r.stderr].filter(Boolean).map((t, i) => <pre key={i} className="rs-pre" translate="no">{t}</pre>)}
        </details>
      )}
      <h3 className="pj-sub">{uiTemplate("Offspring · {0}", [data.offspring?.length ?? 0])}</h3>
      <Offspring rows={data.offspring ?? []} parentScore={r.score} onSelect={onSelect} />
    </div>
  )
}
