import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { FactorDiagnostics, ProjectSnapshot, RankSummary } from '../api'
import { hashWithJob, sectionOfHash } from '../actions/jobHash'
import { CompactTile, CompactTileGrid } from '../components/CompactTile'
import { pickIntegrity } from '../components/TrialCounter'
import { num, when } from '../format'
import { SPLIT_LABEL, SPLITS } from './factorMath'
import { gatedSplits, TEST_HIDDEN_NOTE } from './testGate'
import './workbench.css'

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const int = (v: number) => v.toLocaleString('en-US')

/** The Session ledger's selection adjustment for the validation-IC metric, if any Session recorded one. */
export const adjustmentOf = (project: ProjectSnapshot) =>
  project.sessions.map((s) => s.selectionIntegrity).find((s) => s?.selectionMetric === 'validation_mean_ic')?.selectionAdjustment

// ---------------------------------------------------------------------------------------------
// Left column: what was tested

/** `Study`, `Dataset` ... one row per fact; value is already formatted. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

type Tested = Pick<FactorDiagnostics, 'run' | 'dataset' | 'predictionUniverse' | 'protocol' | 'summary'>

export function TestedFacts({ study }: { study: Tested }) {
  const { protocol } = study
  const windows = protocol.splits.splits
  const context = protocol.horizons.filter((h) => h !== protocol.primaryHorizon).sort((a, b) => a - b)
  return (
    <dl className="facts">
      <Fact label="Study">
        <span className="mono" translate="no">{study.run.studyId}</span>
      </Fact>
      <Fact label="Run started">{when(study.run.startedAt)} UTC</Fact>
      <Fact label="Dataset">
        <span className="mono" translate="no">{study.dataset.id}</span>
        <span className="faint"> · {day(study.dataset.timeRange?.start)} to {day(study.dataset.timeRange?.end)}</span>
      </Fact>
      <Fact label="Scored asset">
        <span className="mono" translate="no">{(study.predictionUniverse.predictionAssets ?? []).join(', ') || '—'}</span>
      </Fact>
      <Fact label="Evaluation mode">
        <span className="mono">{study.predictionUniverse.evaluationMode ?? '—'}</span>
      </Fact>
      <Fact label="Horizon">
        {protocol.primaryHorizon}-bar primary
        {context.length > 0 && <span className="faint"> · context {context.join(', ')}-bar</span>}
      </Fact>
      <Fact label="Split windows">
        <span className="splitlist">
          {gatedSplits(study, SPLITS).map((s) => (
            <span key={s}>
              <span className="faint">{SPLIT_LABEL[s]}</span> {day(windows[s].start)} to {day(windows[s].end)}
            </span>
          ))}
        </span>
      </Fact>
    </dl>
  )
}

// ---------------------------------------------------------------------------------------------
// Core tiles

export type CoreDefs = { inference?: string; measure?: string }

const defNode = (d?: string) => (d ? <p>{d}</p> : undefined)

/**
 * Compact grid of published numbers for the validation split, plus the test-audit group only when the protocol marks
 * test as a visible diagnostic. One 34px row per metric, 3 to 4 columns on a wide screen.
 */
