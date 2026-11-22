import { useState } from 'react'
import { downloadJson } from '../download'
import { translate, useLanguage } from '../i18n'
import { DataTable, type Col } from '../library/DataTable'
import { routeHref } from '../route'
import { Status } from './ResearchParts'
import { SeriesChart } from './SeriesChart'
import type { Direction, ResearchExperiment, ResearchHypothesis } from './researchApi'
import { fixed, vocab } from './words'

export type Result = {
  key: string
  hypothesis: ResearchHypothesis
  experiment: ResearchExperiment
  verdict: { label: string; reason: string; confirmation: 'confirmed' | 'unconfirmed' | null } | null
}

export function researchResults(direction: Direction): Result[] {
  return direction.hypotheses.flatMap(hypothesis => hypothesis.experiments.map(experiment => {
    const record = hypothesis.verdict
    const status = hypothesis.status
    const confirmation = hypothesis.confirmation?.experiment === experiment.id
      && (status === 'confirmed' || status === 'unconfirmed') ? status : null
    const verdict: Result['verdict'] = record?.evidence.experiment === experiment.id ? { label: record.label, reason: record.reason, confirmation } : null
    return { key: `${hypothesis.id}/${experiment.id}`, hypothesis, experiment, verdict }
  }))
}

export function comparisonGaps(a: Result, b: Result) {
  const { experiment: x } = a
  const { experiment: y } = b
  const gaps = []
  if (a.key === b.key) gaps.push('same')
  if (!x.dataHash?.trim() || x.dataHash !== y.dataHash) gaps.push('data')
  if (!x.evaluatorHash?.trim() || x.evaluatorHash !== y.evaluatorHash) gaps.push('evaluator')
  if (!Number.isFinite(x.best_is_score) || !Number.isFinite(y.best_is_score)) gaps.push('score')
  return gaps
}

function pathFor(project: string, result: Result) {
  return routeHref({ view: 'research', id: project, h: result.hypothesis.id, e: result.experiment.id })
}

function Compare({ rows, direction }: { rows: Result[]; direction: Direction }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const baseline = rows.find(r => r.key === left)
  const candidate = rows.find(r => r.key === right)
  const gaps = baseline && candidate ? comparisonGaps(baseline, candidate) : []
  const baselineScore = baseline?.experiment.best_is_score
  const candidateScore = candidate?.experiment.best_is_score
  const reasons: Record<string, string> = {
    same: t('Select two distinct experiments.', '请选择两个不同实验。'),
    data: t('The recorded data hashes are different or missing.', '数据指纹不同或缺失。'),
    evaluator: t('The recorded evaluator hashes are different or missing.', '评价程序指纹不同或缺失。'),
    score: t('At least one experiment has no finite in-sample score.', '至少一个实验没有有效的样本内得分。'),
  }
  const options = rows.map(r => <option key={r.key} value={r.key}>{r.key} · {r.hypothesis.title}</option>)
  const series = baseline && candidate && !gaps.length ? [baseline, candidate].flatMap((r, index) => {
    const curve = direction.experimentCurves.find(c => c.hypothesis === r.hypothesis.id && c.experiment === r.experiment.id)
    return curve ? [{ label: r.key, kind: 'step' as const, dashes: index ? '5 3' : '', points: curve.steps }] : []
  }) : []
  if (rows.length < 2) return null
  return <section className="rs-result-compare" aria-label={t('Compare experiments', '实验对照')}>
    <h3>{t('Compare experiments', '实验对照')}</h3>
    <div className="rs-result-controls">
      <label>{t('Baseline experiment', '基准实验')} <select value={left} onChange={event => setLeft(event.target.value)}><option value="">{t('Choose an experiment', '选择实验')}</option>{options}</select></label>
      <label>{t('Candidate experiment', '候选实验')} <select value={right} onChange={event => setRight(event.target.value)}><option value="">{t('Choose an experiment', '选择实验')}</option>{options}</select></label>
    </div>
    <p className="small muted">{t('Compare only in-sample selection scores with the same frozen evaluator and data. More trials can raise the best score by chance.', '只对比同一冻结评价程序、同一数据的样本内选优分数。尝试次数越多，最高分越可能受运气影响。')}</p>
    {gaps.length > 0 && <ul role="status">{gaps.map(gap => <li key={gap}>{reasons[gap]}</li>)}</ul>}
    {baseline && candidate && baselineScore != null && candidateScore != null && gaps.length === 0 && <>
      <dl className="rs-kv" aria-label={t('In-sample comparison', '样本内比较')}>
        <dt>{t('Baseline best score / evaluated', '基准最高分／评估次数')}</dt><dd>{fixed(baseline.experiment.best_is_score)} / {baseline.experiment.n_evaluated}</dd>
        <dt>{t('Candidate best score / evaluated', '候选最高分／评估次数')}</dt><dd>{fixed(candidate.experiment.best_is_score)} / {candidate.experiment.n_evaluated}</dd>
        <dt>{t('Candidate minus baseline', '候选减基准')}</dt><dd>{fixed(candidateScore - baselineScore)}</dd>
      </dl>
      {series.length === 2 && <SeriesChart title={t('Best score by generation', '逐代最高样本内分数')} short={t('Solid: baseline. Dashed: candidate.', '实线为基准，虚线为候选。')} desc={t('Running best in-sample score. The horizontal axis counts generations, not trading days.', '这是历代最高样本内分数，横轴是代数，不是交易日。')} xLabel={t('Generation', '代数')} format={value => value.toFixed(3)} series={series} />}
    </>}
  </section>
}

