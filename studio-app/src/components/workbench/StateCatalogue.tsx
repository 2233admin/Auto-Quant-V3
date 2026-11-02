import { useState } from 'react'
import { STATE_COPY as copy } from '../stateCopy'
import { Empty, Loading } from '../States'
import { Notice } from '../../Notice'
import { VerdictBar } from './VerdictBar'
import { SignConventionSetting } from './SignConventionSetting'

/** Review-only kit catalogue, never a fabricated research result. */
export function StateCatalogue() {
  const [refreshed,setRefreshed] = useState(false)
  return <div><h1 className="type-page-title">State catalogue · component examples</h1><div className="state-catalogue">
    <section><VerdictBar tone="ok" word={copy.supported}>Development evidence only.</VerdictBar></section>
    <section><VerdictBar tone="warn" word={copy.inconclusive}>The evidence does not establish this claim.</VerdictBar></section>
    <section><VerdictBar tone="bad" word={copy.couldNotTest}>The required protocol was unavailable.</VerdictBar></section>
    <section><h2>{copy.notTested}</h2><p>Run study from the factor editor to produce evidence.</p></section>
    <section><h2>{copy.stale}</h2><p>{refreshed ? 'Example view refreshed.' : copy.staleReason}</p><button className="abtn" onClick={() => setRefreshed(true)}>{copy.refresh}</button></section>
    <section><h2>{copy.readOnly}</h2><SignConventionSetting readOnly /></section>
    <section><h2>{copy.hidden}</h2><p>{copy.hiddenReason}</p></section>
    <section><Empty><p>Run a study to see a verdict.</p></Empty></section>
    <section><Loading /></section>
    <section><Notice kind="error" label="Error" title={copy.error} subtitle="The example Workspace did not answer." /></section>
  </div></div>
}
