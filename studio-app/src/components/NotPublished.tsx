import { AnimatedDetails } from './motion/AnimatedDetails'
import './components.css'

/** Reference-product figures this lane does not publish, with the gap matrix's reason. Nothing here is computed or guessed. */
const ITEMS: { name: string; reason: string }[] = [
  { name: 'Factor return', reason: 'Needs a cumulative long-short series from the Core; only per-bar quantile means are published.' },
  { name: 'Annualized return', reason: 'Needs a daily high-minus-low series from the Core; none is published for a Factor.' },
  { name: 'Sharpe ratio', reason: 'Not published for a Factor. Portfolio Runs publish Sharpe, but that is a portfolio, not a factor group.' },
  { name: 'Maximum drawdown', reason: 'Not published for a Factor; it would come from the same missing long-short series.' },
  { name: 'P(IC beyond a band)', reason: 'Exact shares need the full daily IC; the published IC path is sampled. Hit rate (IC above 0) is published instead.' },
  { name: 'Information ratio (IR)', reason: 'Its meaning is not defined by the reference, so none is shown rather than guessing one.' },
  { name: 'Pearson IC std', reason: 'Only the rank IC standard deviation is published.' },
]

export function NotPublished() {
  return (
    <AnimatedDetails className="np">
      <summary>Not published by this lane ({ITEMS.length})</summary>
      <ul>
        {ITEMS.map((i) => (
          <li key={i.name}>
            <span>{i.name}</span>
            <span className="muted">{i.reason}</span>
          </li>
        ))}
      </ul>
    </AnimatedDetails>
  )
}
