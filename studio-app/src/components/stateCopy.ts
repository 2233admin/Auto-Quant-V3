/** Owner-confirmed catalogue. Causes and next steps are separate from these fixed labels. */
export const STATE_COPY = {
  supported: 'Supported', inconclusive: 'Inconclusive', couldNotTest: 'Could not be tested', notTested: 'Not tested',
  stale: 'Stale session', staleReason: 'This view was loaded before the workspace changed.', refresh: 'Refresh',
  readOnly: 'Read-only session', readOnlyReason: 'Read-only session: actions are off.',
  hidden: 'Hidden', hiddenReason: 'Test split is hidden until the study is frozen.',
  empty: 'No evidence in this Project', loading: 'Loading…', error: 'Could not load this Project', retry: 'Retry',
} as const
