/** Saves `data` as a pretty-printed JSON file, client-side (no request). Used for the snapshot already on the page. */
export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, `${JSON.stringify(data, null, 2)}\n`, 'application/json')
}

export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
