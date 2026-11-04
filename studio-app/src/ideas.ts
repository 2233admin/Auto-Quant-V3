import { useEffect, useState } from 'react'
import type { ProjectSummary, WorkspaceSummary } from './api'

/** One thing in the Workspace that needs a person to look: a Project that does not verify, or a Workspace diagnostic. */
export type AttentionItem =
  | { kind: 'project'; project: ProjectSummary; reason: string }
  | { kind: 'workspace'; reason: string; path?: string }

/** Read straight from the Workspace summary: invalid Projects first, then Workspace-level diagnostics. */
export function attentionItems(workspace: WorkspaceSummary | null): AttentionItem[] {
  if (!workspace) return []
  const items: AttentionItem[] = workspace.projects
    .filter((p) => !p.valid)
    .map((project) => ({
      kind: 'project' as const,
      project,
      reason: project.diagnostics > 0 ? project.diagnostics === 1 ? 'The Project does not verify (1 diagnostic).' : `The Project does not verify (${project.diagnostics} diagnostics).` : 'The Project does not verify.',
    }))
  for (const d of workspace.diagnostics) items.push({ kind: 'workspace', reason: d.message ?? d.code ?? 'Workspace diagnostic', path: d.path })
  return items
}

/** Needs-attention first, then the most recent Run, then name. */
export function sortIdeas(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? 1 : -1
    const ta = a.latestRunAt ?? ''
    const tb = b.latestRunAt ?? ''
    if (ta !== tb) return tb.localeCompare(ta)
    return a.name.localeCompare(b.name)
  })
}

const RECENT_KEY = 'aq.studio.recent-projects'
const RECENT_MAX = 3

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

/** The last few opened Project ids (newest first). Opening a Project, or any page inside it, moves it to the front. */
export function useRecentProjects(openId: string | null): string[] {
  const [ids, setIds] = useState<string[]>(readRecent)
  useEffect(() => {
    if (!openId) return
    const next = [openId, ...readRecent().filter((id) => id !== openId)].slice(0, RECENT_MAX)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable: the list just lives in memory */
    }
    setIds(next)
  }, [openId])
  return ids
}
