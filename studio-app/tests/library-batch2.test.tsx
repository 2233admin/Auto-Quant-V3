import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { FactorLibrary } from '../src/library/FactorLibrary'
import { StrategyLibrary } from '../src/library/StrategyLibrary'
import { MiniCurve } from '../src/library/LibraryCards'
import { groupRows, meanOf, nextSort, sortRows } from '../src/library/libraryView'
import { runEdge, runSign } from '../src/library/runColumns'
import type { HistoryRun } from '../src/library/runHistoryApi'
import { WorkbenchShell } from '../src/components/workbench/WorkbenchShell'
import { clampSplit, splitBounds, splitColumns, splitFromPointer, splitKey, SPLIT } from '../src/components/workbench/splitter'
import { curveSign } from '../src/components/SignedCurve'
import { ActionsProvider } from '../src/actions/ActionsContext'
import type { WorkspaceSummary } from '../src/api'
import { syntheticFactors, syntheticStrategies, syntheticWorkspace } from './libraryFixture'

function withWindow<T>(render: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash: '', search: '' }, addEventListener() {}, removeEventListener() {} } })
  try { return render() } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete (globalThis as { window?: unknown }).window }
}
const page = (workspace: WorkspaceSummary, node: React.ReactNode) => withWindow(() => renderToStaticMarkup(<ActionsProvider workspace={workspace} routeKey="library" go={() => {}} refresh={() => {}}>{node}</ActionsProvider>))

const run = (over: Partial<HistoryRun>) => ({ id: 'r', status: 'succeeded', verdict: 'succeeded', primaryMetric: 'validation_net_sharpe', primaryValue: 1, ...over }) as HistoryRun

test('splitter keys: arrows move 2 points (10 with Shift), Home and End snap to the minimum widths, Enter resets to 40', () => {
  const width = 1200
  const { min, max } = splitBounds(width)
  assert.ok(Math.abs(min - (320 / (width - 17)) * 100) < 1e-9)
  assert.ok(Math.abs(max - (100 - (480 / (width - 17)) * 100)) < 1e-9)
  assert.equal(splitKey(40, 'ArrowRight', width), 42)
  assert.equal(splitKey(40, 'ArrowLeft', width), 38)
  assert.equal(splitKey(40, 'ArrowRight', width, true), 50)
  assert.equal(splitKey(50, 'Home', width), min)
  assert.equal(splitKey(50, 'End', width), max)
  assert.equal(splitKey(55, 'Enter', width), 40)
  assert.equal(splitKey(40, 'a', width), null)
  // The minimums hold at the extremes: 320px left, 480px right.
  assert.equal(splitKey(min, 'ArrowLeft', width), min)
  assert.equal(splitKey(max, 'ArrowRight', width), max)
  assert.ok(((splitKey(40, 'Home', width) as number) / 100) * (width - SPLIT.handle) >= 320 - 1e-9)
  assert.ok(((100 - (splitKey(40, 'End', width) as number)) / 100) * (width - SPLIT.handle) >= 480 - 1e-9)
})

test('splitter pointer and clamp: the stored percent never breaks a minimum width, a narrow shell collapses to the left minimum', () => {
  assert.equal(clampSplit(5, 1400), splitBounds(1400).min)
  assert.equal(clampSplit(99, 1400), splitBounds(1400).max)
  assert.equal(clampSplit(Number.NaN, 1400), 40)
  assert.equal(splitFromPointer(0, 1400), splitBounds(1400).min)
  assert.ok(Math.abs(splitFromPointer(8.5 + 0.5 * (1400 - 17), 1400) - 50) < 1e-9)
  const narrow = splitBounds(700)
  assert.equal(narrow.min, narrow.max)
  assert.match(splitColumns(40), /^clamp\(320px, calc\(\(100% - 17px\) \* 0\.4000\), calc\(100% - 17px - 480px\)\) 17px minmax\(0, 1fr\)$/)
})

