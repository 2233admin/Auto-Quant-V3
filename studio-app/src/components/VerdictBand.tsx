import { uiValue } from '../i18n'
import type { ReactNode } from 'react'
import { Glyph } from '../design/icons'

export type Verdict = 'pass' | 'fail' | 'inconclusive'
const GLYPH = { pass: 'supported', fail: 'error', inconclusive: 'inconclusive' } as const

export type Reason = { tone: 'bad' | 'info'; text: ReactNode; field: string }

/**
 * The summary-band verdict of a lane page. The word and the enum behind it come from the server; this component only
 * lays them out. State is carried by the word, a distinct glyph shape and the border, never by colour alone.
 */
export function VerdictBand({
  id,
  kicker,
  verdict,
  word,
  detail,
  reasons,
}: {
  id: string
  kicker: string
  verdict: Verdict
  word: string
  detail: ReactNode
  reasons: Reason[]
}) {
  return (
    <section className={`verdict verdict--${verdict}`} aria-labelledby={id}>
      <div className="verdict-main">
        <p className="verdict-kicker">{kicker}</p>
        <h2 id={id} className="verdict-word">
          <Glyph kind={GLYPH[verdict]} signal={verdict === 'fail'} />
          <span>{uiValue(word)}</span>
        </h2>
        <p className="muted small">{detail}</p>
      </div>
      <ul className="verdict-reasons">
        {reasons.map((r, i) => (
          <li key={i}>
            <Glyph kind={r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
            <span>
              {uiValue(r.text)}
              <span className="faint small mono verdict-field">{r.field}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
