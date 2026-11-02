import { uiText } from '../i18n'

/** Owner-confirmed catalogue. Causes and next steps are separate from these fixed labels. Read at render time so the active language applies. */
export const STATE_COPY = {
  get supported() { return uiText('Supported') }, get inconclusive() { return uiText('Inconclusive') }, get couldNotTest() { return uiText('Could not be tested') }, get notTested() { return uiText('Not tested') },
  get stale() { return uiText('Stale session') }, get staleReason() { return uiText('This view was loaded before the workspace changed.') }, get refresh() { return uiText('Refresh') },
  get readOnly() { return uiText('Read-only session') }, get readOnlyReason() { return uiText('Read-only session: actions are off.') },
  get hidden() { return uiText('Hidden') }, get hiddenReason() { return uiText('Test split is hidden until the study is frozen.') },
  get empty() { return uiText('No evidence in this Project') }, get loading() { return uiText('Loading…') }, get error() { return uiText('Could not load this Project') }, get retry() { return uiText('Retry') },
}