export function ResearchResults({ id, direction, synthetic = false }: { id: string; direction: Direction; synthetic?: boolean }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [only, setOnly] = useState(false)
  const rows = researchResults(direction)
  const visible = only ? rows.filter(r => r.verdict?.confirmation === 'confirmed'
    || (r.verdict?.label === 'supported' && r.verdict.confirmation !== 'unconfirmed')) : rows
  const cols: Col<Result>[] = [
    { id: 'experiment', label: t('Experiment', '实验'), rowHeader: true, render: r => <a className="mono" href={pathFor(id, r)}>{r.key}</a> },
    { id: 'claim', label: t('Hypothesis', '研究假设'), render: r => <a className="lib-hyp" href={routeHref({ view: 'research', id, h: r.hypothesis.id }) + '#rs-claim'} translate="no">{r.hypothesis.title}</a> },
    { id: 'verdict', label: t('Recorded verdict', '已记录裁决'), render: r => r.verdict ? <><Status status={r.verdict.label} />{r.verdict.confirmation && <> <Status status={r.verdict.confirmation} /></>}<span className="lib-hyp" translate="no">{r.verdict.reason}</span></> : <span className="muted">{t('No verdict for this experiment', '此实验无归属裁决')}</span> },
    { id: 'score', label: t('Best in-sample', '最高样本内分数'), align: 'r', render: r => fixed(r.experiment.best_is_score) },
    { id: 'attempts', label: t('Evaluated', '评估次数'), align: 'r', render: r => r.experiment.n_evaluated },
    { id: 'program', label: t('Code and feedback', '代码与反馈'), render: r => r.experiment.n_evaluated > 0 ? <a href={pathFor(id, r) + '#ev-inspector'}>{t('Open program inspector', '查看程序')}</a> : <span className="muted">{t('No programs yet', '尚无程序')}</span> },
  ]
  const grants = direction.rounds.grants ?? []
  return <div className="vstack">
    {rows.length ? <>
      <div className="rs-result-controls">
        <label><input type="checkbox" checked={only} onChange={event => setOnly(event.target.checked)} /> {t('Supported or confirmed only', '仅显示获支持或确认')}</label>
        <button className="abtn" type="button" disabled={!visible.length} onClick={() => downloadJson(`${synthetic ? 'demo-' : ''}${id}-research-results.json`, {
          project: id,
          synthetic,
          results: visible.map(r => ({ hypothesis: r.hypothesis.id, experiment: r.experiment.id, title: r.hypothesis.title, verdict: r.verdict, inSampleScore: r.experiment.best_is_score, evaluated: r.experiment.n_evaluated, evaluatorHash: r.experiment.evaluatorHash, dataHash: r.experiment.dataHash })),
        })}>{t('Download shown results (JSON)', '下载当前结果（JSON）')}</button>
      </div>
      {visible.length ? <DataTable rows={visible} cols={cols} rowKey={r => r.key} caption={t('Experiment results', '实验结果')} /> : <p role="status">{t('No results match this filter.', '没有符合筛选条件的实验。')}</p>}
      <Compare rows={rows} direction={direction} />
    </> : <p>{t('No experiments recorded.', '尚无实验记录。')}</p>}
    {grants.length > 0 && <details className="rs-round-attempts">
      <summary>{t('Recorded round attempts', '轮次执行记录')}</summary>
      <ul>{grants.map(round => <li key={round.id}><span className="mono">{round.id}</span> <span>{round.used} / {round.attempts}</span>
        {round.runs.length > 0 && <ul>{round.runs.map(run => {
          const result = rows.find(r => r.hypothesis.id === run.hypothesis && r.experiment.id === run.experiment)
          return <li key={run.attempt}><span className="mono">#{run.attempt}</span>{' · '}{result ? <a href={pathFor(id, result)}>{result.key}</a> : <span>{run.hypothesis}/{run.experiment}</span>}{' · '}{vocab(run.state)}{run.event && <> · {vocab(run.event)}</>}</li>
        })}</ul>}
      </li>)}</ul>
    </details>}
  </div>
}
