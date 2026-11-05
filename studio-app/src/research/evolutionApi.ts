/**
 * Read model of one Shinka experiment's evolution run (`autoquant/studio_evolution.py`): programs, per-generation
 * series, the best lineage, prompt versions, meta-analysis files, stage durations and one program's detail. Private
 * (held-out) metrics never arrive, only whether the run recorded some; every series is computed on the server.
 */
export type EvoProgram = {
  id: string
  parent: string | null
  generation: number
  timestamp: number | null
  score: number | null
  correct: boolean
  island: number | null
  children: number
  archive: boolean
  copy: boolean
  patchType: string | null
  patchName: string | null
  model: string | null
  cost: number
}

export type Generation = { generation: number; programs: number; correct: number; successRate: number; best: number | null; mean: number | null; record: number | null; cost: number; cumulativeCost: number }

export type PromptVersion = { id: string; parent_id: string | null; name: string | null; description: string | null; generation: number | null; patch_type: string | null; program_count: number | null; correct_program_count: number | null; fitness: number | null; total_improvement: number | null; in_archive: boolean | null }

export type Stage = { stage: string; p50: number; p95: number; max: number; n: number }

type Envelope = { projectId: string; hypothesis: string; experiment: string; state: 'none' | 'ready' | 'unavailable'; reason: string | null; demo: string | null }

export type EvolutionRun = Envelope & {
  programs?: EvoProgram[]
  generations?: Generation[]
  bestPath?: string[]
  prompts?: PromptVersion[]
  metaFiles?: number[]
  throughput?: { stages: Stage[]; wallHours: number | null; perHour: number | null }
  privateMetrics?: 'hidden' | 'none'
  stats?: { programs: number; correct: number; successRate: number; best: number | null; bestGeneration: number | null; maxGeneration: number | null; sinceImprovement: number | null; costUsd: number; costKnown: boolean; promptCostUsd: number }
}

export type ProgramDetail = EvoProgram & {
  language: string | null
  code: string | null
  diff: string | null
  feedback: string | null
  publicMetrics: Record<string, unknown>
  privateMetrics: 'hidden' | 'none'
  description: string | null
  thought: string | null
  stdout: string | null
  stderr: string | null
  failure: string | null
  timings: Record<string, number>
  systemPrompt: string | null
}

export type ProgramResponse = Envelope & { program?: ProgramDetail; parent?: EvoProgram | null; offspring?: EvoProgram[] }
export type PromptResponse = Envelope & { prompt?: { id: string; name: string | null; text: string | null } }
export type MetaResponse = Envelope & { meta?: { processedCount: number; text: string } }

export type RunKey = { id: string; h: string; e: string }

const query = (k: RunKey, extra: Record<string, string> = {}) => new URLSearchParams({ id: k.id, h: k.h, e: k.e, ...extra }).toString()
export const runUrl = (k: RunKey) => `/api/v1/project/research/run?${query(k)}`
export const programUrl = (k: RunKey, program: string) => `/api/v1/project/research/program?${query(k, { program })}`
export const promptUrl = (k: RunKey, prompt: string) => `/api/v1/project/research/prompt?${query(k, { prompt })}`
export const metaUrl = (k: RunKey, n: number) => `/api/v1/project/research/meta?${query(k, { n: String(n) })}`
