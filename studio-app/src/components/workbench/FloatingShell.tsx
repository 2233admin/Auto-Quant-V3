import type { ReactNode } from 'react'
import './floating.css'

/** Shared canvas and floating rail/main geometry; page content keeps its own scroll. */
export function FloatingShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return <div className="shell floating-shell">{sidebar}<div className="main">{children}</div></div>
}
