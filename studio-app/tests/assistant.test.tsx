import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionsProvider } from '../src/actions/ActionsContext'
import { AssistantPage } from '../src/pages/Assistant'
import { setLanguage } from '../src/i18n'
import type { WorkspaceSummary } from '../src/api'

function withWindow<T>(render: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { hash: '', search: '', pathname: '/' },
    history: { replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  } })
  try { return render() } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('empty assistant chat shows template cards grouped by task type', () => {
  setLanguage('en')
  const workspace = { source: { rootDir: 'D:/tmp/assistant-test' }, projects: [] } as unknown as WorkspaceSummary
  const html = withWindow(() => renderToStaticMarkup(
    <ActionsProvider workspace={workspace} routeKey="assistant" go={() => {}} refresh={() => {}}>
      <AssistantPage workspace={workspace} />
    </ActionsProvider>,
  ))
  assert.match(html, /Strategy/)
  assert.match(html, /Factor/)
  assert.match(html, /Data query/)
  assert.match(html, /Research tool/)
  assert.match(html, /A-share 20-day momentum strategy/)
  assert.match(html, /Fill and confirm/)
  assert.equal((html.match(/type="text"/g) || []).length, 6)
  assert.equal((html.match(/aria-required="true"/g) || []).length, 3)
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>Use template/)
  assert.match(html, /<button[^>]*disabled[^>]*>Send/)
  assert.doesNotMatch(html, /assistant-prompts/)
})