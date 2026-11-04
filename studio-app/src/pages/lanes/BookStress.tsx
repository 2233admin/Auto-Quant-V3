import { coreWord, uiTemplate, uiText } from '../../i18n'
import type { ProjectSnapshot } from '../../api'
import { Info } from '../../components/Info'
import { HeroLine, HeroTiles, type HeroTile } from '../hero'
import { Section, SectionNav } from '../../design/layout'
import { Block, day, finite, Kv, sp, up } from '../portfolio/pfmt'
import { LaneChart, type ChartSeries } from './LaneChart'
import { ArtifactList, DivergingBars, LaneEmpty, LaneHead, Na, NaBox, StatusBand, WeightsTable, type Reason } from './laneParts'
import type { PathStressDiagnostics } from './laneTypes'
import '../../components/components.css'

const words = coreWord
const n0 = (v: number | null | undefined) => (finite(v) ? String(Math.round(v)) : '—')

export function BookStressPage({ project }: { project: ProjectSnapshot }) {
  const x = project.bookPathStressExplorer as PathStressDiagnostics | null
  if (!x) return <LaneEmpty title={uiText("Reported-book path stress")} projectId={project.id} projectName={project.name} what="Reported-book path stress" />

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
      text: uiTemplate("The worst {0}-session window for the fixed opening units ends {1}. {2} non-overlapping episodes were kept from {3} complete windows.", [n0(hold), sp(sum?.worstTerminalBookReturn, 2), n0(sum?.selectedEpisodeCount), n0(sum?.eligibleWindowCount)]),
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
      text: uiTemplate("Position truth is {0}; trading authority is {1}. The Run does not forecast recurrence.", [words(pol?.authority?.positionTruth), pol?.authority?.tradingAuthority ?? '—']),
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
      label: uiTemplate("#{0} from {1}", [rank, day(ep?.startTimestamp)]),
      dash: DASH[i % DASH.length] || undefined,
      points: paths.filter((p) => p.rank === rank).map((p) => ({ x: p.offsetBars, xl: `bar ${p.offsetBars}`, y: p.bookReturn })),
    }
  })

  const tiles: HeroTile[] = [
    { label: uiText("Worst terminal return"), value: sp(sum?.worstTerminalBookReturn, 2), note: uiText("fixed opening units") },
    { label: uiText("Complete windows"), value: n0(sum?.eligibleWindowCount), note: uiTemplate("{0} sessions each", [n0(hold)]) },
    { label: uiText("Selected episodes"), value: n0(sum?.selectedEpisodeCount), note: words(pol?.ranking?.overlapPolicy) },
    { label: uiText("Same dominant holding"), value: same === undefined ? '—' : same ? 'yes' : 'no', note: sum?.dominantLossContributorAcrossAllEpisodes ?? 'mixed contributors' },
    { label: uiText("Holding window"), value: `${n0(hold)} bars`, note: uiTemplate("ranked by {0}", [words(pol?.ranking?.metric)]) },
    { label: uiText("Cash weight"), value: up(x.snapshot?.cashWeight, 1), note: x.snapshot?.baseCurrency ?? undefined },
  ]

  return (
    <div className="pg">
      <LaneHead
        title={uiText("Reported-book path stress")}
        projectId={project.id}
        projectName={project.name}
        lines={[
          <>{uiText("Run ")}<span className="mono">{x.run?.id?.replace(/^run-/, '') ?? '—'}</span> · {holdings}{uiText(" reported holdings as of ")}{day(x.snapshot?.asOf)} · {n0(x.dataset?.alignedObservations)}{uiText(" aligned sessions")}</>,
          <>{uiText("Dataset ")}<span className="mono">{x.dataset?.id ?? '—'}</span>, {day(x.dataset?.timeRange?.start)}{uiText(" to ")}{day(x.dataset?.timeRange?.end)}{uiText(". Historical stress of one fixed book; no trading authority.")}</>,
          'This lane has no train, validation or test split: every window comes from the content-locked history, so no test number exists to hide.',
        ]}
      />

      <SectionNav
        items={[
          { id: 'bs-summary', label: uiText("Status") },
          { id: 'bs-episodes', label: uiText("Episodes") },
          { id: 'bs-contrib', label: uiText("Attribution") },
          { id: 'bs-book', label: uiText("Book and rules") },
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone="warn"
          word={uiText("Descriptive stress evidence")}
          why={
            <Info label={uiText("Why this status")}>
              <p>{uiText("This lane publishes no pass or fail enum. It lists the worst historical windows for the book exactly as reported; it grades nothing.")}</p>
            </Info>
          }
        >{uiText("the worst ")}{n0(hold)}{uiText("-session window for the fixed opening units ends ")}{sp(sum?.worstTerminalBookReturn, 2)}
        </HeroLine>

        <section aria-labelledby="bs-paths">
          <div className="lane-hero-head">
            <h2 id="bs-paths">{uiText("Selected paths")}</h2>
          </div>
          {series.length && series[0].points.length >= 2 ? (
            <LaneChart
              title={uiText("Cumulative book return along each selected episode")}
              desc={uiTemplate("Return of the fixed opening units at each of the {0} following sessions. Episodes are told apart by line pattern and label.", [n0(hold)])}
              series={series}
              fy={(v) => sp(v, 1)}
              yLabel="book return"
              xLabel="Bars after the opening"
            />
          ) : (
            <NaBox why={`the Run publishes ${paths.length} path points, too few to draw an episode path`} />
          )}
        </section>

        <HeroTiles items={tiles} label={uiText("Core numbers")} />
      </div>

      <div className="band">
        <Section title={uiText("Status")} id="bs-summary" caption={uiTemplate("Fixed opening units held for {0} sessions, no rebalancing, cash flat.", [n0(hold)])}>
          <div className="vstack">
            <StatusBand
              id="bs-status-word"
              kicker="Server status · descriptive"
              word={uiText("Descriptive stress evidence")}
              glyph="empty"
              lead="This lane publishes no pass or fail enum. It lists the worst historical windows for the book exactly as reported; it grades nothing."
              reasons={reasons}
            />
          </div>
        </Section>
      </div>

      <Section title={uiText("Worst episodes")} id="bs-episodes" caption={uiTemplate("{0} worst non-overlapping windows, worst first.", [n0(sum?.selectedEpisodeCount)])}>
        {episodes.length === 0 ? (
          <NaBox why="episodes is empty in the payload, so the Run selected no complete window" />
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{uiText("Rank")}</th>
                  <th scope="col">{uiText("Start → end")}</th>
                  <th scope="col" className="r">{uiText("Terminal return")}</th>
                  <th scope="col" className="r">{uiText("Worst interim")}</th>
                  <th scope="col">{uiText("Worst interim on")}</th>
                  <th scope="col">{uiText("Dominant loss")}</th>
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

      <Section title={uiText("Holding attribution")} id="bs-contrib" caption={uiTemplate("Opening weight times return over the window; cash {0}.", [sp(pol?.attribution?.cashContribution, 1)])}>
        {contributions.length === 0 ? (
          <NaBox why="contributions is empty in the payload" />
        ) : (
          <div className="vstack">
            <div className="lane-ep-grid">
              {episodes.map((e) => {
                const rows = contributions.filter((c) => c.rank === e.rank)
                return (
                  <div key={e.rank}>
                    <h4>{uiText("Episode ")}{e.rank}: {day(e.startTimestamp)} → {day(e.endTimestamp)}, {sp(e.terminalBookReturn, 2)}
                    </h4>
                    <DivergingBars
                      label={uiTemplate("Terminal contribution by holding, episode {0}", [e.rank])}
                      rows={rows.map((c) => ({ name: c.asset, value: c.terminalContribution, text: `${sp(c.terminalContribution, 2)} = ${up(c.openingWeight, 0)} × ${sp(c.terminalAssetReturn, 1)}` }))}
                    />
                  </div>
                )
              })}
            </div>
            <details className="datatable">
              <summary>{uiText("Attribution table")}</summary>
              <div className="tablewrap tablewrap--tall">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">{uiText("Episode")}</th>
                      <th scope="col">{uiText("Holding")}</th>
                      <th scope="col" className="r">{uiText("Opening weight")}</th>
                      <th scope="col" className="r">{uiText("Asset return")}</th>
                      <th scope="col" className="r">{uiText("Contribution")}</th>
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

      <Section title={uiText("Reported book and fixed rules")} id="bs-book" fold caption={uiText("Snapshot, rules and Run artifacts.")}>
        <div className="vstack">
          <Block title={uiText("Reported book")}>
            {x.snapshot?.weights ? <WeightsTable weights={x.snapshot.weights} cash={x.snapshot.cashWeight} currency={x.snapshot.baseCurrency} /> : <Na why="snapshot.weights is not in the payload" />}
          </Block>
          <Block title={uiText("Fixed rules")}>
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
          <Block title={uiText("Artifacts")}>
            <ArtifactList artifacts={x.artifacts} />
          </Block>
        </div>
      </Section>
    </div>
  )
}
