import { actionCall } from '../../actions/client'
import type { ActionsBootstrap, Preview } from '../../actions/types'

export type Package = {
  schemaVersion: number; assetClass: string; frequency?: string; baseInterval?: string
  market: Record<string, string>; priceAdjustment: string
  provider: { name: string; terms: string; retrievedAt: string | null; sourceUri: string | null }
  assets: { symbol: string; venue: string; currency: string }[]
}
export type SourcePreview = {
  columns: string[]; sample: Record<string, string>[]; mapping: Record<string, string>
  frequency: string; market: Record<string, string>; assets: string[]; package: Package | null; sha256: string
}
export type QualityCheck = { id: string; verdict: 'pass' | 'warn' | 'fail'; count: number; examples: Record<string, unknown>[]; hint?: string; rate?: number | null; coverage?: string }
export type QualityReport = {
  schemaVersion: number; sourceHash: string; verdict: 'pass' | 'warn' | 'fail'
  jumpThreshold: number; longGapBars: number; universeStatus: string; frequency: string
  summary: QualityCheck[]
  assets: { asset: string; rows: number; dateRange: { start: string; end: string } | null; market: Record<string, string>; missingBarRate: number | null; checks: QualityCheck[]; verdict: string }[]
}
export type IntakePreview = Omit<Preview, 'params'> & { params: Record<string, unknown>; request: unknown; package: Package }
export const listSources = (b: ActionsBootstrap) => actionCall<{ sources: { path: string; kind: string }[] }>(b, 'GET', '/api/v1/data-sources')
export const inspectSource = (b: ActionsBootstrap, source: string) => actionCall<SourcePreview>(b, 'GET', `/api/v1/data-sources?${new URLSearchParams({ path: source })}`)
export const checkData = (b: ActionsBootstrap, source: string, options: Record<string, unknown>) => actionCall<QualityReport>(b, 'POST', '/api/v1/actions', { actionId: 'data.check', params: { source, options } })
export const previewIntake = (b: ActionsBootstrap, project: string, params: Record<string, unknown>) => actionCall<IntakePreview>(b, 'POST', '/api/v1/actions/preview', { actionId: 'project.intake', project, params })
export const confirmIntake = (b: ActionsBootstrap, preview: IntakePreview) => actionCall<{ jobId: string }>(b, 'POST', '/api/v1/actions', { actionId: 'project.intake', project: preview.project, params: preview.params, commandHash: preview.commandHash, confirm: true, secondConfirm: true })
