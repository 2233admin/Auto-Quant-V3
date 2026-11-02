import { uiTemplate, uiText } from '../../i18n'
import type { QualityCheck, QualityReport } from './intakeApi'

const LABELS: Record<string, string> = {
  parsing: 'Readable OHLCV values', duplicates: 'Duplicate timestamps', ordering: 'Timestamp order', prices: 'Positive finite prices',
  ohlc: 'OHLC consistency', volume: 'Non-negative finite volume', 'zero-volume': 'Zero-volume bars',
  'missing-bars': 'Missing scheduled bars', 'long-gaps': 'Long gaps / possible suspensions', 'price-jumps': 'Price jumps',
  'session-alignment': 'Calendar and session alignment', timezone: 'Timezone authority', survivorship: 'Delisted-asset coverage',
  'intake-ohlcv': 'Strict OHLCV validation', 'cross-asset-alignment': 'Cross-asset timestamp alignment',
}
const VERDICTS: Record<string, string> = { pass: 'Pass', warn: 'Warning', fail: 'Fail' }
export function QualityBadge({ verdict }: { verdict: string }) {
  return <span className="intake-badge" data-verdict={verdict}>{uiText(VERDICTS[verdict] ?? verdict)}</span>
}
function CheckRows({ checks }: { checks: QualityCheck[] }) {
  return <table className="intake-table"><thead><tr><th>{uiText('Quality check')}</th><th>{uiText('Result')}</th><th>{uiText('Count')}</th><th>{uiText('Examples')}</th></tr></thead><tbody>{checks.map(check => <tr key={check.id} data-check={check.id} data-verdict={check.verdict}>
    <td>{uiText(LABELS[check.id] ?? check.id)}</td><td><QualityBadge verdict={check.verdict} /></td><td className="mono">{check.count}</td>
    <td>{check.examples.length > 0 ? <details><summary>{uiTemplate('View {0} examples', [check.examples.length])}</summary><p className="muted small">{uiText('Original diagnostics; declared metadata is unauthenticated.')}</p><pre className="cmd small">{JSON.stringify(check.examples, null, 2)}</pre></details> : '—'}</td>
  </tr>)}</tbody></table>
}
export function QualityTable({ report }: { report: QualityReport }) {
  return <div className="intake-quality">
    <div className="intake-summary"><h2>{uiText('Data quality report')}</h2><QualityBadge verdict={report.verdict} /></div>
    <p className="small muted">{uiTemplate('Jump threshold: {0}%. Long gap: {1} missing bars. Coverage: {2}.', [report.jumpThreshold * 100, report.longGapBars, uiText(report.universeStatus)])}</p>
    <p className="small muted">{uiText('Missing rates use the declared calendar within each observed asset span, unless explicit bounds are supplied. Unknown authority stays unknown. A long gap does not prove a suspension.')}</p>
    <p className="small muted">{uiText('Raw prices may jump at corporate actions. Adjusted prices remain a source claim; this check never adjusts prices.')}</p>
    <CheckRows checks={report.summary} />
    <h2>{uiText('Per-asset coverage')}</h2><table className="intake-table"><thead><tr><th>{uiText('Asset')}</th><th>{uiText('Rows')}</th><th>{uiText('Date range')}</th><th>{uiText('Missing rate')}</th><th>{uiText('Result')}</th></tr></thead><tbody>{report.assets.map(asset => <tr key={asset.asset}>
      <td><details><summary className="mono" translate="no">{asset.asset}</summary><p className="mono" translate="no">{asset.market.calendar ?? '—'} · {asset.market.timezone ?? '—'}</p><CheckRows checks={asset.checks} /></details></td><td className="mono">{asset.rows}</td><td className="mono" title={asset.dateRange ? `${asset.dateRange.start} – ${asset.dateRange.end}` : undefined}>{asset.dateRange ? `${asset.dateRange.start.slice(0, 10)} – ${asset.dateRange.end.slice(0, 10)}` : '—'}</td><td className="mono">{asset.missingBarRate == null ? uiText('Unknown') : `${(asset.missingBarRate * 100).toFixed(2)}%`}</td><td><QualityBadge verdict={asset.verdict} /></td>
    </tr>)}</tbody></table>
  </div>
}
