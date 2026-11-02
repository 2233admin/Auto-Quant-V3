import { useEffect, useState } from 'react'
import { uiTemplate, uiText, uiValue } from '../../i18n'

export type EvidenceSection = { id: string; label: string }
export function EvidenceNavigation({ sections }: { sections: EvidenceSection[] }) {
  const [progress,setProgress] = useState(0)
  const [active,setActive] = useState(sections[0]?.id)
  useEffect(() => {
    const update = () => {
      const root = document.scrollingElement
      if (root) setProgress(root.scrollHeight <= root.clientHeight ? 100 : root.scrollTop / (root.scrollHeight-root.clientHeight)*100)
      const current = sections.filter(s => (document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity) <= 150).at(-1)
      setActive(current?.id ?? sections[0]?.id)
    }
    update(); window.addEventListener('scroll',update,{ passive: true }); window.addEventListener('resize',update)
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    const content = document.querySelector('.evidence-content')
    if (content) observer.observe(content)
    return () => { observer.disconnect(); window.removeEventListener('scroll',update); window.removeEventListener('resize',update) }
  },[sections])
  return <nav className="evidence-nav" aria-label={uiText("Evidence sections")}><span>{uiText("ON THIS PAGE")}</span>
    {sections.map((s,i) => <a key={s.id} href={`#${s.id}`} aria-current={s.id === active ? 'location' : undefined}>{i===sections.length-1 ? '└' : '├'} {uiValue(s.label)}</a>)}
    <progress className="evidence-progress" value={progress} max={100} aria-label={uiText("Reading progress")} /><span>{uiTemplate("{0}% read", [Math.round(progress)])}</span>
  </nav>
}
