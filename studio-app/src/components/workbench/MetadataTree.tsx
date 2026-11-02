export function MetadataTree({ study, run, dataset, window }: { study: string; run: string; dataset: string; window: string }) {
  return <dl className="metadata-tree" aria-label="Evidence metadata">{[['Study',study],['Run',run],['Dataset',dataset],['Window',window]].map(([label,value],i) =>
    <div key={label}><dt>{i===3 ? '└' : '├'} {label}</dt><dd>{value}</dd></div>
  )}</dl>
}
