import type { WorkspaceSummary } from '../api'
import { Empty, Loading } from '../components/States'
import { Glyph } from '../design/icons'
import { attentionItems } from '../ideas'
import { PageHead } from '../library/parts'
import { routeHref } from '../route'
import './ideas.css'

/** Everything in the Workspace that needs a person to look, read from the Workspace summary. */
export function AttentionPage({ workspace }: { workspace: WorkspaceSummary | null }) {
  if (!workspace) {
    return (
      <div className="pg">
        <Loading label="Loading…" minHeight={240} />
      </div>
    )
  }
  const items = attentionItems(workspace)
  return (
    <div className="pg">
      <PageHead
        title="Attention"
        lede={items.length === 0 ? 'Everything in this Workspace verifies.' : `${items.length} ${items.length === 1 ? 'item needs' : 'items need'} a look.`}
      />
      {items.length === 0 ? (
        <Empty title="Nothing needs attention" minHeight={96} />
      ) : (
        <ul className="att-list" aria-label="Items that need attention">
          {items.map((item, i) => (
            <li key={item.kind === 'project' ? item.project.id : `ws-${i}`} className="att-item">
              <span>
                <Glyph kind="error" signal />{' '}
                {item.kind === 'project' ? (
                  <a href={routeHref({ view: 'project', id: item.project.id })} translate="no">{item.project.name}</a>
                ) : (
                  <strong>Workspace</strong>
                )}
                {item.kind === 'project' && <span className="faint small mono" translate="no"> {item.project.id}</span>}
              </span>
              <p className="muted small">{item.reason}</p>
              {item.kind === 'workspace' && item.path && <p className="faint small mono" translate="no">{item.path}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
