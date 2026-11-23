import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { Empty } from '../src/components/States'
import { AttentionPage } from '../src/pages/Attention'
import { syntheticFactors, syntheticWorkspace } from './libraryFixture'

const NO_EVIDENCE = { en: 'No evidence in this Project', zh: '此项目没有证据' }
const headline = (html: string) => /<p class="st-title">([^<]*)<\/p>/.exec(html)?.[1]

function render(language: 'en' | 'zh', node: () => React.ReactNode) {
  setLanguage(language)
  try { return renderToStaticMarkup(<>{node()}</>) } finally { setLanguage('en') }
}

for (const language of ['en', 'zh'] as const) {
  test(`Empty keeps the catalogue headline for missing Project evidence (${language})`, () => {
    assert.equal(headline(render(language, () => <Empty />)), NO_EVIDENCE[language])
    const withCause = render(language, () => <Empty title="Coverage not published" />)
    assert.equal(headline(withCause), NO_EVIDENCE[language])
    assert.match(withCause, /<p class="st-body">[^<]+<\/p>/)
  })

  test(`Empty kind="message" uses its own sentence and never claims missing evidence (${language})`, () => {
    const html = render(language, () => <Empty kind="message" title="No Run matches these filters." />)
    assert.equal(headline(html), language === 'en' ? 'No Run matches these filters.' : '没有符合筛选条件的运行记录。')
    assert.doesNotMatch(html, new RegExp(NO_EVIDENCE[language]))
  })

  test(`Empty kind="readOnly" shows the catalogue Read-only headline once (${language})`, () => {
    const html = render(language, () => <Empty kind="readOnly"><p>reason</p></Empty>)
    const readOnly = language === 'en' ? 'Read-only session' : '只读会话'
    assert.equal(headline(html), readOnly)
    assert.equal(html.split(readOnly).length - 1, 1)
    assert.doesNotMatch(html, new RegExp(NO_EVIDENCE[language]))
  })

  test(`Attention with nothing to do does not say the Project has no evidence (${language})`, () => {
    const workspace = syntheticWorkspace(syntheticFactors(3))
    const html = render(language, () => <AttentionPage workspace={workspace} />)
    assert.doesNotMatch(html, new RegExp(NO_EVIDENCE[language]))
  })
}
