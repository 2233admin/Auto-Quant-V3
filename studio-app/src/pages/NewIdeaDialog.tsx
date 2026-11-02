import { translate, uiTemplate, useLanguage } from '../i18n'
import { useEffect, useState } from 'react'
import { useActions } from '../actions/ActionsContext'
import { launchPreviewed, previewAction } from '../actions/candidateApi'
import { getDatasets, jobError, waitJob, type DatasetChoices } from '../actions/ideaApi'
import type { Preview } from '../actions/types'
import { ActionRow } from '../components/workbench'
import { routeHref } from '../route'
import { Modal } from '../shell/Modal'
import '../actions/actions.css'
export function NewIdeaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const { state, go, jobFinished } = useActions()
  const b = state.mode === 'on' ? state.bootstrap : null
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [datasets, setDatasets] = useState<DatasetChoices | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open && b) getDatasets(b).then(setDatasets).catch(e => setError(String(e))) }, [open, b])
  const change = () => { setPreview(null); setError('') }
  const reason = !b ? t('Start Studio with --allow-actions to create a factor.', '请使用 --allow-actions 启动 Studio 才能创建因子。') : busy ? t('Creating the Project…', '正在创建项目…') : !name.trim() ? t('Give this factor a short name.', '请为因子填写简短名称。') : !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) ? t('Use lowercase letters, digits and dashes for the Project id.', '项目标识请使用小写英文字母、数字和连字符。') : hypothesis.trim().length < 8 ? t('Write the question you want this Factor to test (8–500 characters).', '请填写因子要检验的问题（8–500 个字符）。') : null
  const submit = async () => {
    if (!b || reason) return
    setBusy(true); setError('')
    try {
      if (!preview) {
        setPreview(await previewAction(b, 'project.create', id, { id, name: name.trim(), description: hypothesis.trim(), template: 'ohlcv-factor-lab' }))
      } else {
        const launched = await launchPreviewed(b, preview, false)
        const job = await waitJob(b, launched.jobId)
        if (job.status !== 'succeeded') throw new Error(jobError(job))
        jobFinished(); onClose()
        go(`${routeHref({ view: 'factor', id })}&idea=1`)
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPreview(null) }
    finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} label={t('New factor', '新建因子')} className="adialog">
    <div className="adialog-body">
      <header className="adialog-head"><h2>{t('New factor', '新建因子')}</h2><p className="muted small">{t('One question. One dedicated Project. Start with a Factor that ranks future returns.', '一个问题对应一个专属项目。从预测未来收益排序的因子开始。')}</p></header>
      <div className="adialog-scroll idea-form">
        <label className="afield">{t('Factor name', '因子名称')}<input className="fe-input" value={name} maxLength={120} onChange={e => { setName(e.target.value); setId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,64)); change() }} placeholder={t('Five-day momentum', '五日动量')} /></label>
        <label className="afield">{t('Original question', '原始问题')}<textarea className="fe-input" rows={3} value={hypothesis} maxLength={500} onChange={e => { setHypothesis(e.target.value); change() }} placeholder={t('Does five-day relative strength rank higher returns over the next daily bar?', '五日相对强度能否预测下一个交易日的收益排序？')} /></label>
        <label className="afield">{t('Project id', '项目标识')}<input className="fe-input mono" value={id} onChange={e => { setId(e.target.value); change() }} /></label>
        <p className="small muted">{t('Next: choose staged data, author the factor, then confirm the first trial. The original question stays attached to every result.', '接下来选择已准备的数据、编写因子，然后确认首次试验。每个结果都会保留原始问题。')}</p>
        {datasets && datasets.datasets.length === 0 && <div className="apreview"><h3>{t('Stage data before analysis', '分析前准备数据')}</h3><p className="small">{datasets.stagingNote}</p><pre className="cmd mono">{datasets.stagingCommand}</pre><p className="small muted">{t('You can create the factor now. Analysis stays unavailable until a complete package is staged.', '现在可以创建因子；准备完整数据包后才能进行分析。')}</p></div>}
        {datasets && datasets.datasets.length > 0 && <p className="small">{language === 'zh' ? `已有 ${datasets.datasets.length} 个日频数据包。接下来需要明确选择预测资产和预测周期。` : uiTemplate("{0} staged daily {1} available. You will explicitly select the prediction assets and horizon next.", [datasets.datasets.length, datasets.datasets.length === 1 ? 'package is' : 'packages are'])}</p>}
        {preview && <div className="apreview"><h3>{t('Create this Project', '创建此项目')}</h3><pre className="cmd mono">{preview.display}</pre><p className="small muted">{preview.writes}</p></div>}
        {error && <p className="sig small" role="alert">{error}</p>}
      </div>
      <footer className="adialog-foot"><ActionRow primary={reason ? { label: t('Create factor', '创建因子'), disabled: true, disabledReason: reason } : { label: preview ? t('Confirm and create', '确认并创建') : t('Create factor', '创建因子'), onClick: () => void submit() }} secondary={[{ label: t('Cancel', '取消'), onClick: onClose }]} /></footer>
    </div>
  </Modal>
}
