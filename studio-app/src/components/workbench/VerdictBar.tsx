import { uiText, uiValue } from '../../i18n'
import { useId, useState, type ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../../design/icons'
import { Collapse } from '../motion/Collapse'
import './workbench.css'

export type VerdictTone = 'bad' | 'ok' | 'warn'
const GLYPH: Record<VerdictTone, GlyphKind> = { bad: 'error', ok: 'supported', warn: 'inconclusive' }
export type VerdictReason = { tone: 'good' | 'bad' | 'info'; text: ReactNode; field?: string }

/**
 * One-line verdict: tone pill (word + glyph, never colour alone) and a clause of about 60 characters (the numbers that
 * decide it). "More" shows `detail` (the long explanation, default: the clause) and the `reasons` list (same tones as
 * VerdictBand / HeroLine).
 */
export function VerdictBar({ tone, word, children, detail, reasons = [] }: { tone: VerdictTone; word: string; children: ReactNode; detail?: ReactNode; reasons?: VerdictReason[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="wb-verdict" data-tone={tone}>
      <div className="wb-verdict-line" role="status">
        <span className="wb-pill">
          <Glyph kind={GLYPH[tone]} signal={tone === 'bad'} />
          {uiValue(word)}
        </span>
        <span className="wb-verdict-text" title={typeof children === 'string' ? children : undefined}>{children}</span>
        <button type="button" className="wb-link" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          {open ? uiText("Less") : uiText("More")}
        </button>
      </div>
      <Collapse open={open} id={id} className="wb-verdict-more">
        <p>{detail ?? children}</p>
        {reasons.length > 0 && (
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>
                <Glyph kind={r.tone === 'good' ? 'supported' : r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
                <span>
                  {uiValue(r.text)}
                  {r.field && <span className="faint small mono"> {r.field}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Collapse>
    </div>
  )
}