export function CoreTiles({
  study,
  project,
  validation,
  testAudit,
  testVisible,
  defs,
}: {
  study: Pick<FactorDiagnostics, 'protocol'>
  project: ProjectSnapshot
  validation: RankSummary | undefined
  testAudit: RankSummary | undefined
  testVisible: boolean
  defs?: CoreDefs
}) {
  const fam = pickIntegrity(project)?.researchFamily
  const trials = fam ? int(fam.totalExecutions) : '—'
  const trialNote = fam ? `${fam.uniqueSourceTrials} unique` : 'no ledger'
  const horizon = study.protocol.primaryHorizon
  if (!validation) return <p className="muted small">The Run published no validation summary.</p>
  const weak = validation.sufficient === false
  const measure = defNode(defs?.measure)
  const inference = defNode(defs?.inference)
  return (
    <div className="core">
      <div className="core-group">
        <h3 className="core-h">Validation · selection split · {horizon}-bar horizon</h3>
        <CompactTileGrid label={`Validation split, ${horizon}-bar horizon`}>
          <CompactTile label="Mean rank IC" value={num(validation.meanRankIc, 4)} info={measure} />
          <CompactTile label="HAC t" value={num(validation.hacTStatistic, 2)} info={inference} />
          <CompactTile label="HAC p" value={num(validation.hacNormalPValue, 3)} note="two-sided" info={inference} />
          <CompactTile label="Hit rate" value={num(validation.rankHitRate, 3)} info={<p>Share of bars with rank IC above 0.</p>} />
          <CompactTile label="Rank IC IR" value={num(validation.rankIcir, 3)} />
          <CompactTile label="Mean Pearson IC" value={num(validation.meanPearsonIc, 4)} />
          <CompactTile label="Rank IC std" value={num(validation.rankIcStandardDeviation, 3)} />
          <CompactTile
            label="Observations"
            value={int(validation.observations)}
            note={`min ${int(validation.minimumObservations)}`}
            tone={weak ? 'weak' : 'neutral'}
            toneReason={weak ? 'below min' : undefined}
          />
          <CompactTile label="Trials counted" value={trials} note={trialNote} />
        </CompactTileGrid>
      </div>
      {!(testVisible && testAudit) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
      {testVisible && testAudit && (
        <div className="core-group core-group--audit">
          <h3 className="core-h">Test · visible audit, not used for selection</h3>
          <CompactTileGrid label={`Test split visible audit, ${horizon}-bar horizon`}>
            <CompactTile label="Mean rank IC" value={num(testAudit.meanRankIc, 4)} />
            <CompactTile label="HAC t" value={num(testAudit.hacTStatistic, 2)} />
            <CompactTile label="HAC p" value={num(testAudit.hacNormalPValue, 3)} />
            <CompactTile label="Hit rate" value={num(testAudit.rankHitRate, 3)} />
            <CompactTile label="Observations" value={int(testAudit.observations)} note={`min ${int(testAudit.minimumObservations)}`} />
          </CompactTileGrid>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Tabs: tablist semantics, arrow/Home/End keys, URL hash `#tab-<id>` (the job id in the hash is kept)

export type TabDef<T extends string> = { id: T; label: string; badge?: string }

/** Hash-selected tab. `aliases` maps an old section anchor (e.g. `sec-ledger`) to the tab that now holds it. */
export function useHashTab<T extends string>(ids: readonly T[], fallback: T, aliases: Record<string, T> = {}): [T, (id: T) => void, string | null] {
  const read = useCallback((): { tab: T; anchor: string | null } => {
    let hash = ''
    try {
      hash = decodeURIComponent(sectionOfHash())
    } catch {
      hash = sectionOfHash()
    }
    if (hash.startsWith('tab-')) {
      const id = hash.slice(4) as T
      if (ids.includes(id)) return { tab: id, anchor: null }
    }
    const alias = aliases[hash]
    return alias ? { tab: alias, anchor: hash } : { tab: fallback, anchor: null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|'), fallback])
  const [state, setState] = useState(read)
  useEffect(() => {
    const on = () => setState(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [read])
  const select = useCallback((id: T) => {
    setState({ tab: id, anchor: null })
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hashWithJob(`tab-${id}`))
  }, [])
  return [state.tab, select, state.anchor]
}

export function Tabs<T extends string>({
  label,
  tabs,
  active,
  onSelect,
  panels,
}: {
  label: string
  tabs: TabDef<T>[]
  active: T
  onSelect: (id: T) => void
  panels: Record<T, ReactNode>
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    onSelect(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }
  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            className="tab"
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => move(e, i)}
          >
            {t.label}
            {t.badge && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
        {panels[active]}
      </div>
    </div>
  )
}
