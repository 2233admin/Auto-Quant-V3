import type { ProjectSnapshot } from '../../api'
import { Info } from '../../components/Info'
import { HeroLine, HeroTiles, type HeroTile } from '../hero'
import { Section, SectionNav } from '../../design/layout'
import { Block, day, finite, Kv, sp, up } from '../portfolio/pfmt'
import { LaneChart, type ChartSeries } from './LaneChart'
import { ArtifactList, DivergingBars, LaneEmpty, LaneHead, Na, NaBox, StatusBand, WeightsTable, type Reason } from './laneParts'
import type { PathStressDiagnostics } from './laneTypes'
import '../../components/components.css'

const words = (s: string | undefined | null) => (s ? s.replaceAll('-', ' ') : '—')
const n0 = (v: number | null | undefined) => (finite(v) ? String(Math.round(v)) : '—')

export function BookStressPage({ project }: { project: ProjectSnapshot }) {
  const x = project.bookPathStressExplorer as PathStressDiagnostics | null
  if (!x) return <LaneEmpty title="Reported-book path stress" projectId={project.id} projectName={project.name} what="Reported-book path stress" />

  const sum = x.summary
  const pol = x.policy
  const hold = pol?.path?.holdingBars
  const episodes = x.episodes ?? []
  const contributions = x.contributions ?? []
  const paths = x.paths ?? []
  const holdings = Object.keys(x.snapshot?.weights ?? {}).length
  const same = sum?.sameDominantLossContributorAcrossAllEpisodes

  const reasons: Reason[] = [
    {
      tone: 'info',
      text: `The worst ${n0(hold)}-session window for the fixed opening units ends ${sp(sum?.worstTerminalBookReturn, 2)}. ${n0(sum?.selectedEpisodeCount)} non-overlapping episodes were kept from ${n0(sum?.eligibleWindowCount)} complete windows.`,
      field: 'summary.worstTerminalBookReturn, summary.eligibleWindowCount',
    },
    {
      tone: 'info',
      text: same
        ? `Every selected episode is dominated by the same holding, ${sum?.dominantLossContributorAcrossAllEpisodes ?? '—'}.`
        : 'The dominant loss contributor differs between episodes, so no single holding explains all of them.',
      field: `summary.sameDominantLossContributorAcrossAllEpisodes = ${String(same)}`,
    },
    {
      tone: 'info',
      text: `Position truth is ${words(pol?.authority?.positionTruth)}; trading authority is ${pol?.authority?.tradingAuthority ?? '—'}. The Run does not forecast recurrence.`,
      field: 'policy.authority',
    },
  ]
  if (x.warning) reasons.push({ tone: 'info', text: x.warning, field: 'warning' })

  const DASH = ['', '7 3', '2 3', '10 3 2 3', '4 4']
  const ranks = [...new Set(paths.map((p) => p.rank))].sort((a, b) => a - b)
  const series: ChartSeries[] = ranks.map((rank, i) => {
    const ep = episodes.find((e) => e.rank === rank)
    return {
      key: `r${rank}`,
      label: `#${rank} from ${day(ep?.startTimestamp)}`,
      dash: DASH[i % DASH.length] || undefined,
      points: paths.filter((p) => p.rank === rank).map((p) => ({ x: p.offsetBars, xl: `bar ${p.offsetBars}`, y: p.bookReturn })),
    }
  })

  const tiles: HeroTile[] = [
    { label: 'Worst terminal return', value: sp(sum?.worstTerminalBookReturn, 2), note: 'fixed opening units' },
    { label: 'Complete windows', value: n0(sum?.eligibleWindowCount), note: `${n0(hold)} sessions each` },
    { label: 'Selected episodes', value: n0(sum?.selectedEpisodeCount), note: words(pol?.ranking?.overlapPolicy) },
    { label: 'Same dominant holding', value: same === undefined ? '—' : same ? 'yes' : 'no', note: sum?.dominantLossContributorAcrossAllEpisodes ?? 'mixed contributors' },
    { label: 'Holding window', value: `${n0(hold)} bars`, note: `ranked by ${words(pol?.ranking?.metric)}` },
    { label: 'Cash weight', value: up(x.snapshot?.cashWeight, 1), note: x.snapshot?.baseCurrency ?? undefined },
  ]

  return (
    <div className="pg">
      <LaneHead
        title="Reported-book path stress"
        projectId={project.id}
        projectName={project.name}
        lines={[
          <>
            Run <span className="mono">{x.run?.id?.replace(/^run-/, '') ?? '—'}</span> · {holdings} reported holdings as of {day(x.snapshot?.asOf)} · {n0(x.dataset?.alignedObservations)} aligned sessions
          </>,
          <>
            Dataset <span className="mono">{x.dataset?.id ?? '—'}</span>, {day(x.dataset?.timeRange?.start)} to {day(x.dataset?.timeRange?.end)}. Historical stress of one fixed book; no trading authority.
          </>,
          'This lane has no train, validation or test split: every window comes from the content-locked history, so no test number exists to hide.',
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone="warn"
          word="Descriptive stress evidence"
          why={
            <Info label="Why this status">
              <p>This lane publishes no pass or fail enum. It lists the worst historical windows for the book exactly as reported; it grades nothing.</p>
            </Info>
          }
        >
          the worst {n0(hold)}-session window for the fixed opening units ends {sp(sum?.worstTerminalBookReturn, 2)}
        </HeroLine>

        <section aria-labelledby="bs-paths">
          <div className="lane-hero-head">
            <h2 id="bs-paths">Selected paths</h2>
          </div>
          {series.length && series[0].points.length >= 2 ? (
            <LaneChart
              title="Cumulative book return along each selected episode"
              desc={`Return of the fixed opening units at each of the ${n0(hold)} following sessions. Episodes are told apart by line pattern and label.`}
              series={series}
              fy={(v) => sp(v, 1)}
              yLabel="book return"
              xLabel="Bars after the opening"
            />
          ) : (
            <NaBox why={`the Run publishes ${paths.length} path points, too few to draw an episode path`} />
          )}
        </section>

        <HeroTiles items={tiles} label="Core numbers" />
      </div>

      <SectionNav
        items={[
          { id: 'bs-summary', label: 'Status' },
          { id: 'bs-episodes', label: 'Episodes' },
          { id: 'bs-contrib', label: 'Attribution' },
          { id: 'bs-book', label: 'Book and rules' },
        ]}
      />

      <div className="band">
        <Section title="Status" id="bs-summary" caption={`Fixed opening units held for ${n0(hold)} sessions, no rebalancing, cash flat.`}>
          <div className="vstack">
            <StatusBand
              id="bs-status-word"
              kicker="Server status · descriptive"
              word="Descriptive stress evidence"
              glyph="empty"
              lead="This lane publishes no pass or fail enum. It lists the worst historical windows for the book exactly as reported; it grades nothing."
              reasons={reasons}
            />
          </div>
        </Section>
      </div>

      <Section title="Worst episodes" id="bs-episodes" caption={`${n0(sum?.selectedEpisodeCount)} worst non-overlapping windows, worst first.`}>
        {episodes.length === 0 ? (
          <NaBox why="episodes is empty in the payload, so the Run selected no complete window" />
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Start → end</th>
                  <th scope="col" className="r">Terminal return</th>
                  <th scope="col" className="r">Worst interim</th>
                  <th scope="col">Worst interim on</th>
                  <th scope="col">Dominant loss</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((e) => (
                  <tr key={e.rank}>
                    <td className="mono">{e.rank}</td>
                    <td className="mono nowrap">{day(e.startTimestamp)} → {day(e.endTimestamp)}</td>
                    <td className="r">{sp(e.terminalBookReturn, 2)}</td>
                    <td className="r">{sp(e.worstInterimBookReturn, 2)}</td>
                    <td className="mono">{day(e.worstInterimTimestamp)}</td>
                    <td className="mono">{e.dominantLossContributor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Holding attribution" id="bs-contrib" caption={`Opening weight times return over the window; cash ${sp(pol?.attribution?.cashContribution, 1)}.`}>
        {contributions.length === 0 ? (
          <NaBox why="contributions is empty in the payload" />
        ) : (
          <div className="vstack">
            <div className="lane-ep-grid">
              {episodes.map((e) => {
                const rows = contributions.filter((c) => c.rank === e.rank)
                return (
                  <div key={e.rank}>
                    <h4>
                      Episode {e.rank}: {day(e.startTimestamp)} → {day(e.endTimestamp)}, {sp(e.terminalBookReturn, 2)}
                    </h4>
                    <DivergingBars
                      label={`Terminal contribution by holding, episode ${e.rank}`}
                      rows={rows.map((c) => ({ name: c.asset, value: c.terminalContribution, text: `${sp(c.terminalContribution, 2)} = ${up(c.openingWeight, 0)} × ${sp(c.terminalAssetReturn, 1)}` }))}
                    />
                  </div>
                )
              })}
            </div>
            <details className="datatable">
              <summary>Attribution table</summary>
              <div className="tablewrap tablewrap--tall">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Episode</th>
                      <th scope="col">Holding</th>
                      <th scope="col" className="r">Opening weight</th>
                      <th scope="col" className="r">Asset return</th>
                      <th scope="col" className="r">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((c, i) => (
                      <tr key={`${c.rank}-${c.asset}-${i}`}>
                        <td className="mono">{c.rank}</td>
                        <td className="mono">{c.asset}</td>
                        <td className="r">{up(c.openingWeight, 1)}</td>
                        <td className="r">{sp(c.terminalAssetReturn, 2)}</td>
                        <td className="r">{sp(c.terminalContribution, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </Section>

      <Section title="Reported book and fixed rules" id="bs-book" fold caption="Snapshot, rules and Run artifacts.">
        <div className="vstack">
          <Block title="Reported book">
            {x.snapshot?.weights ? <WeightsTable weights={x.snapshot.weights} cash={x.snapshot.cashWeight} currency={x.snapshot.baseCurrency} /> : <Na why="snapshot.weights is not in the payload" />}
          </Block>
          <Block title="Fixed rules">
            <Kv
              rows={[
                ['Path method', words(pol?.path?.method)],
                ['Price', words(pol?.path?.price)],
                ['Rebalancing', words(pol?.path?.rebalancing)],
                ['Holding bars', n0(hold)],
                ['Episode count', n0(pol?.ranking?.episodeCount)],
                ['Interval boundary', words(pol?.ranking?.intervalBoundary)],
                ['Attribution', words(pol?.attribution?.method)],
                ['Price adjustment', words(x.dataset?.priceAdjustment)],
              ]}
            />
          </Block>
          <Block title="Artifacts">
            <ArtifactList artifacts={x.artifacts} />
          </Block>
        </div>
      </Section>
    </div>
  )
}
