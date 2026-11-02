import { useState } from 'react'
import { uiText } from '../../i18n'
import { STATE_COPY as copy } from '../stateCopy'
import { Empty, Loading } from '../States'
import { Notice } from '../../Notice'
import { VerdictBar } from './VerdictBar'
import { SignConventionSetting } from './SignConventionSetting'

/** Review-only kit catalogue, never a fabricated research result. */
export function StateCatalogue() {
  const [refreshed,setRefreshed] = useState(false)
  return <div><h1 className="type-page-title">{uiText("State catalogue · component examples")}</h1><div className="state-catalogue">
    <section><VerdictBar tone="ok" word={copy.supported}>{uiText("Development evidence only.")}</VerdictBar></section>
    <section><VerdictBar tone="warn" word={copy.inconclusive}>{uiText("The evidence does not establish this claim.")}</VerdictBar></section>
    <section><VerdictBar tone="bad" word={copy.couldNotTest}>{uiText("The required protocol was unavailable.")}</VerdictBar></section>
    <section><h2>{copy.notTested}</h2><p>{uiText("Run study from the factor editor to produce evidence.")}</p></section>
    <section><h2>{copy.stale}</h2><p>{refreshed ? uiText('Example view refreshed.') : copy.staleReason}</p><button className="abtn" onClick={() => setRefreshed(true)}>{copy.refresh}</button></section>
    <section><h2>{copy.readOnly}</h2><SignConventionSetting readOnly /></section>
    <section><h2>{copy.hidden}</h2><p>{copy.hiddenReason}</p></section>
    <section><Empty><p>{uiText("Run a study to see a verdict.")}</p></Empty></section>
    <section><Loading /></section>
    <section><Notice kind="error" label={uiText("Error")} title={copy.error} subtitle={uiText("The example Workspace did not answer.")} /></section>
  </div></div>
}
