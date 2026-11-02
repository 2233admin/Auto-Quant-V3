import { uiText, uiValue } from '../i18n'
import { useRef, useState } from 'react'
import { CopyIcon } from '../components/motion/CopyIcon'

/** Copies text to the clipboard. Falls back to a hidden textarea where the async API is unavailable (plain http). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef(0)
  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      area.remove()
    }
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    // The check mark shows for 1.5 s; a failure keeps its explanation up a little longer.
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1500 : 2500)
  }
  return (
    <>
      <button type="button" className="abtn" onClick={copy}>
        <CopyIcon copied={state === 'copied'} />
        {uiValue(label)}
      </button>
      <span className="small muted" role="status" aria-live="polite">
        {state === 'copied' ? uiText("Copied.") : state === 'failed' ? uiText("Copy failed; select the command and copy it by hand.") : ''}
      </span>
    </>
  )
}
