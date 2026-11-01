import { CopyButton } from '../actions/CopyButton'
import '../actions/actions.css'
import { Modal } from '../shell/Modal'

export const CREATE_COMMAND = 'aq project create <workspace> <id> --template ohlcv-factor-lab'
const WHY_DISABLED = `Creating a Project from Studio needs the project.create action (not built yet). Run: ${CREATE_COMMAND}`

/**
 * Informative only: a new idea is a Project with one Hypothesis, and Studio cannot create one yet.
 * The Create button is disabled with its reason shown, and the command that does the job can be copied.
 */
export function NewIdeaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="New idea" className="adialog">
      <div className="adialog-body">
        <div className="adialog-head">
          <h2>New idea</h2>
          <p className="muted">An idea is one Project: a folder of Studies and Runs that tests one Hypothesis.</p>
        </div>
        <div className="adialog-scroll">
          <p className="small">Creating it writes a new Project into this Workspace with one Hypothesis and the OHLCV factor lab template, ready for its first Session.</p>
          <div className="apreview">
            <h3>Create it from a terminal</h3>
            <div className="cmdrow">
              <pre className="cmd mono" translate="no">{CREATE_COMMAND}</pre>
              <CopyButton text={CREATE_COMMAND} label="Copy command" />
            </div>
          </div>
        </div>
        <div className="adialog-foot">
          <button type="button" className="abtn abtn--primary" disabled aria-describedby="new-idea-why">Create</button>
          <button type="button" className="abtn" onClick={onClose}>Close</button>
          <p id="new-idea-why" className="small muted" style={{ margin: 0, flexBasis: '100%' }}>{WHY_DISABLED}</p>
        </div>
      </div>
    </Modal>
  )
}
