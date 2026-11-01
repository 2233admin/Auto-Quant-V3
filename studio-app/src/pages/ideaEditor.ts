/** Only unwrap the exact expression adapter authored by this UI; arbitrary Python stays Python. */
export function candidateExpression(source: string): string {
  return /^import pandas as pd\r?\n\r?\ndef compute_factor\(panel: pd\.DataFrame\) -> pd\.Series:\r?\n    return \(([\s\S]+)\)\.rename\("idea_factor"\)\r?\n?$/.exec(source)?.[1] ?? ''
}

export function expressionSource(expression: string, fallback: string): string {
  return expression.trim() ? `import pandas as pd\n\ndef compute_factor(panel: pd.DataFrame) -> pd.Series:\n    return (${expression.trim()}).rename("idea_factor")\n` : fallback
}
