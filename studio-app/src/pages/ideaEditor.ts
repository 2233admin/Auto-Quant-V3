/** Only unwrap the exact expression adapter authored by this UI; arbitrary Python stays Python. */
export function candidateExpression(source: string): string {
  return /^import pandas as pd\r?\n\r?\ndef compute_factor\(panel: pd\.DataFrame\) -> pd\.Series:\r?\n    return \(([\s\S]+)\)\.rename\("idea_factor"\)\r?\n?$/.exec(source)?.[1] ?? ''
}

export function expressionSource(expression: string, fallback: string): string {
  return expression.trim() ? `import pandas as pd\n\ndef compute_factor(panel: pd.DataFrame) -> pd.Series:\n    return (${expression.trim()}).rename("idea_factor")\n` : fallback
}

/** Group counts a Study can freeze for the Factor tear sheet. Core and the Studio server accept exactly these. */
export const QUANTILE_CHOICES = [3, 5, 10] as const
export const DEFAULT_QUANTILES = 3

/** Params of the intake preview. The default count is left out, so the frozen Study keeps its original bytes. */
export function intakeParams(dataset: string, horizon: number, predictionAssets: string[], quantiles: number) {
  return { dataset, horizon, predictionAssets, ...(quantiles === DEFAULT_QUANTILES ? {} : { quantiles }) }
}