test('workbench shell renders a separator with aria-valuenow only when there are two panes', () => {
  const two = renderToStaticMarkup(<WorkbenchShell id="test" left={<p>left</p>} right={<p>right</p>} />)
  assert.match(two, /role="separator"/)
  assert.match(two, /aria-orientation="vertical"/)
  assert.match(two, /aria-valuenow="40"/)
  assert.match(two, /tabindex="0"/)
  assert.match(two, /grid-template-columns:clamp\(320px/)
  const one = renderToStaticMarkup(<WorkbenchShell right={<p>right</p>} />)
  assert.doesNotMatch(one, /role="separator"/)
})

test('library sparkline takes the sign colour of its end value, with a faint area under it', () => {
  const up = renderToStaticMarkup(<MiniCurve label="c" points={[{ split: 'train', value: 1 }, { split: 'train', value: 0.9 }, { split: 'validation', value: 1.2 }]} />)
  const down = renderToStaticMarkup(<MiniCurve label="c" points={[{ split: 'train', value: 1 }, { split: 'train', value: 1.3 }, { split: 'validation', value: 0.8 }]} />)
  assert.match(up, /data-sign="positive"/)
  assert.match(down, /data-sign="negative"/)
  assert.match(up, /<polygon[^>]*opacity="\.1"/)
  assert.equal(curveSign([1, 0.5], 1), 'negative')
  assert.equal(curveSign([1, 1], 1), 'neutral')
})

test('run rows: sign edge follows the headline metric, failed Runs are grey, unsigned metrics have no edge', () => {
  assert.equal(runEdge(run({ primaryValue: 1.2 })), 'positive')
  assert.equal(runEdge(run({ primaryValue: -0.4 })), 'negative')
  assert.equal(runEdge(run({ status: 'failed', primaryValue: 5 })), 'muted')
  assert.equal(runEdge(run({ verdict: 'REVERT', primaryValue: 0.78 })), 'muted')
  assert.equal(runEdge(run({ verdict: 'KEEP', primaryValue: 0.78 })), 'positive')
  assert.equal(runEdge(run({ primaryMetric: 'primary_eligible_event_count', primaryValue: 40 })), undefined)
  assert.equal(runSign(run({ primaryValue: 0 })), 'neutral')
  assert.equal(runSign(run({ status: 'failed', primaryValue: 3 })), 'neutral')
})

test('library view helpers: sort puts missing values last, groups keep order, header click flips', () => {
  const rows = [{ n: 'b', v: 2 }, { n: 'a', v: null }, { n: 'c', v: 5 }]
  assert.deepEqual(sortRows(rows, { key: 'v', dir: -1 }, r => r.v).map(r => r.n), ['c', 'b', 'a'])
  assert.deepEqual(sortRows(rows, { key: 'v', dir: 1 }, r => r.v).map(r => r.n), ['b', 'c', 'a'])
  assert.deepEqual(nextSort({ key: 'updated', dir: -1 }, 'updated'), { key: 'updated', dir: 1 })
  assert.deepEqual(nextSort({ key: 'updated', dir: -1 }, 'name'), { key: 'name', dir: 1 })
  assert.deepEqual(groupRows(rows, ['x', 'y'], r => (r.v === 5 ? 'y' : 'x')).map(g => [g.id, g.rows.length]), [['x', 2], ['y', 1]])
  assert.equal(meanOf([null, 1, 3, undefined]), 2)
  assert.equal(meanOf([null]), null)
})

test('a synthetic 120-factor library renders every row with sortable headers, density and group controls', () => {
  const workspace = syntheticWorkspace(syntheticFactors(120))
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    const html = page(workspace, <FactorLibrary workspace={workspace} go={() => undefined} />)
    assert.equal((html.match(/class="library-row"/g) ?? []).length, 120)
    assert.match(html, /aria-sort="descending"/)
    assert.match(html, /class="library-sort"/)
    assert.match(html, /data-density="comfortable"/)
    assert.match(html, /aria-pressed="false"/)
    assert.match(html, /class="library-spark"[^>]*data-sign="(positive|negative)"|data-sign="(positive|negative)"[^>]*class="library-spark"|<svg class="library-spark"/)
  }
  setLanguage('en')
})

test('a synthetic strategy library renders its rows and the sign-coloured curves', () => {
  const workspace = syntheticWorkspace(syntheticStrategies(40))
  const html = page(workspace, <StrategyLibrary workspace={workspace} go={() => undefined} />)
  assert.equal((html.match(/class="library-row"/g) ?? []).length, 40)
  assert.match(html, /data-sign="(positive|negative)"/)
})

test('strategy lifecycle states Defined, Backtested and Tuned render from the published state and group by it', () => {
  const workspace = syntheticWorkspace(syntheticStrategies(40))
  const states = new Set(workspace.projects.map(p => p.library!.strategy!.state))
  assert.deepEqual([...states].sort(), ['Backtested', 'Defined', 'Tuned'])
  setLanguage('zh')
  const html = page(workspace, <StrategyLibrary workspace={workspace} go={() => undefined} />)
  for (const word of ['已调优', '已回测', '已定义']) assert.match(html, new RegExp(word))
  setLanguage('en')
})
