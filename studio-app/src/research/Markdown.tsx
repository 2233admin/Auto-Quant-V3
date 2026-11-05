import type { ReactNode } from 'react'

/**
 * A small, safe Markdown renderer for library pages (headings, paragraphs, lists, quotes, fenced code, inline code,
 * bold, links and `[[wiki]]` links). It builds React elements only, never HTML strings, so page text cannot inject
 * markup; only http(s) links become anchors. Studio has no Markdown library, and these pages need no more than this.
 */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)）]+)/g

function inline(text: string, onWiki?: (page: string) => void): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return part
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('[[')) {
      const page = part.slice(2, -2).split('|')[0].trim()
      return onWiki ? <button key={i} type="button" className="wb-link md-wiki" onClick={() => onWiki(page)}>{page}</button> : <span key={i} className="md-wiki">{page}</span>
    }
    const link = /^\[([^\]]+)\]\((.+)\)$/.exec(part)
    const href = link ? link[2] : part
    return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{link ? link[1] : part}</a>
  })
}

type Block = { kind: 'h' | 'p' | 'ul' | 'ol' | 'quote' | 'code'; level?: number; lines: string[] }

function blocks(text: string): Block[] {
  const out: Block[] = []
  let fence: Block | null = null
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if (fence) {
      if (raw.trim().startsWith('```')) { out.push(fence); fence = null } else fence.lines.push(raw)
      continue
    }
    const line = raw.trimEnd()
    const last = out[out.length - 1]
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (line.trim().startsWith('```')) fence = { kind: 'code', lines: [] }
    else if (heading) out.push({ kind: 'h', level: heading[1].length, lines: [heading[2]] })
    else if (bullet) last?.kind === 'ul' ? last.lines.push(bullet[1]) : out.push({ kind: 'ul', lines: [bullet[1]] })
    else if (numbered) last?.kind === 'ol' ? last.lines.push(numbered[1]) : out.push({ kind: 'ol', lines: [numbered[1]] })
    else if (line.startsWith('>')) last?.kind === 'quote' ? last.lines.push(line.slice(1).trim()) : out.push({ kind: 'quote', lines: [line.slice(1).trim()] })
    else if (line.trim() === '') out.push({ kind: 'p', lines: [] })
    else last?.kind === 'p' && last.lines.length ? last.lines.push(line) : out.push({ kind: 'p', lines: [line] })
  }
  if (fence) out.push(fence)
  return out.filter((b) => b.kind === 'code' || b.lines.length > 0)
}

export function Markdown({ text, onWiki }: { text: string; onWiki?: (page: string) => void }) {
  return (
    <div className="md" translate="no">
      {blocks(text).map((b, i) => {
        if (b.kind === 'code') return <pre key={i} className="rs-pre">{b.lines.join('\n')}</pre>
        if (b.kind === 'h') { const H = (['h3', 'h3', 'h4', 'h5'] as const)[(b.level ?? 1) - 1]; return <H key={i}>{inline(b.lines[0], onWiki)}</H> }
        if (b.kind === 'ul' || b.kind === 'ol') { const L = b.kind; return <L key={i}>{b.lines.map((line, j) => <li key={j}>{inline(line, onWiki)}</li>)}</L> }
        if (b.kind === 'quote') return <blockquote key={i}>{inline(b.lines.join(' '), onWiki)}</blockquote>
        return <p key={i}>{inline(b.lines.join(' '), onWiki)}</p>
      })}
    </div>
  )
}
