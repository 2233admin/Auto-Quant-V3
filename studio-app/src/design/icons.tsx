import type { ReactNode } from 'react'

// Shapes from the approved high-fidelity package (hifi/build.mjs › glyphs). Direction states are
// squares and hypothesis states circles, so the two never share a shape; a glyph always sits next to
// its word, never alone.

const CUT = { stroke: 'var(--bg)' }

const GLYPHS = {
  supported: <circle cx="7" cy="7" r="5.5" fill="currentColor" />,
  confirmed: (
    <>
      <circle cx="7" cy="7" r="5.5" fill="currentColor" />
      <path d="M4.4 7.2l1.8 1.8 3.4-3.6" style={CUT} strokeWidth="1.5" fill="none" />
    </>
  ),
  inconclusive: (
    <>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 2a5 5 0 0 1 0 10z" fill="currentColor" />
    </>
  ),
  running: (
    <>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.2 1.9" />
      <circle cx="7" cy="7" r="1.8" fill="currentColor" />
    </>
  ),
  challenged: (
    <>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v3.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="9.6" r=".9" fill="currentColor" />
    </>
  ),
  proposed: <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1 2.1" />,
  selected: <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  unconfirmed: (
    <>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.8 4.8l4.4 4.4m0-4.4l-4.4 4.4" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  dropped: <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" />,
  'dir-active': (
    <>
      <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="5" width="4" height="4" fill="currentColor" />
    </>
  ),
  'dir-concluded': (
    <>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="currentColor" />
      <path d="M4.3 7.2l1.8 1.8 3.6-3.8" style={CUT} strokeWidth="1.5" fill="none" />
    </>
  ),
  'dir-new': (
    <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.6 1.6" />
  ),
  'dir-over': (
    <>
      <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 10L10 4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 4v3M10 4H7" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </>
  ),
  error: (
    <>
      <path d="M7 1.6l5.8 10.2H1.2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 5.4v3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="10" r=".8" fill="currentColor" />
    </>
  ),
  // Nothing to show yet (hifi `empty`): rounder corners and longer dashes than a new direction's square.
  empty: <rect x="2" y="2" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.6" />,
} satisfies Record<string, ReactNode>

export type GlyphKind = keyof typeof GLYPHS

/** A 14px state shape. Decorative unless labelled; `signal` paints it in the signal white. */
export function Glyph({ kind, label, signal = false }: { kind: GlyphKind; label?: string; signal?: boolean }) {
  return (
    <svg
      className={signal ? 'glyph is-signal' : 'glyph'}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {GLYPHS[kind]}
    </svg>
  )
}

// Direction H pictograms (owner decision 2026-11-04): 21 original blocky shapes drawn on a 24-unit grid from
// rectangles, diamonds and notches, filled with currentColor (evenodd). Nothing is copied from any game or font.
// Call sites keep `<Icon name=... />`; the drawn size is the display size, the grid is always 24.
const ICONS = {
  assistant: { box: 16, body: <path d="M3 4h18v13h-9l-5 4v-4H3z M7 8h10v2H7z M7 12h6v2H7z" /> },
  plus: { box: 16, body: <path d="M3 3h14l4 4v14H3z M10 6h4v4h4v4h-4v4h-4v-4H6v-4h4z" /> },
  factors: { box: 16, body: <><path d="M12 2l10 10-10 10L2 12z M12 6l6 6-6 6-6-6z" /><path d="M12 10l2 2-2 2-2-2z" /></> },
  strategies: { box: 16, body: <path d="M3 21v-5h5v-5h5V6h5V3h3v18z M15 10h2v2h-2z M10 15h2v2h-2z" /> },
  runs: { box: 16, body: <><path d="M3 3h3v15h15v3H3z" /><path d="M9 11h3v4H9z M14 7h3v8h-3z M19 12h2v3h-2z" /></> },
  tuning: { box: 16, body: <path d="M8 2h8v3h-1v5l6 10v2H3v-2l6-10V5H8z M9 16h6v3H9z" /> },
  collapse: { box: 16, body: <><path d="M11 6H8l-5 6 5 6h3l-5-6z" /><path d="M20 6h-3l-5 6 5 6h3l-5-6z" /></> },
  expand: { box: 16, body: <><path d="M13 6h3l5 6-5 6h-3l5-6z" /><path d="M4 6h3l5 6-5 6H4l5-6z" /></> },
  attention: { box: 16, body: <><path d="M4 17v-2h2v-5l3-5h6l3 5v5h2v2z" /><path d="M9 19h6v3H9z M11 2h2v3h-2z" /></> },
  settings: { box: 16, body: <><path d="M7 5h10l2 2v10l-2 2H7l-2-2V7z M10 10h4v4h-4z" /><path d="M9 2h6v3H9z M9 19h6v3H9z M2 9h3v6H2z M19 9h3v6h-3z" /></> },
  search: { box: 16, body: <><path d="M3 3h12v12H3z M6 6h6v6H6z" /><path d="M13 16l3-3 6 6-3 3z" /></> },
  globe: { box: 16, body: <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z M11 5h2v14h-2z M5 11h4v2H5z M15 11h4v2h-4z" /> },
  back: { box: 16, body: <path d="M3 12l7-7v4h11v6H10v4z" /> },
  warn: { box: 16, body: <path d="M12 2l10 19H2z M11 9h2v6h-2z M11 17h2v2h-2z" /> },
  params: { box: 16, body: <><path d="M3 6h18v2H3z M3 16h18v2H3z" /><path d="M14 3h4v8h-4z M6 13h4v8H6z" /></> },
  folder: { box: 16, body: <path d="M2 5h8l3 3h9v12H2z M5 11h14v6H5z" /> },
  doc: { box: 16, body: <path d="M5 2h10l4 4v16H5z M8 10h8v2H8z M8 14h8v2H8z" /> },
  export: { box: 16, body: <><path d="M12 2l7 7h-4v7H9V9H5z" /><path d="M4 19h16v3H4z" /></> },
  versions: { box: 16, body: <><path d="M3 3h18v18H3z M6 6h12v12H6z" /><path d="M11 8h2v5h4v2h-6z" /></> },
  analysis: { box: 16, body: <path d="M3 14h4v7H3z M10 4h4v17h-4z M17 10h4v11h-4z" /> },
  lock: { box: 14, body: <path d="M5 10h14v11H5z M8 3h8v7h-2V5h-4v5H8z M11 14h2v3h-2z" /> },
  unlock: { box: 14, body: <path d="M5 10h14v11H5z M8 3h8v3h-2V5h-4v5H8z M11 14h2v3h-2z" /> },
  check: { box: 12, body: <path d="M3 12l3-3 4 4 8-8 3 3-11 11z" /> },
  cross: { box: 12, body: <path d="M4 6l2-2 6 6 6-6 2 2-6 6 6 6-2 2-6-6-6 6-2-2 6-6z" /> },
  arrow: { box: 12, body: <path d="M3 10h12V5l7 7-7 7v-5H3z" /> },
  pause: { box: 12, body: <path d="M6 4h4v16H6z M14 4h4v16h-4z" /> },
  play: { box: 12, body: <path d="M6 3l15 9-15 9z" /> },
  chevron: { box: 12, body: <path d="M4 8l3-3 5 5 5-5 3 3-8 8z" /> },
  prev: { box: 12, body: <path d="M15 3l3 3-6 6 6 6-3 3-9-9z" /> },
  next: { box: 12, body: <path d="M9 3l-3 3 6 6-6 6 3 3 9-9z" /> },
  download: { box: 14, body: <><path d="M12 16l-7-7h4V2h6v7h4z" /><path d="M4 19h16v3H4z" /></> },
} satisfies Record<string, { box: number; body: ReactNode }>

export type IconName = keyof typeof ICONS

/** A decorative filled pictogram at its display size; the control around it carries the name. */
export function Icon({ name }: { name: IconName }) {
  const { box, body } = ICONS[name]
  return (
    <svg className="icon" width={box} height={box} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      {body}
    </svg>
  )
}

/** Logo L4, the sealed block: 3x3 squares whose bottom-right cell is an empty frame, the test split sealed until audit. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 2H10V10H2Z M12 2H20V10H12Z M22 2H30V10H22Z M2 12H10V20H2Z M12 12H20V20H12Z M22 12H30V20H22Z M2 22H10V30H2Z M12 22H20V30H12Z M22 22H30V30H22Z M24 24V28H28V24Z" />
    </svg>
  )
}

// Event marks: the shape goes with the event word, never colour alone; a failed run is the signal.
const EVENT_SHAPES: Record<string, ReactNode> = {
  'run-failed': <path d="M3 3l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  verdict: <path d="M6 1.5l4.5 4.5L6 10.5 1.5 6z" fill="currentColor" />,
  skeptic: <path d="M6 1.8l4.2 4.2L6 10.2 1.8 6z" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  run: <rect x="2.5" y="2.5" width="7" height="7" fill="currentColor" />,
  scaffold: <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  probe: <path d="M6 2.2l4 7H2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
}

export function EventMark({ event }: { event: string }) {
  if (event === 'confirm' || event === 'lockbox') {
    return (
      <span className="evmark">
        <Icon name="unlock" />
      </span>
    )
  }
  return (
    <span className={event === 'run-failed' ? 'evmark is-signal' : 'evmark'}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {EVENT_SHAPES[event] ?? EVENT_SHAPES.run}
      </svg>
    </span>
  )
}
