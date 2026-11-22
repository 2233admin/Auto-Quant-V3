import { useId, useRef, useState } from 'react'
import { ActionRow } from '../components/workbench'
import { translate, useLanguage } from '../i18n'

const MAX_BYTES = 512 * 1024
const SAVED_RECEIPT = 'aq-research-candidate-receipt-v1'

type Factor = { name: string; description: string; formula: string; variables: [string, string][] }
type Feature = { id: string; name: string; kind: string; grain: string; evidence: string; rule: string; inputs: string[]; gap: string | null; sourceLine?: number }
type Receipt =
  | { kind: 'factors'; version: string; source: string | null; scope: string | null; digest: string | null; factors: Factor[] }
  | { kind: 'features'; source: string; digest: string; features: Feature[] }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected nonempty text')
  return value
}

function sha256(value: unknown): string {
  const digest = text(value)
  if (!/^[a-fA-F0-9]{64}$/.test(digest)) throw new Error('Expected a SHA-256 digest')
  return digest
}

export function parseExtractionReceipt(raw: string): Receipt {
  const receipt = object(JSON.parse(raw))
  if (receipt.items !== undefined) {
    const items = receipt.items
    if (receipt.factors !== undefined || !Array.isArray(items) || items.length > 200) throw new Error('Invalid research feature list')
    const features = items.map((value: unknown): Feature => {
      const item = object(value)
      if (!Array.isArray(item.inputs) || item.inputs.length > 64) throw new Error('Invalid feature inputs')
      const sourceLine = item.sourceLine
      if (sourceLine !== undefined && (typeof sourceLine !== 'number' || !Number.isSafeInteger(sourceLine) || sourceLine < 1)) {
        throw new Error('Expected a positive source line number')
      }
      return { id: text(item.id), name: text(item.name), kind: text(item.kind), grain: text(item.grain),
        evidence: text(item.evidence), rule: text(item.rule), inputs: item.inputs.map(text), gap: item.gap === null ? null : text(item.gap),
        ...(sourceLine === undefined ? {} : { sourceLine }) }
    })
    if (new Set(features.map(feature => feature.id)).size !== features.length) throw new Error('Duplicate feature identity')
    return { kind: 'features', source: text(receipt.source), digest: sha256(receipt.source_sha256), features }
  }
  const version = text(receipt.rdagent)
  const reference = receipt.source === undefined ? null : text(receipt.source)
  if (reference && !/^https:\/\/[^\s\\]+$/i.test(reference)) throw new Error('Expected an HTTPS source')
  const source = reference ? new URL(reference) : null
  if (source && (source.username || source.password)) throw new Error('Source must not contain credentials')
  const scope = receipt.source_scope === undefined ? null : text(receipt.source_scope)
  const digest = receipt.excerpt_sha256 === undefined ? null : sha256(receipt.excerpt_sha256)
  const entries = Object.entries(object(receipt.factors))
  if (entries.length > 200) throw new Error('Too many candidates')
  const factors = entries.map(([name, value]) => {
    const factor = object(value)
    const columns = Object.entries(object(factor.variables))
    if (columns.length > 64) throw new Error('Too many variable definitions')
    return { name: text(name), description: text(factor.description), formula: text(factor.formulation),
      variables: columns.map(([key, item]): [string, string] => [text(key), text(item)]) }
  })
  return { kind: 'factors', version, source: source?.href ?? null, scope, digest, factors }
}

type LoadedReceipt = { data: Receipt; raw: string }
type Preview = 'reading' | 'size' | 'invalid' | LoadedReceipt | null
type SavedReceipt = 'invalid' | 'unavailable' | LoadedReceipt | null

function readSavedReceipt(): SavedReceipt {
  if (typeof window === 'undefined') return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(SAVED_RECEIPT)
  } catch {
    return 'unavailable'
  }
  if (raw === null) return null
  if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BYTES) return 'invalid'
  try {
    return { raw, data: parseExtractionReceipt(raw) }
  } catch {
    return 'invalid'
  }
}

