import { uiTemplate, uiText, uiValue } from '../i18n'
import type { ReactNode } from 'react'
import { Info } from '../components/Info'
import { Glyph } from '../design/icons'
import { plural } from '../format'
import { Notice } from '../Notice'
import { Empty as EmptyState } from '../components/States'
import type { Verdict } from '../pages/FactorEvidence'
import '../components/states.css'
import { loadState, type Loaded } from './data'
import './library.css'

const VERDICT: Record<Verdict, { word: string; glyph: 'supported' | 'error' | 'inconclusive'; signal: boolean }> = {
  pass: { get word() { return uiText("Supported") }, glyph: 'supported', signal: false },
  fail: { get word() { return uiText("Inconclusive") }, glyph: 'error', signal: true },
  inconclusive: { get word() { return uiText("Inconclusive") }, glyph: 'inconclusive', signal: false },
}

/** Server verdict as a word and a shape, never colour alone. `none` says why there is no verdict. */
export function VerdictBadge({ verdict, none, detail }: { verdict: Verdict | null; none?: string; detail?: string }) {
  if (!verdict) return <span className="faint small">{none ?? uiText("Not published")}</span>
  const v = VERDICT[verdict]
  return (
    <span className="pc-badge" title={detail}>
      <Glyph kind={v.glyph} signal={v.signal} />
      <span className={v.signal ? 'sig' : undefined}>{uiValue(v.word)}</span>
    </span>
  )
}

export function PageHead({ title, lede, info }: { title: string; lede: ReactNode; info?: ReactNode }) {
  return (
    <header className="pg-head">
      <h1>{title}</h1>
      <p className="muted small">
        {uiValue(lede)}
        {info && <Info label={uiTemplate("About {0}", [title])}>{info}</Info>}
      </p>
    </header>
  )
}

/** Honest status of the per-Project fetches behind a list. */
export function LoadNote({ all }: { all: Loaded[] }) {
  const { loading, failed } = loadState(all)
  if (loading === 0 && failed === 0) return null
  return (
    <>
      {failed > 0 && <Notice kind="error" label={uiText("Error")} title={uiTemplate("{0} could not be loaded.", [plural(failed, 'Project')])} subtitle={uiText("Their rows are missing from this list.")} />}
      {loading > 0 && <p className="muted small lib-loading" role="status"><span className="st-spin" aria-hidden="true" />{uiText("Loading ")}{plural(loading, 'Project')}…</p>}
    </>
  )
}

/** One toolbar control. The label is read by screen readers and shown only when `visible` (the control's own first option says what it filters). */
export function Field({ label, children, visible = false }: { label: string; children: ReactNode; visible?: boolean }) {
  return (
    <label className={`lib-field${visible ? ' lib-field--shown' : ''}`}>
      <span>{uiValue(label)}</span>
      {children}
    </label>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState title={String(children)} minHeight={96} />
}

export const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b))
