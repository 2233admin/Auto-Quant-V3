import { getLanguage, translate, uiValue, useLanguage } from '../../i18n'
import { pendingTrialTable, type TrialTable } from './resultModel'
import type { SnapshotLoad } from './useProjectSnapshots'

/** The table a confirmation shows for a counted trial: the previous kept result from the action's Project snapshot, or why there is none. */
export function confirmationTable(snapshot: SnapshotLoad | undefined, preview: { params?: Record<string, unknown> | null }): TrialTable {
  if (snapshot?.state === 'error') return { kind: 'none', message: translate(getLanguage(), 'The previous kept result could not be loaded.', '无法加载之前保留的结果。') }
  return pendingTrialTable(snapshot?.state === 'ready' ? snapshot.project : null, preview)
}

/**
 * Previous kept result against this trial's result for the same validation metrics. Presentation only: the rows, the
 * verdict and the primary-objective change all arrive from the Session decision matrix; nothing is subtracted or ranked here.
 */
export function BeforeAfterView({ table }: { table: TrialTable }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  if (table.kind === 'loading') return <p className="assistant-subtle" role="status">{t('Loading the previous kept result…', '正在加载之前保留的结果…')}</p>
  if (table.kind === 'none') return <p className="assistant-subtle assistant-before-after-none">{table.message}</p>
  const pending = table.mode === 'pending'
  const cell = (value: string | null, absent: string) => (value === null ? <><span aria-hidden="true">—</span><span className="sr-only">{absent}</span></> : value)
  return (
    <section className="assistant-before-after" aria-label={t('Before and after this trial', '本次试验前后对比')}>
      <h3>{t('Before and after', '试验前后')}</h3>
      <div className="tablewrap">
        <table className="tbl">
          <caption className="sr-only">{t('Validation metrics of the previous kept result and of this trial', '之前保留的结果与本次试验的验证集指标')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Metric', '指标')}</th>
              <th scope="col" className="r">{table.beforeTitle}</th>
              <th scope="col" className="r">{t('This trial', '本次试验')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}{row.primary && <> <span className="mk" translate="no">PRIMARY</span></>}</th>
                <td className="r mono">{cell(row.before, t('Not published', '未发布'))}</td>
                <td className="r mono">{pending ? <><span aria-hidden="true">—</span><span className="sr-only">{t('Not run yet', '尚未运行')}</span></> : cell(row.after, t('Not published', '未发布'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending
        ? <p className="assistant-subtle">{t('This trial runs only after you confirm. Nothing is recorded before then.', '本次试验只有在你确认后才会运行，此前不会记录任何结果。')}</p>
        : <>
            {table.verdict && <p className="assistant-subtle">{t('Verdict', '判决')}: <strong>{uiValue(table.verdict)}</strong></p>}
            {table.improvement !== null && <p className="assistant-subtle">{t('Primary objective change against the previous kept result', '主目标相对之前保留结果的变化')}: <span className="mono">{table.improvement}</span>{table.objective && <> (<span className="mono" translate="no">{table.objective}</span>)</>}</p>}
          </>}
      <p className="assistant-subtle">{t('Validation split only; the test split is never listed here.', '仅验证集；这里不会列出测试集。')}</p>
    </section>
  )
}
