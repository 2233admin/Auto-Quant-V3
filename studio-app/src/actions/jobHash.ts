/** The active job id lives in the URL hash as `job=<id>`, after an optional section anchor: `#sec-next&job=<id>`. */
const JOB = /(?:^|&)job=([A-Za-z0-9-]+)/

export function readJobHash(hash = window.location.hash): string | null {
  return JOB.exec(hash.replace(/^#/, ''))?.[1] ?? null
}

/** The hash without any job part, as the section anchor alone ('' when there is none). */
export function sectionOfHash(hash = window.location.hash): string {
  return hash.replace(/^#/, '').replace(JOB, '').replace(/^&/, '')
}

/** A hash for `section`, carrying the current job id along so section navigation does not drop it. */
export function hashWithJob(section: string, job: string | null = readJobHash()): string {
  const parts = [section, job ? `job=${job}` : ''].filter(Boolean)
  return parts.length ? `#${parts.join('&')}` : ''
}

export function writeJobHash(job: string | null) {
  const next = hashWithJob(sectionOfHash(), job)
  window.history.replaceState(null, '', window.location.pathname + window.location.search + next)
}
