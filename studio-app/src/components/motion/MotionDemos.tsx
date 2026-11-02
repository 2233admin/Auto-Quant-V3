import { uiText } from '../../i18n'
import { useRef, useState } from 'react'
import { CopyButton } from '../../actions/CopyButton'
import { SegmentedToggle } from '../workbench/SegmentedToggle'
import { TabList } from '../workbench/Tabs'
import { CompactTile, CompactTileGrid } from '../CompactTile'
import { StatChips } from '../workbench/StatChips'
import { StatusLine } from '../workbench/StatusLine'
import { VerdictBar } from '../workbench/VerdictBar'
import { AnimatedDetails } from './AnimatedDetails'
import { AutoHeight, Collapse } from './Collapse'
import { Progress } from './Progress'
import { startThemeTransition } from './themeTransition'
import { useSlidingHighlight } from './useSlidingHighlight'
import './motion.css'

type Tab = 'a' | 'b' | 'c'
const TABS = [{ id: 'a', get label() { return uiText("Overview") } }, { id: 'b', get label() { return uiText("Metrics") }, badge: '3' }, { id: 'c', get label() { return uiText("Notes") } }] as const
const ROWS = ['btc-4h-momentum', 'eth-funding-skew', 'sol-liquidity-gap', 'xrp-range-fade']
const VALUES = [
  { mean: '0.0042', t: '0.91', n: '812', spread: '+3.1 bp' },
  { mean: '0.0187', t: '2.46', n: '1,204', spread: '+7.8 bp' },
  { mean: '-0.0031', t: '-0.52', n: '640', spread: '-1.2 bp' },
]

function HoverList() {
  const ref = useRef<HTMLUListElement>(null)
  useSlidingHighlight(ref, { items: 'li' })
  return (
    <ul ref={ref} className="mo-demo-list mo-hl" aria-label={uiText("Sliding hover rows")}>
      {ROWS.map((r) => (
        <li key={r}>
          <span className="mono">{r}</span>
        </li>
      ))}
    </ul>
  )
}

/** `?view=kit`, the Motion section: each adapted effect with something to poke. Not part of the product. */
export function MotionDemos() {
  const [tab, setTab] = useState<Tab>('a')
  const [seg, setSeg] = useState<'x' | 'y' | 'z'>('x')
  const [v, setV] = useState(0)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(2)
  const [pct, setPct] = useState(20)
  const [unmeasured, setUnmeasured] = useState(false)
  const val = VALUES[v % VALUES.length]
  return (
    <div className="mo-demo" data-testid="motion-section">
      <h3 className="mo-demo-h">{uiText("Motion")}</h3>
      <p className="small muted">{uiText("Adapted from animate-ui. Every effect below is off under prefers-reduced-motion.")}</p>

      <section aria-label={uiText("Sliding highlight")}>
        <h4 className="mo-demo-sub">{uiText("Sliding highlight: tabs, segmented toggle, rows")}</h4>
        <TabList label={uiText("Motion demo tabs")} tabs={[...TABS]} active={tab} onSelect={setTab} />
        <SegmentedToggle label={uiText("Motion demo toggle")} value={seg} onChange={setSeg} options={[{ id: 'x', label: uiText("Daily") }, { id: 'y', label: uiText("Weekly") }, { id: 'z', label: uiText("Monthly") }]} />
        <HoverList />
      </section>

      <section aria-label={uiText("Counting numbers")}>
        <h4 className="mo-demo-sub">{uiText("Counting numbers")}</h4>
        <button type="button" className="abtn" id="mo-change-values" onClick={() => setV((n) => n + 1)}>{uiText("Change values")}</button>
        <StatChips label={uiText("Demo stats")} stats={[{ label: uiText("Mean IC"), value: val.mean }, { label: uiText("HAC t"), value: val.t }, { label: uiText("Obs"), value: val.n }]} />
        <CompactTileGrid label={uiText("Demo tiles")}>
          <CompactTile label={uiText("Mean rank IC")} value={val.mean} />
          <CompactTile label={uiText("Top minus bottom")} value={val.spread} />
        </CompactTileGrid>
      </section>

      <section aria-label={uiText("Collapsible and auto height")}>
        <h4 className="mo-demo-sub">{uiText("Height: collapse, details, auto height")}</h4>
        <VerdictBar tone="warn" word={uiText("Inconclusive")} detail={uiText("Detail text eases open instead of jumping.")}>{uiText("Too few observations to decide.")}</VerdictBar>
        <button type="button" className="wb-link" aria-expanded={open} aria-controls="mo-demo-collapse" onClick={() => setOpen((x) => !x)}>
          {open ? uiText("Hide") : uiText("Show")}{uiText(" the collapsible")}</button>
        <Collapse open={open} id="mo-demo-collapse" className="small mo-demo-pad">
          <p>{uiText("Closed content is inert: it leaves the tab order and the accessibility tree.")}</p>
          <p>{uiText("Height animates between 0 and its natural size.")}</p>
        </Collapse>
        <AnimatedDetails className="mo-demo-details">
          <summary>{uiText("Native details, animated")}</summary>
          <p className="small">{uiText("Same element, same keyboard behaviour; only the height eases.")}</p>
          <p className="small">{uiText("A second line to make the change visible.")}</p>
        </AnimatedDetails>
        <div className="mo-demo-row">
          <button type="button" className="abtn" id="mo-add-row" onClick={() => setRows((n) => Math.min(6, n + 1))}>{uiText("Add row")}</button>
          <button type="button" className="abtn" onClick={() => setRows((n) => Math.max(1, n - 1))}>{uiText("Remove row")}</button>
        </div>
        <AutoHeight className="mo-demo-auto">
          {Array.from({ length: rows }, (_, i) => (
            <p key={i} className="small mo-demo-pad">{uiText("Row ")}{i + 1}</p>
          ))}
        </AutoHeight>
      </section>

      <section aria-label={uiText("Progress")}>
        <h4 className="mo-demo-sub">{uiText("Progress")}</h4>
        <div className="mo-demo-row">
          <button
            type="button"
            className="abtn"
            id="mo-advance"
            onClick={() => {
              setUnmeasured(false)
              setPct((p) => (p >= 100 ? 0 : Math.min(100, p + 30)))
            }}
          >{uiText("Advance")}</button>
          <button type="button" className="abtn" onClick={() => setUnmeasured((u) => !u)}>{unmeasured ? uiText("Measured") : uiText("Unmeasured")}</button>
        </div>
        <div className="mo-demo-bar"><Progress value={unmeasured ? null : pct} label={uiText("Demo progress")} /></div>
        <StatusLine state="running" text="Running stage 2 of 5" percent={unmeasured ? null : pct} elapsed="0m 41s" details={<pre className="mono small">aq factor run --study demo</pre>} />
      </section>

      <section aria-label={uiText("Copy and theme")}>
        <h4 className="mo-demo-sub">{uiText("Copy confirmation and theme fade")}</h4>
        <div className="mo-demo-row">
          <CopyButton text="aq studio serve --port 8895" label={uiText("Copy command")} />
          <button
            type="button"
            className="abtn"
            onClick={() => {
              startThemeTransition()
              const root = document.documentElement
              root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light'
            }}
          >{uiText("Preview theme fade")}</button>
        </div>
        <p className="small muted">{uiText("The preview button flips the theme for this page view only; use the top bar Dark / Light switch for the stored choice.")}</p>
      </section>
    </div>
  )
}
