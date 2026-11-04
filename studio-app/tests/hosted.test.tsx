import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WorkspaceSummary } from '../src/api'
import { ActionsProvider } from '../src/actions/ActionsContext'
import { setLanguage } from '../src/i18n'
import { Rail, TabBar } from '../src/shell/Rail'
import { assistantContextFor, HostedAssistantNote, isHosted } from '../src/shell/Hosted'
import type { ShellData } from '../src/useShellData'

const base: WorkspaceSummary = {
  kind: 'autoquant-studio-workspace-summary', generatedAt: '2026-11-04T00:00:00Z',
  harness: { id: 'autoquant.python-judge', version: '0.9.34', commit: null, dirty: false },
  source: { scope: 'workspace', rootDir: 'ws', workspace: { name: 'ws' } }, valid: true, diagnostics: [], projects: [],
}
/** The Actions provider reads window.location.hash; the node test environment has no window. */
function render(workspace: WorkspaceSummary, node: React.ReactNode): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash: '' } } })
  try { return renderToStaticMarkup(<ActionsProvider workspace={workspace} routeKey="hosted" go={() => undefined} refresh={() => undefined}>{node}</ActionsProvider>) }
  finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') }
}
const shell = (workspace: WorkspaceSummary): ShellData => ({ workspace, error: null, updated: null, live: true, setLive: () => undefined, refresh: () => undefined })
const hosted: WorkspaceSummary = { ...base, host: { kind: 'harness', capability: 'studio' } }

test('standalone Studio keeps the Assistant entry, the Ask Assistant context and the route', () => {
  setLanguage('en')
  const route = { view: 'factor', id: 'p', run: 'r' } as const
  assert.equal(isHosted(base), false)
  assert.deepEqual(assistantContextFor(route, isHosted(base)), { project: 'p', page: 'factor', run: 'r' })
  const rail = render(base, <Rail route={{ view: 'factors' }} data={shell(base)} narrow={false} onSearch={() => undefined} />)
  assert.match(rail, /view=assistant/)
  const tabs = renderToStaticMarkup(<TabBar route={{ view: 'factors' }} data={shell(base)} />)
  assert.match(tabs, /view=assistant/)
})

test('hosted Studio hides the Assistant entry, the Ask Assistant context and shows a short note on the route', () => {
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    assert.equal(isHosted(hosted), true)
    assert.equal(assistantContextFor({ view: 'factor', id: 'p' }, isHosted(hosted)), null)
    assert.equal(assistantContextFor({ view: 'strategy', id: 'p' }, isHosted(hosted)), null)
    const rail = render(hosted, <Rail route={{ view: 'factors' }} data={shell(hosted)} narrow={false} onSearch={() => undefined} />)
    assert.doesNotMatch(rail, /view=assistant/)
    assert.match(rail, /view=factors/)
    const tabs = renderToStaticMarkup(<TabBar route={{ view: 'factors' }} data={shell(hosted)} />)
    assert.doesNotMatch(tabs, /view=assistant/)
    const note = renderToStaticMarkup(<HostedAssistantNote />)
    assert.match(note, language === 'zh' ? /此 Studio 由宿主托管，研究请在宿主的 Agent 会话中进行。/ : /hosted by its host; run research in the host&#x27;s Agent session\./)
  }
  setLanguage('en')
})

test('every Core status, stage and verdict enum has a Chinese label', async () => {
  const { default: catalog } = await import('../src/locales/zh-CN.json')
  const { default: enums } = await import('../src/locales/core-enums.json')
  const missing = Object.entries(enums).flatMap(([group, values]) => (values as string[]).filter((value) => !((catalog as Record<string, string>)[value])).map((value) => `${group}: ${value}`))
  assert.deepEqual(missing, [])
})
