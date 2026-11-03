import { translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
import type { WorkspaceSummary } from '../api'
import { Empty, Loading } from '../components/States'
import { Glyph } from '../design/icons'
import { attentionItems } from '../ideas'
import { PageHead } from '../library/parts'
import { routeHref } from '../route'
import './ideas.css'
/** Everything in the Workspace that needs a person to look, read from the Workspace summary. */
export function AttentionPage({ workspace }: { workspace: WorkspaceSummary | null }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  if (!workspace) {
    return (
      <div className="pg">
        <Loading label={t('Loading…', '加载中…')} minHeight={240} />
      </div>
    )
  }
  const items = attentionItems(workspace)
  return (
    <div className="pg">
      <PageHead
        icon="attention" micro="ATTENTION"
        title={t('Attention', '待处理')}
        lede={items.length === 0 ? t('Everything in this Workspace verifies.', '工作区中的所有项目均已通过验证。') : language === 'zh' ? `有 ${items.length} 项需要查看。` : uiTemplate("{0} {1} a look.", [items.length, items.length === 1 ? 'item needs' : 'items need'])}
      />
      {items.length === 0 ? (
        <Empty title={t('Nothing needs attention', '没有需要处理的事项')} minHeight={96} />
      ) : (
        <ul className="att-list" aria-label={uiText("Items that need attention")}>
          {items.map((item, i) => (
            <li key={item.kind === 'project' ? item.project.id : `ws-${i}`} className="att-item">
              <span>
                <Glyph kind="error" signal />{' '}
                {item.kind === 'project' ? (
                  <a href={routeHref({ view: 'project', id: item.project.id })} translate="no">{item.project.name}</a>
                ) : (
                  <strong>{t('Workspace', '工作区')}</strong>
                )}
                {item.kind === 'project' && <span className="faint small mono" translate="no"> {item.project.id}</span>}
              </span>
              <p className="muted small">{uiValue(item.reason)}</p>
              {item.kind === 'workspace' && item.path && <p className="faint small mono" translate="no">{item.path}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
