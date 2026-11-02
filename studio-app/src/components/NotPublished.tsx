import { uiText, uiValue } from '../i18n'
import { AnimatedDetails } from './motion/AnimatedDetails'
import './components.css'

/** Reference-product figures this lane does not publish, with the gap matrix's reason. Nothing here is computed or guessed. */
const ITEMS: { name: string; reason: string }[] = [
  { name: 'Factor return', get reason() { return uiText("Needs a cumulative long-short series from the Core; only per-bar quantile means are published.") } },
  { name: 'Annualized return', get reason() { return uiText("Needs a daily high-minus-low series from the Core; none is published for a Factor.") } },
  { name: 'Sharpe ratio', get reason() { return uiText("Not published for a Factor. Portfolio Runs publish Sharpe, but that is a portfolio, not a factor group.") } },
  { name: 'Maximum drawdown', get reason() { return uiText("Not published for a Factor; it would come from the same missing long-short series.") } },
  { name: 'P(IC beyond a band)', get reason() { return uiText("Exact shares need the full daily IC; the published IC path is sampled. Hit rate (IC above 0) is published instead.") } },
  { name: 'Information ratio (IR)', get reason() { return uiText("Its meaning is not defined by the reference, so none is shown rather than guessing one.") } },
  { name: 'Pearson IC std', get reason() { return uiText("Only the rank IC standard deviation is published.") } },
]

export function NotPublished() {
  return (
    <AnimatedDetails className="np">
      <summary>{uiText("Not published by this lane (")}{ITEMS.length})</summary>
      <ul>
        {ITEMS.map((i) => (
          <li key={i.name}>
            <span>{i.name}</span>
            <span className="muted">{uiValue(i.reason)}</span>
          </li>
        ))}
      </ul>
    </AnimatedDetails>
  )
}