export function RdAgentCandidates() {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const inputId = useId()
  const selection = useRef(0)
  const [saved, setSaved] = useState(readSavedReceipt)
  const [preview, setPreview] = useState<Preview>(null)
  const [notice, setNotice] = useState<'saved' | 'removed' | 'save-failed' | 'remove-failed' | null>(null)
  const current = preview ?? saved
  const data = typeof current === 'object' && current ? current.data : null
  const hasSavedCopy = saved !== null && saved !== 'unavailable'
  const canReturn = saved !== null && typeof saved === 'object' && preview !== null
  const pending = typeof preview === 'object' ? preview : null
  const count = data?.kind === 'factors' ? data.factors.length : data?.features.length ?? 0
  async function show(file: File) {
    const current = ++selection.current
    setNotice(null)
    if (file.size > MAX_BYTES) { setPreview('size'); return }
    setPreview('reading')
    try {
      const bytes = await file.arrayBuffer()
      if (current !== selection.current) return
      if (bytes.byteLength > MAX_BYTES) { setPreview('size'); return }
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      setPreview({ raw, data: parseExtractionReceipt(raw) })
    } catch {
      if (current === selection.current) setPreview('invalid')
    }
  }
  function save(receipt: LoadedReceipt) {
    try {
      window.localStorage.setItem(SAVED_RECEIPT, receipt.raw)
    } catch {
      setNotice('save-failed')
      return
    }
    setSaved(receipt)
    setPreview(null)
    setNotice('saved')
  }

  function remove() {
    try {
      window.localStorage.removeItem(SAVED_RECEIPT)
    } catch {
      setNotice('remove-failed')
      return
    }
    setSaved(null)
    setNotice('removed')
  }

  const notices = {
    saved: t('Saved in this browser.', '回执已保存在此浏览器。'),
    removed: t('Saved copy removed. The source file was not changed.', '已移除本地副本，原文件未更改。'),
    'save-failed': t('Could not save the receipt in this browser.', '无法在此浏览器保存回执。'),
    'remove-failed': t('Could not remove the saved copy.', '无法移除已保存的副本。'),
  }
  return <section className="rs-result-compare vstack" aria-labelledby={`${inputId}-title`}>
    <h2 id={`${inputId}-title`}>{t('RD-Agent and research candidates', 'RD-Agent 与研究候选')}</h2>
    <p className="muted small" id={`${inputId}-help`}>{t('Open one receipt up to 512 KiB. Saving keeps the full JSON in this browser only and replaces any saved copy. Studio does not upload or execute the receipt.', '可打开最大 512 KiB 的回执。保存会在此浏览器保留完整 JSON，并替换旧副本。Studio 不会上传或执行回执。')}</p>
    <div className="rs-result-controls"><label htmlFor={inputId}>{t('Choose extraction JSON receipt', '选择提取结果 JSON')}</label>
      <input id={inputId} type="file" accept=".json,application/json" aria-describedby={`${inputId}-help`} onChange={event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) void show(file)
      }} />
    </div>
    {(pending || hasSavedCopy) && <ActionRow align="start"
      primary={pending ? {
        label: hasSavedCopy ? t('Replace saved receipt', '替换已保存回执') : t('Save in this browser', '保存在此浏览器'),
        onClick: () => save(pending),
      } : undefined}
      secondary={[
        ...(canReturn ? [{ label: t('Return to saved receipt', '返回已保存回执'), onClick: () => { ++selection.current; setNotice(null); setPreview(null) } }] : []),
        ...(hasSavedCopy ? [{ label: t('Remove saved copy', '移除本地副本'), onClick: remove }] : []),
      ]} />}
    {notice && <p role="status">{notices[notice]}</p>}
    {preview === null && data && <p className="muted small">{t('Showing the receipt saved in this browser.', '正在查看保存在此浏览器的回执。')}</p>}
    <p role="status">{current === null ? t('No receipt selected.', '尚未选择回执。')
      : current === 'unavailable' ? t('Browser storage is unavailable. You can still preview a receipt.', '浏览器存储不可用，仍可预览回执。')
      : current === 'reading' ? t('Reading local receipt…', '正在读取本地回执……')
      : current === 'size' ? t('File exceeds 512 KiB.', '文件超过 512 KiB。')
      : current === 'invalid' ? preview === null
        ? t('The saved receipt is invalid. Import a new receipt or remove the saved copy.', '已保存的回执无效，请打开新回执或移除本地副本。')
        : t('Invalid receipt. No candidates loaded from this file.', '回执无效，未从此文件加载候选条目。')
      : count ? t(`${count} unverified ${data?.kind === 'factors' ? 'factor' : 'feature'} candidates`, `${count} 个未经验证的${data?.kind === 'factors' ? '候选因子' : '研究特征'}`)
      : t('Valid receipt. No candidates extracted.', '回执有效，没有候选条目。')}</p>
    {data?.kind === 'factors' && <>
      <dl className="rs-kv">
        <dt>{t('RD-Agent version (reported)', 'RD-Agent 版本（回执声明）')}</dt><dd translate="no">{data.version}</dd>
        {data.source && <><dt>{t('Reference (unverified)', '参考来源（未经验证）')}</dt><dd><a href={data.source} target="_blank" rel="noopener noreferrer" translate="no">{data.source}</a></dd></>}
        {data.scope && <><dt>{t('Source scope (reported)', '来源范围（回执声明）')}</dt><dd translate="no">{data.scope}</dd></>}
        {data.digest && <><dt>{t('Excerpt SHA-256 (unverified)', '摘录 SHA-256（未校验）')}</dt><dd className="mono" translate="no">{data.digest}</dd></>}
      </dl>
      {data.factors.map(factor => <details key={factor.name}>
        <summary translate="no">{factor.name}</summary>
        <p translate="no">{factor.description}</p>
        <h3 className="pj-sub">{t('Formula (text only)', '公式（仅文本）')}</h3>
        <pre className="rs-pre" translate="no">{factor.formula}</pre>
        <h3 className="pj-sub">{t('Variables', '变量')}</h3>
        {factor.variables.length ? <dl className="rs-kv" translate="no">{factor.variables.map(([key, value]) => <div className="rs-variable" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
          : <p className="muted small">{t('No variable definitions supplied.', '回执未提供变量定义。')}</p>}
      </details>)}
    </>}
    {data?.kind === 'features' && <>
      <dl className="rs-kv">
        <dt>{t('Source file (reported)', '来源文件（回执声明）')}</dt><dd translate="no">{data.source}</dd>
        <dt>{t('Source SHA-256 (unverified)', '来源 SHA-256（未校验）')}</dt><dd className="mono" translate="no">{data.digest}</dd>
      </dl>
      {data.features.map(feature => <details key={feature.id}>
        <summary translate="no">{feature.name}</summary>
        <dl className="rs-kv">
          <dt>{t('Kind and observation unit', '类别与观察单位')}</dt><dd translate="no">{feature.kind} · {feature.grain}</dd>
          {feature.sourceLine !== undefined && <><dt>{t('Excerpt line (reported)', '摘录行号（回执声明）')}</dt><dd translate="no">{feature.sourceLine}</dd></>}
          <dt>{t('Quoted evidence (unverified)', '原文证据（未经验证）')}</dt><dd translate="no">{feature.evidence}</dd>
          <dt>{t('Proposed rule', '候选规则')}</dt><dd translate="no">{feature.rule}</dd>
          <dt>{t('Inputs', '输入字段')}</dt><dd translate="no">{feature.inputs.join(' · ') || '—'}</dd>
          <dt>{t('Gap', '缺口')}</dt><dd translate="no">{feature.gap ?? '—'}</dd>
        </dl>
      </details>)}
    </>}
  </section>
}
