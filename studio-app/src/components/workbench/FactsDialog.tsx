import { uiText, uiValue } from '../../i18n'
import type { ReactNode } from 'react'
import { Modal } from '../../shell/Modal'
import { FactChips, type Fact } from './FactChips'
import '../../actions/actions.css'

/** A modal that lists locked facts (the Study / protocol parameters of the Run on show). Read-only; Esc or Close dismisses it. */
export function FactsDialog({ open, onClose, title, facts, note }: { open: boolean; onClose: () => void; title: string; facts: Fact[]; note?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} label={title} className="adialog">
      <div className="adialog-body">
        <header className="adialog-head">
          <h2>{title}</h2>
          {note && <p className="small muted">{uiValue(note)}</p>}
        </header>
        <div className="adialog-scroll">
          <FactChips label={uiText("Read-only values")} locked facts={facts} compact={false} />
        </div>
        <footer className="adialog-foot">
          <button type="button" className="abtn" onClick={onClose}>{uiText("Close")}</button>
        </footer>
      </div>
    </Modal>
  )
}
