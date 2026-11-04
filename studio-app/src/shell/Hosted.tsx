import { Notice } from '../Notice'
import { uiText } from '../i18n'
import type { Route } from '../route'

/**
 * A managed (Harness) launch marks the workspace summary with `host`. The host's own agent drives research there,
 * so Studio hides its in-process Assistant (rail entry, "Ask Assistant" button and route). Standalone is unchanged.
 */
export function isHosted(workspace: { host?: unknown } | null | undefined): boolean { return !!workspace?.host }

/** Same shape as the Assistant page's own context type; kept structural so the shell does not import a page. */
type AskContext = { project: string; study?: string; run?: string; page?: string }

/** The Assistant context a page offers for the floating "Ask Assistant" button; nothing when hosted. */
export function assistantContextFor(route: Route, hosted: boolean): AskContext | null {
  if (hosted) return null
  if (route.view === 'factor') return { project: route.id, page: 'factor', ...(route.study ? { study: route.study } : {}), ...(route.run ? { run: route.run } : {}) }
  if (route.view === 'portfolio' || route.view === 'strategy') return { project: route.id, page: 'portfolio' }
  return null
}

/** Shown on a direct visit to the Assistant route of a hosted Studio. Read-only: no action, no provider call. */
export function HostedAssistantNote() {
  return <div className="pg"><Notice kind="info" label={uiText('Hosted')} title={uiText('Assistant is not available here')}><p className="small muted">{uiText("This Studio is hosted by its host; run research in the host's Agent session.")}</p></Notice></div>
}
