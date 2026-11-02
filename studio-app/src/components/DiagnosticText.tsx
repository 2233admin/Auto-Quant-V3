import { uiText, useLanguage } from '../i18n'
import { useState } from 'react'
/** Unknown external diagnostics are retained verbatim, never guessed or rewritten. */
export function DiagnosticText({ value, error = false }: { value: string; error?: boolean }) {
  const language = useLanguage()
  const [open, setOpen] = useState(false)
  const translated = uiText(value)
  if (language !== 'zh' || translated !== value || !/[A-Za-z]{3}/.test(value)) return <>{translated}</>
  return <span className="diagnostic-text">
    <span>{error ? '无法继续，请查看服务端诊断。' : '服务端提供了研究说明。'}</span>{' '}
    <button type="button" className="linklike" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起原文' : '查看原文'}</button>
    {open && <span className="diagnostic-original mono" translate="no" style={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</span>}
  </span>
}
