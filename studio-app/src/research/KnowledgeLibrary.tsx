import { uiTemplate, uiText } from '../i18n'
import { useState } from 'react'
import { Icon, PageMark, SectionBar } from '../design/marks'
import { Notice } from '../Notice'
import { Loading } from '../components/States'
import { LIBRARY_URL, useResearchJson, type KnowledgeLibrary as Library, type ResearchLibrary } from './researchApi'
import { Markdown } from './Markdown'

function Pages({ lib, open, onOpen }: { lib: Library; open: string; onOpen: (page: string) => void }) {
  const page = lib.pages.find((p) => p.name === open)
  const findings = new Set(lib.findings)
  return (
    <div className="rs-wiki">
      <nav aria-label={uiText("Wiki pages")}>
        <ul className="plain">
          {lib.pages.map((p) => (
            <li key={p.name}>
              <button type="button" className={p.name === open ? 'rs-page-btn is-on' : 'rs-page-btn'} aria-pressed={p.name === open} onClick={() => onOpen(p.name)}>
                <span className="mono small" translate="no">{p.name}</span>
                {findings.has(p.name) && <span className="mk small">{uiText("finding")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <article className="rs-article">
        {page ? <Markdown text={page.text} onWiki={onOpen} /> : open ? <p className="muted">{uiTemplate("No wiki page named {0}.", [open])}</p> : <p className="muted">{uiText("No wiki page yet.")}</p>}
      </article>
    </div>
  )
}

function Body({ lib }: { lib: Library }) {
  const [open, setOpen] = useState(lib.pages[0]?.name ?? '')
  // A [[wiki]] link anywhere on the page opens that page in the wiki pane.
  const show = (page: string) => {
    setOpen(page)
    document.getElementById('kl-wiki')?.scrollIntoView({ block: 'start' })
  }
  return (
    <div className="vstack">
      {lib.demo && <Notice kind="info" label={uiText("Demo")} title={uiText("Synthetic demo data: no research was run and no number here is a real result.")} />}
      <p className="small muted">
        {uiTemplate("{0} wiki pages, {1} findings, {2} raw sources not compiled yet; {3} sources added by the agent, {4} by people.", [lib.pages.length, lib.findings.length, lib.pending.length, lib.sources.agent, lib.sources.human])}
      </p>
      <section aria-labelledby="kl-wiki"><SectionBar as="h2" id="kl-wiki" icon="doc" micro="WIKI">{uiText("Wiki")}</SectionBar><Pages lib={lib} open={open} onOpen={show} /></section>
      <div className="cols">
        <section aria-labelledby="kl-index"><SectionBar as="h2" id="kl-index" icon="folder" micro="INDEX.MD">{uiText("Index")}</SectionBar><Markdown text={lib.index} onWiki={show} /></section>
        <section aria-labelledby="kl-raw">
          <SectionBar as="h2" id="kl-raw" icon="download" micro="RAW">{uiText("Raw sources not compiled")}</SectionBar>
          {lib.pending.length ? <ul className="plain mono small" translate="no">{lib.pending.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="muted small">{uiText("Every raw source is compiled.")}</p>}
        </section>
      </div>
      <section aria-labelledby="kl-log"><SectionBar as="h2" id="kl-log" icon="versions" micro="LOG.MD">{uiText("Library log")}</SectionBar><Markdown text={lib.log} onWiki={show} /></section>
    </div>
  )
}

/** The Workspace knowledge library (raw sources compiled into a wiki, with its log), read-only. */
export function KnowledgeLibrary({ tick }: { tick: Date | null }) {
  const load = useResearchJson<ResearchLibrary>(LIBRARY_URL, tick)
  const head = <header className="library-title sec-bar"><Icon name="folder" /><h1>{uiText("Knowledge library")}</h1><p>{uiText("Sources the research reads, compiled into linked wiki pages; findings are written back after each verdict.")}</p><PageMark kind="barcode" micro="LIBRARY / RAW → WIKI → LOG" /></header>
  let body
  if (load.state === 'loading') body = <Loading label={uiText("Loading…")} minHeight={240} />
  else if (load.state === 'error') body = <Notice kind="error" label={uiText("Error")} title={uiText("Could not load the knowledge library.")} subtitle={load.message} />
  else if (load.data.library) body = <Body lib={load.data.library} />
  else body = <p className="muted">{load.data.state === 'unavailable' ? uiText("The research layer is not installed in this Studio (uv sync --extra shinka).") : uiText("This Workspace has no knowledge library yet. aq shinka library add <workspace> FILE creates it.")}</p>
  return <div className="pg object-library rs-library">{head}{body}</div>
}
